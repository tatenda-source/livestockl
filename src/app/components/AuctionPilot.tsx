// AuctionPilot — Demo page for the 5-state ownership transfer machine.
// Route: /pilot. This is the pitch artifact shown to auction operators.
// Depends on pilot tables (clearance_events, ownership_transitions) and
// the record-clearance edge function — if they're not migrated yet we
// degrade to a friendly message instead of crashing.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { CheckCircle2, Circle, Loader2, ShieldCheck, ArrowRight, AlertTriangle } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase";
import { useLivestockList } from "../../hooks/useLivestock";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";

type StateKey = "registered" | "auctioned" | "cleared" | "paid" | "transferred";

const STATES: { key: StateKey; label: string; blurb: string }[] = [
  { key: "registered", label: "Registered", blurb: "animal in the catalogue" },
  { key: "auctioned", label: "Auctioned", blurb: "winning bid accepted" },
  { key: "cleared", label: "Cleared", blurb: "police clearance recorded" },
  { key: "paid", label: "Paid", blurb: "Paynow settlement confirmed" },
  { key: "transferred", label: "Transferred", blurb: "ownership audit-logged" },
];

const STATE_BADGE: Record<StateKey, string> = {
  registered: "bg-slate-100 text-slate-700",
  auctioned: "bg-amber-100 text-amber-800",
  cleared: "bg-blue-100 text-blue-800",
  paid: "bg-emerald-100 text-emerald-800",
  transferred: "bg-violet-100 text-violet-800",
};

interface Transition {
  id: string;
  livestock_id: string;
  state: StateKey;
  event: string | null;
  from_owner_id: string | null;
  to_owner_id: string | null;
  created_at: string;
}

interface Clearance {
  id: string;
  livestock_id: string;
  status: "pending" | "approved" | "blocked";
  officer_name: string;
  created_at: string;
}

interface LivestockRow {
  id: string;
  title: string;
  status: string;
  current_bid: number;
  bid_count: number;
  end_time: string;
  seller_id: string;
}

