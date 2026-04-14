# Auction Pilot — Architecture

System-of-record scaffold for the five observed auction states. Built 2026-04-14 on branch `feature/auction-pilot-v2`. Pitch surface for auction-operator outreach.

Not a livestock app. A transactional audit trail of physical asset ownership changes.

---

## 1. State machine

The five states observed at a physical auction (Harare, 2026-03-19 field visit), instrumented as first-class.

```mermaid
stateDiagram-v2
    [*] --> Registered: seller posts listing
    Registered --> Auctioned: winning bid accepted
    Auctioned --> Cleared: police officer approves
    Auctioned --> Blocked: police officer rejects
    Blocked --> Cleared: re-inspection passes
    Cleared --> Paid: Paynow confirms
    Cleared --> PaymentFailed: retry / fallback
    PaymentFailed --> Paid: recovery succeeds
    Paid --> Transferred: ownership event logged
    Transferred --> [*]

    note right of Cleared
      Regulatory gate.
      Physical verification by
      a policewoman on-site.
      Cannot be skipped.
    end note

    note right of Paid
      Retry + fallback handled
      by agent layer (out of
      pilot scope but wired).
    end note
```

---

## 2. Component architecture

```mermaid
flowchart TB
    subgraph Client["Client — React + Vite"]
        UI[/pilot route<br/>AuctionPilot.tsx/]
        Feed[Live Event Feed<br/>Realtime subscription]
    end

    subgraph Edge["Supabase Edge Functions — Deno"]
        RC[record-clearance<br/>POST /record-clearance]
        IP[initiate-payment<br/>existing]
        PW[payment-webhook<br/>existing]
    end

    subgraph DB["Supabase Postgres"]
        LI[(livestock_items)]
        B[(bids)]
        P[(payments)]
        CE[(clearance_events<br/>new)]
        OT[(ownership_transitions<br/>new, append-only)]
        RPC[[record_ownership_transition<br/>SECURITY DEFINER]]
    end

    subgraph Paynow["Paynow — external"]
        PN[Paynow API]
    end

    UI -->|POST clearance form| RC
    UI -->|read listings + derived state| LI
    UI -->|read bid history| B
    UI -->|read payment status| P
    UI -->|call RPC for transfer| RPC
    Feed <-->|Realtime WS| OT

    RC -->|service-role insert| CE
    RC -->|calls| RPC
    RPC -->|append row| OT

    UI -->|checkout redirect| IP
    IP --> PN
    PN -->|webhook| PW
    PW -->|status update| P
    PW -->|should call, not wired yet| RPC

    classDef newNode fill:#d4edda,stroke:#155724,color:#155724
    classDef existingNode fill:#e9ecef,stroke:#495057,color:#212529
    classDef externalNode fill:#fff3cd,stroke:#856404,color:#856404

    class CE,OT,RPC,RC,UI,Feed newNode
    class LI,B,P,IP,PW existingNode
    class PN externalNode
```

**Legend:** green = built in this pilot · grey = pre-existing · yellow = external.

**Known gap:** `payment-webhook` does not yet call `record_ownership_transition` on a successful payment confirmation — the `paid` state transition is currently logged client-side from the pilot page. Server-side wiring is the next commit.

---

## 3. Clearance sequence (single event, happy path)

```mermaid
sequenceDiagram
    autonumber
    actor Op as Auction Operator
    participant UI as AuctionPilot.tsx
    participant Edge as record-clearance
    participant Auth as Supabase Auth
    participant DB as Postgres
    participant RT as Realtime

    Op->>UI: Select listing, fill officer form, submit
    UI->>Edge: POST {livestock_id, status, officer_name, idempotency_key}
    Edge->>Auth: Verify caller JWT
    Auth-->>Edge: user_id
    Edge->>DB: Authz — caller is seller OR winning bidder?
    DB-->>Edge: yes
    Edge->>DB: SELECT clearance_events WHERE idempotency_key = ?
    alt Duplicate submission
        DB-->>Edge: existing row
        Edge-->>UI: 200 {clearance_id, idempotent: true}
    else New
        Edge->>DB: INSERT clearance_events (service-role)
        DB-->>Edge: clearance_id
        Edge->>DB: SELECT record_ownership_transition(...)
        DB->>DB: INSERT ownership_transitions (state=cleared)
        DB->>RT: NOTIFY ownership_transitions
        DB-->>Edge: transition_id
        Edge-->>UI: 201 {clearance_id, transition_id}
    end
    RT-->>UI: push new transition row
    UI->>UI: Advance stepper to "Cleared", refresh event feed
```

