# Internship Project Brief

**Project:** Evaluating Paynow Developer Experience Through a Marketplace Prototype
**Duration:** 6 Weeks
**Dates:** March 12 – April 23, 2026

---

## 1. Project Overview

The objective of this internship project is to evaluate the developer experience (DX) of the Paynow payment platform by integrating Paynow into a simple digital marketplace prototype.

The intern will build a lightweight livestock marketplace prototype that enables:

- Livestock listings
- Browsing listings
- Purchasing livestock
- Completing payments using Paynow

This prototype will serve as a practical environment to evaluate the developer experience of Paynow compared to other payment platforms.

The primary output of the project will be actionable insights and recommendations to improve Paynow's developer experience, based on hands-on integration and benchmarking.

---

## 2. Project Goals

The internship aims to achieve three main goals:

1. **Understand Real Livestock Market Workflows**
   Study how livestock transactions currently happen in auction markets and informal trading environments.

2. **Integrate Paynow Into a Realistic Marketplace Scenario**
   Build a prototype that simulates a livestock purchase flow and uses Paynow for payment processing.

3. **Evaluate Paynow Developer Experience**
   Benchmark Paynow against other payment platforms and identify opportunities to improve:
   - Documentation
   - Integration simplicity
   - Debugging experience
   - Sandbox testing
   - Developer onboarding

---

## 3. Technical Scope

To keep the project manageable within the internship period, the prototype will include only core marketplace features.

### Marketplace Features

The prototype should support:

- Livestock listings
- Browsing available livestock
- Viewing listing details
- Initiating purchase

### Payment Features

The prototype should demonstrate:

- Payment initiation via Paynow
- Mobile money and web payment flows
- Transaction status tracking
- Handling successful payments
- Handling failed payments
- Handling expired transactions
- Paynow callback/webhook handling

### Excluded Features

To reduce complexity, the following are not required:

- Live bidding
- Auction timers
- Real-time updates
- Messaging between buyers and sellers
- Production-level security

The prototype is intended for demonstration and DX evaluation, not production use.

---

## 4. Technical Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework (component-based architecture) |
| **TypeScript** | Type safety across the entire frontend codebase |
| **Vite** | Build tool and dev server (fast HMR, optimized builds) |
| **Tailwind CSS** | Utility-first CSS framework for responsive, mobile-first design |
| **shadcn/ui** | Pre-built accessible UI components built on Radix primitives |
| **Lucide React** | Consistent icon library (line-style icons) |

### State Management

| Technology | Purpose |
|------------|---------|
| **TanStack Query (React Query)** | Server state management — data fetching, caching, synchronization, and background refetching |
| **Zustand** | Client state management — lightweight store for auth state and UI state |

### Backend & Infrastructure

| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend-as-a-Service providing the full backend layer |
| **PostgreSQL (via Supabase)** | Relational database with Row-Level Security (RLS) policies for data access control |
| **Supabase Auth** | User authentication (email/password, session management) |
| **Supabase Storage** | File storage for livestock images |
| **Supabase Realtime** | WebSocket-based real-time subscriptions (bid updates, notifications) |
| **Supabase Edge Functions (Deno)** | Serverless functions for Paynow payment initiation, webhook handling, and auction management |

### Payments

| Technology | Purpose |
|------------|---------|
| **Paynow** | Payment gateway — supports EcoCash, OneMoney, and web (card) payments |
| **Supabase Edge Functions** | Server-side Paynow API calls (initiate payment, process webhooks, poll status) |

### Development & Tooling

| Technology | Purpose |
|------------|---------|
| **Node.js / npm** | Package management and script running |
| **ESLint** | Code linting and style enforcement |
| **Git / GitHub** | Version control and collaboration |

### Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│         React 18 + TypeScript + Vite                │
│         Tailwind CSS + shadcn/ui                    │
│         TanStack Query + Zustand                    │
└──────────────────────┬──────────────────────────────┘
                       │  HTTPS
┌──────────────────────▼──────────────────────────────┐
│                   Supabase                           │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐            │
│  │  Auth    │  │ Storage │  │ Realtime │            │
│  └─────────┘  └─────────┘  └──────────┘            │
│  ┌──────────────────────────────────────┐           │
│  │  PostgreSQL + Row-Level Security     │           │
│  └──────────────────────────────────────┘           │
│  ┌──────────────────────────────────────┐           │
│  │  Edge Functions (Deno)               │           │
│  │  • initiate-payment                  │           │
│  │  • payment-webhook                   │           │
│  │  • end-auctions                      │           │
│  └───────────────┬──────────────────────┘           │
└──────────────────┼──────────────────────────────────┘
                   │  HTTPS