// Inline hook — pilot-specific, not worth promoting. Pulls the latest
// winning bid + latest payment + latest clearance for the selected item
// so we can derive the current state machine position.
function usePilotContext(livestockId: string | undefined) {
  return useQuery({
    queryKey: ["pilot-context", livestockId],
    enabled: !!livestockId && isSupabaseConfigured,
    refetchInterval: 10_000,
    queryFn: async () => {
      const [bidRes, payRes, clearRes] = await Promise.all([
        supabase
          .from("bids")
          .select("id, amount, user_id, is_winner, created_at")
          .eq("livestock_id", livestockId!)
          .eq("is_winner", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("payments")
          .select("id, status, amount, created_at")
          .eq("livestock_id", livestockId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase.from as any)("clearance_events")
          .select("id, status, officer_name, created_at")
          .eq("livestock_id", livestockId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // 42P01 = undefined_table — surface so UI can show migration hint.
      const missingPilotTables =
        clearRes?.error?.code === "42P01" || /clearance_events/.test(clearRes?.error?.message || "");

      return {
        winnerBid: bidRes.data || null,
        latestPayment: payRes.data || null,
        latestClearance: (clearRes.data as Clearance | null) || null,
        missingPilotTables,
      };
    },
  });
}

function useTransitions(livestockId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pilot-transitions", livestockId],
    enabled: !!livestockId && isSupabaseConfigured,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("ownership_transitions")
        .select("id, livestock_id, state, event, from_owner_id, to_owner_id, created_at")
        .eq("livestock_id", livestockId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        if (error.code === "42P01") return { rows: [] as Transition[], missing: true };
        throw error;
      }
      return { rows: (data || []) as Transition[], missing: false };
    },
  });

  useEffect(() => {
    if (!livestockId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`ownership_transitions:${livestockId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ownership_transitions",
          filter: `livestock_id=eq.${livestockId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pilot-transitions", livestockId] });
          queryClient.invalidateQueries({ queryKey: ["pilot-context", livestockId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [livestockId, queryClient]);

  return query;
}

function deriveCurrentState(
  item: LivestockRow | null,
  ctx: ReturnType<typeof usePilotContext>["data"],
  transitions: Transition[],
): StateKey {
  // Prefer explicit transitions when present — they're the source of truth.
  const latestTransition = transitions[0];
  if (latestTransition) return latestTransition.state;

  if (!item) return "registered";

  const paid = ctx?.latestPayment?.status === "paid";
  const cleared = ctx?.latestClearance?.status === "approved";
  const hasWinner = !!ctx?.winnerBid;
  const ended = item.status === "ended" || item.status === "sold" || new Date(item.end_time).getTime() <= Date.now();

  if (paid) return "paid";
  if (cleared) return "cleared";
  if (hasWinner || ended) return "auctioned";
  return "registered";
}

export function AuctionPilot() {
  const { data: pages, isLoading: loadingList } = useLivestockList();
  const items = useMemo<LivestockRow[]>(
    () => (pages?.pages?.flat() || []).slice(0, 30).map((i: any) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      current_bid: Number(i.current_bid || 0),
      bid_count: Number(i.bid_count || 0),
      end_time: i.end_time,
      seller_id: i.seller_id,
    })),
    [pages],
  );

  // Demo deep-link: ?id=<uuid> auto-selects a specific listing on load so
  // the trace is populated the moment the page renders. Falls through to
  // first available listing when no param is present.
  const initialId = (() => {
    if (typeof window === "undefined") return undefined;
    const p = new URLSearchParams(window.location.search).get("id");
    return p && /^[0-9a-f-]{36}$/i.test(p) ? p : undefined;
  })();
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId);
  useEffect(() => {
    if (!selectedId && items.length) setSelectedId(items[0].id);
  }, [items, selectedId]);

  const selected = items.find(i => i.id === selectedId) || null;
  const ctxQuery = usePilotContext(selectedId);
  const transitionsQuery = useTransitions(selectedId);
  const transitions = transitionsQuery.data?.rows || [];
  const pilotTablesMissing =
    ctxQuery.data?.missingPilotTables || transitionsQuery.data?.missing || false;
  const currentState = deriveCurrentState(selected, ctxQuery.data, transitions);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-primary" />
          Auction Pilot — Ownership State Machine
        </h1>
        <p className="text-muted-foreground text-sm md:text-base mt-1">
          Digitized auction flow for Zimbabwe livestock transfer. Lower fees, verified clearance, full audit.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 flex gap-3 items-start text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Demo mode — Supabase not configured.</div>
              The state machine UI is fully interactive, but nothing will persist. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to hit the real tables.
            </div>
          </CardContent>
        </Card>
      )}

      {pilotTablesMissing && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 flex gap-3 items-start text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Pilot tables not yet migrated.</div>
              Run <code>supabase db push</code> to apply the <code>clearance_events</code> and <code>ownership_transitions</code> schema before using this demo end-to-end.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stepper */}
      <Card>
        <CardContent className="pt-6">
          <StateStepper current={currentState} />
        </CardContent>
      </Card>

      {/* Guarantee line — single sentence above the proof surface */}
      <div className="border-l-2 border-primary pl-4 py-1">
        <p className="text-sm md:text-base text-foreground">
          Every state change is recorded, ordered, and verifiable.
          None can be skipped, none can be duplicated.
          This is the audit a Paynow settlement sits inside.
        </p>
      </div>

      {/* System event trace — the proof mechanism, rendered first */}
      <EventFeed transitions={transitions} loading={transitionsQuery.isLoading} />

      {/* Controller — full width, secondary to the trace */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Controller</CardTitle>
          <CardDescription>Pick a listing, then advance the state machine.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Livestock item</Label>
            {loadingList ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading listings…
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No active listings available.</div>
            ) : (
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an item…" />
                </SelectTrigger>
                <SelectContent>
                  {items.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title} — US${item.current_bid.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selected && (
            <StateActions
              item={selected}
              state={currentState}
              ctx={ctxQuery.data}
              pilotTablesMissing={pilotTablesMissing}
              onRefetch={() => {
                ctxQuery.refetch();
                transitionsQuery.refetch();
              }}
            />
          )}
        </CardContent>
      </Card>


      {/* Footer pitch callout */}
      <Card className="bg-gradient-to-br from-primary/5 to-emerald-50 border-primary/20">
        <CardContent className="pt-6 text-sm md:text-base">
          <div className="font-semibold text-base md:text-lg mb-1">Half the fee. Same trust. Full audit.</div>
          Current auction house fee: <b>12%</b> (5% seller + 7% buyer). This pilot targets <b>5–6%</b> through process compression — police clearance and ownership transfer happen in-app, not in a queue.
        </CardContent>
      </Card>
    </div>
  );
}

function StateStepper({ current }: { current: StateKey }) {
  const currentIdx = STATES.findIndex(s => s.key === current);
  return (
    <ol className="flex flex-col md:flex-row md:items-start gap-4 md:gap-0">
      {STATES.map((s, idx) => {
        const status: "complete" | "current" | "pending" =
          idx < currentIdx ? "complete" : idx === currentIdx ? "current" : "pending";
        const isClearance = s.key === "cleared";
        return (
          <li key={s.key} className="flex md:flex-col md:flex-1 items-start md:items-center gap-3 md:gap-2 relative">
            <div className="flex md:flex-col items-center gap-3 md:gap-2">
              <div
                className={
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 " +
                  (status === "complete"
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : status === "current"
                    ? "bg-blue-500 border-blue-500 text-white animate-pulse"
                    : "bg-background border-muted-foreground/30 text-muted-foreground")
                }
              >
                {status === "complete" ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
              </div>
              {idx < STATES.length - 1 && (
                <div className={"hidden md:block h-0.5 w-full mt-5 absolute top-0 left-1/2 " + (status === "complete" ? "bg-emerald-500" : "bg-muted-foreground/20")} style={{ zIndex: -1 }} />
              )}
            </div>
            <div className="md:text-center">
              <div className="font-semibold text-sm flex items-center gap-1.5">
                {idx + 1}. {s.label}
                {isClearance && <Badge variant="secondary" className="text-[10px]">differentiator</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">{s.blurb}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StateActions({
  item,
  state,
  ctx,
  pilotTablesMissing,
  onRefetch,
}: {
  item: LivestockRow;
  state: StateKey;
  ctx: ReturnType<typeof usePilotContext>["data"];
  pilotTablesMissing: boolean;
  onRefetch: () => void;
}) {
  const queryClient = useQueryClient();
  const [officerName, setOfficerName] = useState("");
  const [officerBadge, setOfficerBadge] = useState("");
  const [district, setDistrict] = useState("");
  const [notes, setNotes] = useState("");
  const [clearanceStatus, setClearanceStatus] = useState<"approved" | "pending" | "blocked">("approved");
  const [submitting, setSubmitting] = useState(false);
  // One idempotency key per form instance. Retries of the same submission
  // (double-click, network retry) hit the server with the same key and are
  // deduped via the (livestock_id, idempotency_key) unique index. Rotated
  // after a successful submit so the next genuinely-new clearance gets a
  // fresh key.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  async function submitClearance() {
    if (!officerName || !officerBadge || !district) {
      toast.error("Officer name, badge, and district are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("record-clearance", {
        body: {
          livestock_id: item.id,
          bid_id: ctx?.winnerBid?.id || null,
          status: clearanceStatus,
          officer_name: officerName,
          officer_badge: officerBadge,
          district,
          notes: notes || null,
          idempotency_key: idempotencyKeyRef.current,
        },
      });
      if (error) throw error;
      toast.success("Clearance recorded");
      setOfficerName(""); setOfficerBadge(""); setDistrict(""); setNotes("");
      idempotencyKeyRef.current = crypto.randomUUID();
      onRefetch();
      queryClient.invalidateQueries({ queryKey: ["pilot-transitions", item.id] });
      if (data && (data as any).transition_id) {
        console.info("record-clearance transition_id:", (data as any).transition_id);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to record clearance");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmTransfer() {
    setSubmitting(true);
    try {
      const { error } = await (supabase.rpc as any)("record_ownership_transition", {
        p_livestock_id: item.id,
        p_state: "transferred",
        p_event: "Ownership transferred to buyer",
        p_from_owner: item.seller_id,
        p_to_owner: ctx?.winnerBid?.user_id || null,
        p_bid_id: ctx?.winnerBid?.id || null,
        p_payment_id: ctx?.latestPayment?.id || null,
      });
      if (error) throw error;
      toast.success("Ownership transfer logged");
      onRefetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record transfer");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "registered") {
    return (
      <div className="text-sm text-muted-foreground border rounded-md p-4">
        No winning bid yet. In production, auctions close automatically at <code>end_time</code>.
        <Button className="mt-3" variant="outline" size="sm" disabled>
          Simulate auction close (disabled in demo)
        </Button>
      </div>
    );
  }

  if (state === "auctioned") {
    return (
      <div className="space-y-3">
        <div className="text-sm flex items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800">Next: Clearance</Badge>
          Record the police clearance to proceed.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="officer-name">Officer name</Label>
            <Input id="officer-name" value={officerName} onChange={e => setOfficerName(e.target.value)} placeholder="Const. J. Moyo" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="officer-badge">Badge #</Label>
            <Input id="officer-badge" value={officerBadge} onChange={e => setOfficerBadge(e.target.value)} placeholder="ZRP-12345" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="district">District</Label>
            <Input id="district" value={district} onChange={e => setDistrict(e.target.value)} placeholder="Harare Central" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={clearanceStatus} onValueChange={(v: any) => setClearanceStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Clearance confirmed against stock register…" />
        </div>
        <Button onClick={submitClearance} disabled={submitting || pilotTablesMissing}>
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</> : "Record Police Clearance"}
        </Button>
      </div>
    );
  }

  if (state === "cleared") {
    return (
      <div className="space-y-2">
        <div className="text-sm flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-800">Next: Payment</Badge>
          Clearance approved. Proceed to Paynow settlement.
        </div>
        <Link to={`/checkout/${item.id}`}>
          <Button>Go to Checkout <ArrowRight className="w-4 h-4" /></Button>
        </Link>
      </div>
    );
  }

  if (state === "paid") {
    return (
      <div className="space-y-2">
        <div className="text-sm flex items-center gap-2">
          <Badge className="bg-emerald-100 text-emerald-800">Next: Transfer</Badge>
          Payment settled. Confirm ownership transfer.
        </div>
        <Button onClick={confirmTransfer} disabled={submitting || pilotTablesMissing}>
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</> : "Confirm Transfer"}
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-emerald-200 bg-emerald-50 rounded-md p-4 text-sm">
      <div className="font-semibold text-emerald-800 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" /> Transfer complete.
      </div>
      <div className="text-emerald-700 mt-1">
        This animal's ownership history is now audit-logged end to end.
      </div>
    </div>
  );
}

const STATE_TRACE_COLOR: Record<StateKey, string> = {
  registered: "text-zinc-300",
  auctioned: "text-amber-300",
  cleared: "text-emerald-300",
  paid: "text-cyan-300",
  transferred: "text-violet-300",
};

function EventFeed({ transitions, loading }: { transitions: Transition[]; loading: boolean }) {
  // Render newest-last so the trace reads top-to-bottom like a system log.
  const ordered = [...transitions].reverse();
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950 text-zinc-100 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900">
        <div className="font-mono text-[11px] tracking-widest text-zinc-400">SYSTEM EVENT TRACE</div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          realtime
        </div>
      </div>
      <pre className="font-mono text-[12px] leading-relaxed px-3 py-3 m-0 overflow-x-auto whitespace-pre">
{loading ? (
          <span className="text-zinc-500">loading trace…</span>
        ) : ordered.length === 0 ? (
          <span className="text-zinc-500">// no transitions yet — advance the state machine to populate</span>
        ) : (
          ordered.map(t => {
            const d = new Date(t.created_at);
            const ts = d.toISOString().slice(11, 19);
            const state = t.state.toUpperCase().padEnd(12);
            const actor = (t.from_owner_id || t.to_owner_id)
              ? `  ${(t.from_owner_id || "--").slice(0, 8)}→${(t.to_owner_id || "--").slice(0, 8)}`
              : "";
            return (
              <div key={t.id}>
                <span className="text-zinc-500">[{ts}]</span>{" "}
                <span className={STATE_TRACE_COLOR[t.state]}>{state}</span>{" "}
                <span className="text-zinc-200">{t.event || "(no description)"}</span>
                <span className="text-zinc-600">{actor}</span>
              </div>
            );
          })
        )}
      </pre>
    </div>
  );
}
