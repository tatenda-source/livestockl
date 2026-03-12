import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://zimlivestock.co.zw",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reference, amount, method, phone } = await req.json();

    // Input validation
    if (!reference || typeof reference !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid reference" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!['EcoCash', 'OneMoney', 'Card'].includes(method)) {
      return new Response(
        JSON.stringify({ error: "Invalid payment method" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if ((method === 'EcoCash' || method === 'OneMoney') && !phone) {
      return new Response(
        JSON.stringify({ error: "Phone number required for mobile payments" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the payment record exists and amount matches
    const verifyClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: paymentRecord } = await verifyClient
      .from("payments")
      .select("amount, user_id, livestock_id")
      .eq("reference", reference)
      .single();

    if (!paymentRecord || paymentRecord.amount !== amount) {
      return new Response(
        JSON.stringify({ error: "Payment record not found or amount mismatch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the authenticated user owns this payment
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user: callerUser }, error: authError } = await authClient.auth.getUser();
    if (authError || !callerUser || callerUser.id !== paymentRecord.user_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: you do not own this payment" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify auction win and calculate correct amount
    const { data: winningBid } = await verifyClient
      .from("bids")
      .select("amount, livestock_id")
      .eq("user_id", callerUser.id)
      .eq("is_winner", true)
      .eq("livestock_id", paymentRecord.livestock_id)
      .single();

    if (!winningBid) {
      return new Response(
        JSON.stringify({ error: "You did not win this auction" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify listing status is 'ended' (not sold, cancelled, or active)
    const { data: listing } = await verifyClient
      .from("livestock_items")
      .select("status")
      .eq("id", winningBid.livestock_id)
      .single();

    if (!listing || listing.status !== "ended") {
      return new Response(
        JSON.stringify({ error: "Auction is not in a payable state" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-calculated amount (bid + 5% platform fee)
    const correctAmount = Math.round(winningBid.amount * 1.05);
    if (paymentRecord.amount !== correctAmount) {
      return new Response(
        JSON.stringify({ error: "Payment amount mismatch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const integrationId = Deno.env.get("PAYNOW_INTEGRATION_ID");
    const integrationKey = Deno.env.get("PAYNOW_INTEGRATION_KEY");
    const resultUrl = Deno.env.get("PAYNOW_RESULT_URL");
    const returnUrl = Deno.env.get("PAYNOW_RETURN_URL");

    if (!integrationId || !integrationKey) {
      return new Response(
        JSON.stringify({ error: "Paynow not configured", reference }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Paynow initiate request
    const values: Record<string, string> = {
      id: integrationId,
      reference,
      amount: amount.toString(),
      returnurl: returnUrl || `${req.headers.get("origin")}/payment-status/${reference}`,
      resulturl: resultUrl || "",
      status: "Message",
    };

    // Create hash
    const hashString = Object.values(values).join("") + integrationKey;
    const encoder = new TextEncoder();
    const data = encoder.encode(hashString);
    const hashBuffer = await crypto.subtle.digest("SHA-512", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    values.hash = hash.toUpperCase();

    // For mobile payments (EcoCash/OneMoney), use the mobile endpoint
    if ((method === "EcoCash" || method === "OneMoney") && phone) {
      values.phone = phone;
      values.method = method === "EcoCash" ? "ecocash" : "onemoney";
      values.authemail = ""; // Required field for mobile

      const formBody = new URLSearchParams(values).toString();
      const mobileController = new AbortController();
      const mobileTimeout = setTimeout(() => mobileController.abort(), 15000);
      let paynowResponse: Response;
      try {
        paynowResponse = await fetch(
          "https://www.paynow.co.zw/interface/remotetransaction",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formBody,
            signal: mobileController.signal,
          }
        );
      } finally {
        clearTimeout(mobileTimeout);
      }

      const responseText = await paynowResponse.text();
      const parsed = Object.fromEntries(new URLSearchParams(responseText));

      if (parsed.status?.toLowerCase() === "ok") {
        // Update payment record with Paynow reference
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        await supabase
          .from("payments")
          .update({
            paynow_reference: parsed.paynowreference,
            status: "pending",
          })
          .eq("reference", reference);

        return new Response(
          JSON.stringify({
            status: "ok",
            pollUrl: parsed.pollurl,
            paynowReference: parsed.paynowreference,
            instructions: parsed.instructions || "Check your phone for a USSD prompt",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: parsed.error || "Paynow request failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Web payment — redirect to Paynow checkout
    const formBody = new URLSearchParams(values).toString();
    const webController = new AbortController();
    const webTimeout = setTimeout(() => webController.abort(), 15000);
    let paynowResponse: Response;
    try {
      paynowResponse = await fetch(
        "https://www.paynow.co.zw/interface/initiatetransaction",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody,
          signal: webController.signal,
        }
      );
    } finally {
      clearTimeout(webTimeout);
    }

    const responseText = await paynowResponse.text();
    const parsed = Object.fromEntries(new URLSearchParams(responseText));

    if (parsed.status?.toLowerCase() === "ok") {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await supabase
        .from("payments")
        .update({ paynow_reference: parsed.paynowreference })
        .eq("reference", reference);

      return new Response(
        JSON.stringify({
          status: "ok",
          redirectUrl: parsed.browserurl,
          pollUrl: parsed.pollurl,
          paynowReference: parsed.paynowreference,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: parsed.error || "Paynow request failed" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