---

## 4. Schema relationships

```mermaid
erDiagram
    livestock_items ||--o{ bids : "has many"
    livestock_items ||--o{ payments : "has many"
    livestock_items ||--o{ clearance_events : "has many"
    livestock_items ||--o{ ownership_transitions : "has many"
    bids ||--o{ clearance_events : "referenced by"
    bids ||--o{ ownership_transitions : "referenced by"
    payments ||--o{ ownership_transitions : "referenced by"
    clearance_events ||--o{ ownership_transitions : "referenced by"
    profiles ||--o{ ownership_transitions : "from_owner"
    profiles ||--o{ ownership_transitions : "to_owner"

    livestock_items {
        uuid id PK
        text title
        text status
        uuid seller_id FK
    }
    bids {
        uuid id PK
        uuid livestock_id FK
        uuid user_id FK
        numeric amount
        boolean is_winner
    }
    payments {
        uuid id PK
        text reference UK
        text status
        text method
    }
    clearance_events {
        uuid id PK
        uuid livestock_id FK
        uuid bid_id FK
        text status
        text officer_name
        text district
        uuid idempotency_key
    }
    ownership_transitions {
        uuid id PK
        uuid livestock_id FK
        uuid from_owner_id FK
        uuid to_owner_id FK
        text state
        text event
        uuid bid_id FK
        uuid payment_id FK
        uuid clearance_id FK
    }
```

---

## 5. Trust & authorization model

| Write path | Who can write | Enforcement |
|---|---|---|
| `clearance_events` insert | Service role only (via `record-clearance` edge function) | RLS — no INSERT policy for authenticated users |
| `ownership_transitions` insert | Service role OR `record_ownership_transition` RPC | RLS + RPC authorization (caller must be from_owner, to_owner, or seller) |
| `livestock_items` / `bids` / `payments` | Existing policies (unchanged) | Pre-existing RLS |

| Read path | Who can read | Enforcement |
|---|---|---|
| `clearance_events` | Seller of referenced listing OR winning bidder | RLS SELECT policy |
| `ownership_transitions` | Named from_owner / to_owner / seller | RLS SELECT policy |
| Realtime subscription | Same as SELECT (RLS applies to Realtime) | Supabase RLS-aware Realtime |

**Hard invariants:**
- No `stack` field in error responses (leak P0 from April 14 audit — prevented).
- Malformed JSON → 400, not 500 (SEV-1 fix from commit `567fcee` — preserved).
- No CORS wildcard (SEV-1 fix from commit `921bc62` — preserved).
- Idempotency key on `clearance_events` prevents double-submit (matches pattern on `bids` and `payments`).

---

## 6. What this is and is not

**Is:**
- A system-of-record for the physical auction → settlement → ownership flow.
- Append-only, auditable, party-scoped.
- Demo scaffold — proves the state machine is instrumentable, not that the business is operational.

**Is not:**
- A production marketplace.
- A replacement for the auction operator.
- Multi-PSP yet (Paynow only — second rail is a validation requirement, not a scaling one).
- Registrar of record for the Zimbabwe Department of Veterinary Services (regulatory integration is out of scope — regulation sits as a probabilistic filter with discretionary enforcement, captured as an attribute not a gate).

---

## 7. Open wiring (known gaps)

1. `payment-webhook` → `record_ownership_transition(state='paid')` — currently logged client-side; needs server-side call on confirmed webhook.
2. Second executor for true dependency inversion — Pesepay or Flutterwave stub so authorship claim holds.
3. Transport/logistics layer — field research flagged this as the next adjacent state (physical custody handoff). Out of pilot scope, noted for phase 2.
4. Veterinary certification integration — regulatory layer to be modeled as optional state attribute, not mandatory gate.

---

## 8. Related artifacts

- [deliverables/week-5/direction-analysis-2026-04-14.md](../deliverables/week-5/direction-analysis-2026-04-14.md) — VC-style direction analysis and why auction-operator-as-root-of-truth was selected.
- [AGENTIC.md](../AGENTIC.md) — the broader agent infrastructure demo (parallel pitch to Paynow).
- [supabase/schema.sql](../supabase/schema.sql#L720) (lines 720+) — schema source.
- [supabase/functions/record-clearance/index.ts](../supabase/functions/record-clearance/index.ts) — clearance event writer.
- [src/app/components/AuctionPilot.tsx](../src/app/components/AuctionPilot.tsx) — pilot page + event feed.
