import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await req.text();
    const params = Object.fromEntries(new URLSearchParams(formData));

    const integrationKey = Deno.env.get("PAYNOW_INTEGRATION_KEY");
    if (!integrationKey) {
      return new Response("Not configured", { status: 500 });
    }

    // Verify hash from Paynow
    // NOTE: The hash field order should be verified against Paynow's official documentation.
    // We try multiple strategies: documented order first, then received order, then alphabetical.
    const receivedHash = params.hash;

    const computeHash = async (valueString: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(valueString + integrationKey);
      const hashBuffer = await crypto.subtle.digest("SHA-512", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    };

    // Strategy 1: Documented Paynow status update field order
    const documentedOrder = ["reference", "paynowreference", "amount", "status", "pollurl"];
    const documentedValues = documentedOrder
      .filter((key) => key in params)
      .map((key) => params[key])
      .join("");
    let computedHash = await computeHash(documentedValues);

    // Strategy 2: Concatenate values in the order received (form-encoded order)
    if (computedHash !== receivedHash?.toUpperCase()) {
      const receivedOrderValues = Object.entries(params)
        .filter(([key]) => key.toLowerCase() !== "hash")
        .map(([, value]) => value)
        .join("");
      computedHash = await computeHash(receivedOrderValues);
    }

    // Strategy 3: Alphabetical sort (original fallback)
    if (computedHash !== receivedHash?.toUpperCase()) {
      const sortedValues = Object.entries(params)
        .filter(([key]) => key.toLowerCase() !== "hash")
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, value]) => value)
        .join("");
      computedHash = await computeHash(sortedValues);
    }

    if (computedHash !== receivedHash?.toUpperCase()) {
      console.error("Hash verification failed");
      return new Response("Invalid hash", { status: 403 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Map Paynow status to our status
    const paynowStatus = params.status?.toLowerCase();
    let dbStatus: "pending" | "paid" | "failed" = "pending";

    if (paynowStatus === "paid" || paynowStatus === "delivered") {
      dbStatus = "paid";
    } else if (paynowStatus === "cancelled" || paynowStatus === "failed" || paynowStatus === "refunded") {
      dbStatus = "failed";
    }

    // Update payment by reference
    const reference = params.reference;

    // Idempotency: skip if payment already in terminal state
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("status")
      .eq("reference", reference)
      .single();

    if (existingPayment?.status === "paid" || existingPayment?.status === "failed") {
      return new Response("Already processed", { status: 200 });
    }
    const { error } = await supabase
      .from("payments")
      .update({
        status: dbStatus,
        paynow_reference: params.paynowreference || null,
        updated_at: new Date().toISOString(),
      })
      .eq("reference", reference);

    if (error) {
      console.error("Failed to update payment:", error);
      return new Response("DB error", { status: 500 });
    }

    // If payment succeeded, mark the livestock item as sold and create notification
    if (dbStatus === "paid") {
      const { data: payment } = await supabase
        .from("payments")
        .select("livestock_id, user_id, amount")
        .eq("reference", reference)
        .single();

      if (payment) {
        // Mark item as sold
        await supabase
          .from("livestock_items")
          .update({ status: "sold" })
          .eq("id", payment.livestock_id);

        // Notify buyer
        await supabase.from("notifications").insert({
          user_id: payment.user_id,
          type: "payment",
          title: "Payment Confirmed",
          message: `Your payment of $${payment.amount} has been confirmed.`,
          priority: "high",
        });

        // Notify seller
        const { data: item } = await supabase
          .from("livestock_items")
          .select("seller_id, title")
          .eq("id", payment.livestock_id)
          .single();

        if (item) {
          await supabase.from("notifications").insert({
            user_id: item.seller_id,
            type: "payment",
            title: "Payment Received",
            message: `Payment of $${payment.amount} received for ${item.title}.`,
            priority: "high",
          });
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