┌──────────────────▼──────────────────────────────────┐
│                 Paynow API                           │
│  • EcoCash (USSD *151#)                             │
│  • OneMoney                                         │
│  • Web payments (card)                              │
└─────────────────────────────────────────────────────┘
```

### Why This Stack?

- **No traditional backend server needed** — Supabase provides auth, database, storage, and serverless functions out of the box, reducing development time significantly.
- **Type safety end-to-end** — TypeScript catches errors at compile time rather than at runtime.
- **Mobile-first by default** — Tailwind CSS utility classes make responsive design straightforward; shadcn/ui components are accessible and mobile-friendly.
- **Real-time capable** — Supabase Realtime enables live updates without additional WebSocket infrastructure.
- **Fast development iteration** — Vite provides near-instant hot module replacement during development.
- **Secure by design** — PostgreSQL Row-Level Security policies enforce data access rules at the database level, independent of application code.

---

## 5. Developer Experience Benchmarking

The intern will compare Paynow with the following payment platforms:

- Stripe
- Paystack
- Flutterwave

### Evaluation Categories

Each platform will be evaluated across the following dimensions:

- Developer documentation quality
- SDK usability
- Sandbox testing experience
- Error message clarity
- Developer onboarding experience

### Suggested Evaluation Metrics

To ensure consistency, the intern should measure or estimate:

| Metric | Example Measurement |
|--------|-------------------|
| Time to first successful payment | minutes |
| Documentation clarity | 1–5 score |
| SDK usability | 1–5 score |
| Error debugging difficulty | 1–5 score |
| Sandbox reliability | 1–5 score |

Where possible, findings should be supported with:

- Screenshots
- Code snippets
- Integration observations

---

## 6. Project Timeline

### Week 1–2: Research and Planning

**March 12 – March 25**

#### Activities

**Livestock Market Research**

Observe or interview participants in livestock markets to understand:

- How livestock is listed
- How pricing is determined
- How buyers choose animals
- How transactions are finalized
- Current payment methods

If physical visits are not possible, interviews or secondary research can be used.

**Developer Experience Benchmark Setup**

Review documentation and onboarding flows for:

- Paynow
- Stripe
- Paystack
- Flutterwave

**Product Design**

Design the basic marketplace flows:

- Listing flow
- Browsing flow
- Purchase flow
- Paynow payment flow

#### Deliverables

- Livestock market research summary
- Marketplace system flow diagrams
- Initial DX benchmarking notes

---

### Week 3–4: Prototype Development & Paynow Integration

**March 26 – April 8**

#### Activities

**Marketplace Prototype Development**

Build a simple prototype supporting:

- Listing livestock
- Browsing listings
- Viewing listing details
- Initiating purchase

**Paynow Payment Integration**

Implement the full payment lifecycle, including:

- Payment initiation
- Payment status tracking
- Callback/webhook handling
- Failed or expired payments

**Developer Experience Observation**

Document the Paynow integration experience, including:

- Documentation clarity
- Integration challenges
- Debugging experience
- API design observations

#### Deliverables

- Working prototype with Paynow payment flow
- Paynow integration notes
- Initial DX benchmarking comparison

---

### Week 5: Testing & Feedback

**April 9 – April 15**

#### Activities

**End-to-End Payment Testing**

Test scenarios including:

- Successful payments
- Failed payments
- Mobile money flows
- Network interruptions
- Delayed payment confirmations
- Reversals & refunds

**Stakeholder Demonstrations**

Present the prototype to:

- Developers
- Product managers
- Users familiar with livestock markets

Collect structured feedback.

**Prototype Improvements**

Improve the prototype based on:

- Usability feedback
- Payment clarity
- Error handling

#### Deliverables

- Payment test results
- Feedback summary
- Updated prototype

---

### Week 6: Final Deliverables & Presentation

**April 16 – April 23**

#### Activities

**Final Paynow DX Report**

Prepare a report including:

- Benchmarking results
- Developer journey analysis
- Integration challenges
- Recommended improvements

**Documentation**

Provide documentation including:

- Project README
- Architecture overview
- Paynow integration notes

**Presentation**

Prepare a short presentation summarizing:

- Research insights
- Prototype development
- Paynow integration experience
- Recommended DX improvements

---

## 7. Final Deliverables

By the end of the internship, the intern should deliver:

- Marketplace prototype demonstrating Paynow integration
- Paynow Developer Experience Benchmark Report
- Livestock market research summary
- At least five actionable recommendations for improving Paynow developer experience
- A final presentation summarizing the project

---

## 8. Mentorship and Review Checkpoints

To ensure progress and support learning, the following reviews should be scheduled:

**Week 1 Review**
- Research findings
- Architecture plan

**Week 3 Review**
- Prototype progress
- Paynow integration approach

**Week 5 Review**
- DX insights
- Testing results

---

## 9. Expected Outcomes

This project should produce:

- A practical demonstration of Paynow in a marketplace environment
- Insights into how developers experience Paynow integration
- Actionable recommendations for improving Paynow's developer experience for the Zimbabwean market
