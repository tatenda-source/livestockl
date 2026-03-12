# ZimLivestock Launch Readiness Report

## Stress Test Results Summary

| Agent | Score | Verdict |
|---|---|---|
| Red Team Security | **7/10** | Most attacks blocked. 2 HIGH issues fixed post-test. |
| Load & Concurrency | **5.5/10** | Handles casual use. Cracks at ~200 concurrent users. |
| Real-World Simulation | **3.5/10** | Not ready for Zimbabwe's network conditions. |

**Combined Launch Readiness: 5.3/10 -- NOT READY for production launch.**

The data integrity layer is solid. The gap is network resilience and mobile optimization.

---

## Security (Red Team) -- 7/10

### BLOCKED (No Exploits Found)

| Attack | Protection |
|---|---|
| Modify payment amount | Server-side `Math.round(winningBid.amount * 1.05)` verification |
| Pay for auction not won | `is_winner = true` check in Edge Function |
| Set payment `status = paid` | No RLS UPDATE policy on payments |
| Double-spend payments | Partial unique index + webhook `.eq("status", "pending")` |
| Bid on own listing | `place_bid` function checks `seller_id = p_user_id` |
| Bid after auction ended | `end_time <= now()` check with auto-end |
| Manipulate `current_bid`/`bid_count` | RLS `WITH CHECK` prevents field changes |
| Extend `end_time` | RLS lock + server-side trigger |
| Set `verified = true` on profile | RLS `WITH CHECK` prevents privilege escalation |
| Forge webhook signature | SHA-512 hash verification with integration key |
| Replay webhook | Atomic `.eq("status", "pending")` prevents reprocessing |
| Session forgery via localStorage | Server-side JWT validation on initialize |
| Read other users' conversations | RLS participant check |
| Upload to another user's storage | `auth.uid()::text = foldername` check |
| XSS via user content | React auto-escapes all JSX interpolation |

### FIXED DURING TESTING (Were HIGH, Now Resolved)

| Issue | Fix Applied |
|---|---|
| Seller could delete listing with active bids via direct API | RLS DELETE now requires `bid_count = 0 AND status = 'active'` |
| Recipients could tamper message content | Split into sender/recipient UPDATE policies with column locks |
| Advisory lock leak in `end_expired_auctions` | Switched to `pg_try_advisory_xact_lock` (auto-releases) |
| Anonymous view count inflation | Added `auth.uid() IS NULL` guard |

### REMAINING MEDIUM/LOW Issues

| Issue | Severity | Notes |
|---|---|---|
| No rate limiting anywhere | Medium | Bids, messages, view counts have no throttle |
| All profile fields publicly readable (email, phone) | Medium | Consider a restricted view |
| Webhook uses 3 hash strategies (overly permissive) | Low | Use only documented Paynow field order |
| Messages/conversations queries have no `.limit()` | Low | Add pagination |

---

## Load & Concurrency -- 5.5/10

### Scenario Analysis

| Scenario | Breaking Point | Risk | Key Issue |
|---|---|---|---|
| 1000 users browsing | ~500-800 concurrent | Medium | No cursor pagination, join overhead |
| 200 simultaneous bids | ~50-100 before latency | Medium | Row lock serialization, realtime broadcast storm |
| 500 payment requests | ~20-50 before Paynow fails | **Critical** | Orphan records block retries, cold starts |
| 10,000 realtime events | ~100 msg/min per conversation | **High** | Messages had no debounce (now fixed) |
| 50+ auction expirations | ~100-200 before delays | **High** | Advisory lock leak (now fixed), batch limit |

### Critical Concurrency Findings

**1. Payment Orphan Records (Critical)**
If client crashes after creating payment record but before Edge Function call, the orphaned `pending` record blocks all future payment attempts due to the unique index. No cleanup mechanism exists.

**2. Connection Pool Exhaustion (High)**
Each Edge Function invocation creates 3-4 Supabase clients. Under surge, the PgBouncer pool (~60-200 connections) can be exhausted.

**3. Hot Row Contention (Medium)**
Popular auction items are simultaneously locked by `place_bid`, updated by `increment_view_count`, and read by every listing query.

---

## Real-World Zimbabwe Conditions -- 3.5/10

### Critical Gaps

**1. No Persistent Cache or Service Worker (Score: 0/10)**
- No `persistQueryClient` configured -- closing browser loses all cached data
- No PWA manifest, no service worker
- Every app restart = full re-download on 2G

**2. Unoptimized Bundle & Images (Score: 2/10)**
- Main bundle: ~513KB gzipped (80-130 seconds on 2G)
- No image resizing, no WebP, no blur-up placeholders
- Each livestock photo potentially 1-3MB raw
- Both MUI and Radix UI included (massive redundancy)

**3. Orphaned Payments with Infinite Polling (Score: 3/10)**
- Payment status polls every 5s with NO timeout (180 requests over 15 min)
- No Paynow `pollurl` fallback for client-side status checking
- No server-side cron to expire stale pending payments
- No push notification when payment resolves

**4. No Offline Mutation Queue (Score: 2/10)**
- Bids/messages fail immediately when offline
- No optimistic UI updates
- Realtime subscriptions don't auto-reconnect after extended offline

### Additional Gaps

| Issue | Severity |
|---|---|
| Touch targets below 44x44px minimum | High |
| HTML title says "Build According to Specifications" | High |
| No safe-area-inset for notched phones | Medium |
| 7 bottom nav items (too many for small screens) | Medium |
| Number input inconsistency across mobile browsers | Medium |
| No stale data indicators ("updated X min ago") | Medium |
| Auth error handling clears user too aggressively | Medium |

---

## What Works Well

The app has genuinely strong foundations:

1. **Atomic bid placement** -- `FOR UPDATE` row locking prevents all race conditions
2. **Server-side payment verification** -- amount, auction win, listing status all validated
3. **RLS is comprehensive** -- every table has appropriate policies with `WITH CHECK`
4. **Webhook idempotency** -- atomic conditional update prevents double-processing
5. **Code splitting** -- all routes lazy-loaded
6. **Realtime debouncing** -- bids and messages both debounced at 1 second
7. **Auth security** -- JWT validation, session persistence, server-side user verification
8. **Database constraints** -- unique indexes, CHECK constraints, foreign keys with CASCADE

---

## Launch Blocker Priorities

### P0 -- Must Fix Before Launch

| # | Issue | Impact | Effort |
|---|---|---|---|
| 1 | Add payment expiry cron (expire pending > 1hr) | Users get permanently stuck | 2 hours |
| 2 | Add max polling duration (30 min) + manual retry | Infinite requests, dead UX | 1 hour |
| 3 | Fix HTML title to "ZimLivestock" | Looks broken/unprofessional | 5 minutes |
| 4 | Add image optimization (Supabase transforms or CDN) | App unusable on 2G | 3 hours |
| 5 | Add PWA manifest + service worker (`vite-plugin-pwa`) | No install, no offline assets | 3 hours |

### P1 -- Fix Within First Week

| # | Issue | Impact | Effort |
|---|---|---|---|
| 6 | Add `persistQueryClient` with IndexedDB | Cache lost on every app restart | 2 hours |
| 7 | Configure Vite `manualChunks` for bundle splitting | Slow initial load | 1 hour |
| 8 | Add rate limiting on bids/messages | Bot abuse vector | 4 hours |
| 9 | Increase touch targets to 44x44px minimum | Hard to tap on mobile | 2 hours |
| 10 | Add safe-area-inset-bottom to fixed nav | Obscured on notched phones | 30 min |

### P2 -- Fix Within First Month

| # | Issue | Impact | Effort |
|---|---|---|---|
| 11 | Restrict publicly readable profile fields | Privacy concern | 2 hours |
| 12 | Add skeleton loading screens | Poor perceived performance | 3 hours |
| 13 | Add offline mutation queue | Bids/messages fail when offline | 4 hours |
| 14 | Denormalize seller name into listings | Eliminate join query | 2 hours |
| 15 | Add Supabase Realtime reconnection on `online` event | Silent subscription death | 2 hours |

---

## Final Verdict

```
SECURITY:       ████████░░  7/10  -- Production-grade after fixes
LOAD:           █████░░░░░  5.5/10 -- OK for <200 users, needs work for scale
REAL-WORLD:     ███░░░░░░░  3.5/10 -- Not ready for Zimbabwe conditions
                ─────────────────
OVERALL:        █████░░░░░  5.3/10 -- NOT READY
```

**The system will NOT survive production in Zimbabwe without P0 fixes.**

The data layer is rock-solid. The security is good. But a livestock farmer in Mash East on 2G with load shedding will never get past the loading screen. Fix the 5 P0 items (estimated 9 hours of work) and the app becomes launchable for early adopters.
