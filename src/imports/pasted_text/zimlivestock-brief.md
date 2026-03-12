# ZimLivestock — Designer Brief & App Flow

> Mobile-first livestock auction marketplace for Zimbabwe.
> Farmers list animals, buyers browse & bid, winners pay via Paynow (EcoCash / OneMoney / web).

---

## App Flow Diagram

```
                          ┌─────────────┐
                          │  SPLASH /   │
                          │  LOADING    │
                          └──────┬──────┘
                                 │
                          ┌──────▼──────┐
                     No   │ Logged in?  │  Yes
                   ┌──────┤             ├──────┐
                   │      └─────────────┘      │
                   │                           │
            ┌──────▼──────┐             ┌──────▼──────┐
            │  AUTH SCREEN │             │  HOME FEED  │
            │  Login/Signup│             │  (Default)  │
            └──────┬──────┘             └──────┬──────┘
                   │                           │
                   └───────────┬───────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   BOTTOM NAV BAR    │
                    │                     │
                    │  Home  Post  My     │
                    │  Feed  Item  List   │
                    │       Notif  Pay    │
                    └──┬───┬───┬───┬───┬──┘
                       │   │   │   │   │
         ┌─────────────┘   │   │   │   └──────────────┐
         │                 │   │   │                   │
  ┌──────▼──────┐   ┌─────▼───▼───▼─────┐    ┌───────▼───────┐
  │  HOME FEED  │   │  (other tabs —    │    │   PAYMENT     │
  │             │   │   see below)      │    │   HISTORY     │
  └──────┬──────┘   └──────────────────┘    └───────────────┘
         │
         │ tap item
         │
  ┌──────▼──────┐
  │   ITEM      │
  │   DETAIL /  │
  │   BIDDING   │
  └──┬──────┬───┘
     │      │
     │      │ auction ended + user won
     │      │
     │  ┌───▼──────────┐
     │  │  CHECKOUT     │  ◄── NEW SCREEN (doesn't exist yet)
     │  │  (order       │
     │  │   summary +   │
     │  │   pay method) │
     │  └───┬──────────┘
     │      │
     │  ┌───▼──────────┐
     │  │  PAYMENT      │
     │  │  STATUS       │
     │  │  (polling)    │
     │  └───┬──────────┘
     │      │
     │      └──► back to Home Feed
     │
     │ place bid
     │
     └──► stays on Item Detail (bid added to history)
```

---

## Screen-by-Screen Spec

### 1. Auth Screen

**Purpose**: Login or create account.

**Layout**: Centered card on gradient background.

```
┌─────────────────────────┐
│      🐄 LivestockZW     │
│                         │
│   [ Login ] [ Sign Up ] │  ◄── tabs
│                         │
│   ┌───────────────────┐ │
│   │ Phone or Email    │ │
│   └───────────────────┘ │
│   ┌───────────────────┐ │
│   │ Password          │ │
│   └───────────────────┘ │
│                         │
│   [ Sign In ─────────]  │
│                         │
│   Terms & Privacy link  │
└─────────────────────────┘
```

**Sign Up tab adds**: First Name, Last Name, Phone, Email fields above Password.

**States**: Loading spinner on submit, error toast on failure.

---

### 2. Home Feed

**Purpose**: Browse all livestock auctions. This is the main screen.

**Layout**: Sticky header, horizontal filter, scrollable card list.

```
┌─────────────────────────┐
│  Livestock Marketplace  │  ◄── sticky header
│  Find your next animal  │
├─────────────────────────┤
│ [All] [Cattle] [Goats]  │  ◄── horizontal scroll pills
│ [Sheep] [Pigs] [Chicken]│
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ ┌─────────────────┐ │ │
│ │ │     IMAGE        │ │ │
│ │ │  [Brahman]  2h ◀│ │ │  ◄── breed badge + countdown
│ │ └─────────────────┘ │ │
│ │ Ngoni Bull           │ │
│ │ Current Bid: $1,200  │ │  ◄── bold, prominent
│ │ 📍 Harare • 3yrs     │ │
│ │ 👤 John M. ✓         │ │  ◄── seller + verified
│ │ 12 bids • 89 views   │ │
│ │ [Message] [Place Bid] │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │  ... next card ...   │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│  🏠   ＋  📋  🔔  💳   │  ◄── bottom nav (fixed)
└─────────────────────────┘
```

**Card elements**:
- Hero image with breed badge (bottom-left) and time-left badge (bottom-right)
- Heart/favourite button (top-right of image)
- Title + current bid (large text)
- Age, weight, location with icons
- Seller: avatar + name + verified tick
- Bid count + view count
- Action buttons: Message + Place Bid

**When auction ended + user won**: "Place Bid" becomes "Pay Now" (green, Paynow branded).

---

### 3. Item Detail / Bidding Screen

**Purpose**: Full item info + place a bid OR pay if won.

**Layout**: Scrollable detail page, fixed bottom action bar.

```
┌─────────────────────────┐
│ ← Back          ♡  ↗   │  ◄── nav: back, like, share
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │                     │ │
│ │    HERO IMAGE       │ │
│ │                     │ │
│ │ [Brahman]    2h ◀  │ │
│ └─────────────────────┘ │
│                         │
│ Ngoni Bull              │
│ Current Bid: $1,200     │
│ Starting: $800          │
│                         │
│ ┌────┐ ┌────┐ ┌────┐   │
│ │Age │ │Wt  │ │Loc │   │  ◄── stats grid
│ │3yr │ │450 │ │Hre │   │
│ └────┘ └────┘ └────┘   │
│                         │
│ ┌─────────────────────┐ │
│ │ 👤 John M. ✓        │ │  ◄── seller card
│ │ ⭐ 4.8 • 23 sales   │ │
│ │          [Chat]     │ │
│ └─────────────────────┘ │
│                         │
│ Description             │
│ "Fine Ngoni bull..."    │
│                         │
│ Bid History             │
│ ┌─────────────────────┐ │
│ │ 👤 You    $1,200 🏆 │ │  ◄── winning badge
│ │ 👤 Peter  $1,100    │ │
│ │ 👤 Sarah  $1,000    │ │
│ └─────────────────────┘ │
│                         │
├═════════════════════════┤
│ Min: $1,250             │  ◄── FIXED BOTTOM BAR
│ ┌──────────┐ [Bid Now]  │      (if auction active)
│ │ $        │            │
│ └──────────┘            │
│                         │
│ ─── OR if won: ───      │
│                         │
│ [  Pay $1,200 — Paynow ]│  ◄── (if auction ended + user won)
└─────────────────────────┘
```

**Two bottom bar states**:
1. **Auction active**: Bid amount input + "Bid Now" button
2. **Auction ended + user won**: Single "Pay Now" button → opens **Checkout Screen**

**Mobile payment pending state**: Blue banner at top showing reference + USSD instructions.

---

### 4. Checkout Screen (NEW — needs design)

**Purpose**: Order summary + payment method selection before money moves.

**When shown**: User taps "Pay Now" from Item Detail or My Listings.

```
┌─────────────────────────┐
│ ← Back       Checkout   │
├─────────────────────────┤
│                         │
│  ORDER SUMMARY          │
│ ┌─────────────────────┐ │
│ │ [img]  Ngoni Bull   │ │
│ │        Brahman      │ │
│ │        Harare       │ │
│ └─────────────────────┘ │
│                         │
│  Winning Bid    $1,200  │
│  Platform Fee (5%)  $60 │
│  ─────────────────────  │
│  Total          $1,260  │
│                         │
│  PAYMENT METHOD         │
│ ┌─────────────────────┐ │
│ │ ◉ EcoCash           │ │  ◄── radio with logo
│ │ ○ OneMoney          │ │  ◄── radio with logo
│ │ ○ Pay Online (Card) │ │  ◄── radio with Paynow logo
│ └─────────────────────┘ │
│                         │
│  ┌───────────────────┐  │
│  │ 📱 0771 234 567   │  │  ◄── phone input (mobile only)
│  └───────────────────┘  │
│                         │
│  ℹ You'll receive a     │
│    USSD prompt on your  │
│    phone. Dial *151#    │
│    if you miss it.      │
│                         │
├═════════════════════════┤
│ [ Pay $1,260 ─────────] │  ◄── fixed bottom CTA
│  🔒 Secured by Paynow  │
└─────────────────────────┘
```

**Key design requirements**:
- Show the animal being purchased (image + title + breed)
- Break down the cost (bid + fee = total)
- Payment method radio with EcoCash/OneMoney/Paynow logos
- Phone input only appears for EcoCash/OneMoney
- Instructional text changes based on selected method
- "Secured by Paynow" trust badge
- After tap "Pay" → navigates to Payment Status screen

---

### 5. Payment Status Screen

**Purpose**: Show payment result after redirect or while polling mobile payment.

**Layout**: Centered status card.

```
┌─────────────────────────┐
│                         │
│         ┌───┐           │
│         │ ⟳ │           │  ◄── animated: spinner (pending)
│         └───┘           │      checkmark (paid)
│                         │      X (failed)
│    Payment Pending      │
│                         │
│  ┌───────────────────┐  │
│  │ REF: ZL-42-A3F2   │  │  ◄── monospace reference
│  └───────────────────┘  │
│                         │
│  Waiting for EcoCash    │
│  confirmation...        │
│                         │
│  ┌───────────────────┐  │
│  │ Dial *151# if you │  │  ◄── instructions box
│  │ missed the prompt │  │      (mobile payments only)
│  └───────────────────┘  │
│                         │
│  Auto-checking every    │
│  5 seconds...           │
│                         │
│  [ Back to Marketplace ]│
│                         │
└─────────────────────────┘
```

**Three states to design**:

| State | Icon | Color | Heading |
|-------|------|-------|---------|
| Pending | Spinning loader | Blue | "Payment Pending" |
| Success | Checkmark circle | Green | "Payment Successful" |
| Failed | Alert circle | Red | "Payment Failed" |

---

### 6. Post Livestock (Sell)

**Purpose**: Create a new auction listing.

```
┌─────────────────────────┐
│ ← Back   Post Livestock │
├─────────────────────────┤
│                         │
│  PHOTOS                 │
│ ┌────┐ ┌────┐ ┌────┐   │
│ │ +  │ │ +  │ │ +  │   │  ◄── up to 4 photo slots
│ └────┘ └────┘ └────┘   │
│                         │
│  BASIC INFO             │
│  Title ___________      │
│  Category [Cattle ▼]    │
│  Breed ___________      │
│  Age ______  Weight ____│
│  Description            │
│  ┌───────────────────┐  │
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  LOCATION & HEALTH      │
│  Location [Harare ▼]    │
│  Health   [Good ▼]      │
│                         │
│  AUCTION DETAILS        │
│  Starting Price  $____  │
│  Duration [7 days ▼]    │
│                         │
│  ┌───────────────────┐  │
│  │ ℹ 5% platform fee │  │
│  │   48hr payment    │  │
│  │   Inspection OK   │  │
│  └───────────────────┘  │
│                         │
├═════════════════════════┤
│ [ Post Listing ───────] │
│  Reviewed within 24hrs  │
└─────────────────────────┘
```

**Locations dropdown**: Harare, Bulawayo, Mutare, Masvingo, Gweru, Chinhoyi, Kadoma, Kwekwe

**Categories**: Cattle, Goats, Sheep, Pigs, Chickens, Other

**Health**: Excellent, Good, Fair

**Duration**: 1 day, 3 days, 7 days, 14 days

---

### 7. My Listings

**Purpose**: Manage what you're selling + items you've won.

```
┌─────────────────────────┐
│  My Marketplace         │
├─────────────────────────┤
│ [ Selling ] [ Won ]     │  ◄── tab toggle
├─────────────────────────┤
│                         │
│  SELLING TAB:           │
│ ┌─────────────────────┐ │
│ │ [img] Ngoni Bull    │ │
│ │ $800 • Active       │ │  ◄── status badge
│ │ [Edit] [Delete]     │ │
│ └─────────────────────┘ │
│                         │
│  WON TAB:               │
│ ┌─────────────────────┐ │
│ │ [img] Boer Goat     │ │
│ │ Won at $350         │ │
│ │ [Pay Now] [Chat]    │ │  ◄── Pay Now → Checkout Screen
│ └─────────────────────┘ │
│                         │
└─────────────────────────┘
```

---

### 8. Payment History

**Purpose**: See all past transactions.

```
┌─────────────────────────┐
│  Payment History        │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ ✅ PAY-2026-0312    │ │
│ │ EcoCash • 12 Mar    │ │
│ │              $1,260 │ │
│ │         [Paid ✓]    │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ ⏳ PAY-2026-0311    │ │
│ │ OneMoney • 11 Mar   │ │
│ │                $350 │ │
│ │       [Pending]     │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

### 9. Notifications

**Purpose**: Alerts for bids, auction endings, wins, messages.

```
┌─────────────────────────┐
│  Notifications    (3)   │
│              Mark all ✓ │
├─────────────────────────┤
│ [All] [Bids] [Messages] │  ◄── filter pills
│ [Auctions]              │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │🔴 New bid on your   │ │  ◄── left border = priority color
│ │   Ngoni Bull: $1,300│ │
│ │   2 min ago      ✕  │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │🟡 Auction ending    │ │
│ │   in 30 minutes     │ │
│ │   15 min ago     ✕  │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

**Types**: bid, message, auction_ending, auction_won, auction_lost, verification, payment

**Priority colors**: Red (high), Yellow (medium), Blue (info)

---

## Bottom Navigation Bar

Fixed at bottom, 5 equal tabs:

```
┌─────┬─────┬─────┬─────┬─────┐
│ 🏠  │  ＋  │ 📋  │ 🔔  │ 💳  │
│Home │Post │List │Alert│ Pay │
└─────┴─────┴─────┴─────┴─────┘
```

- Active tab: primary color text + top accent bar + subtle background
- Notifications tab: red count badge when unread

---

## Complete User Journey Map

### Buyer Journey
```
Sign Up → Browse Feed → Filter by Category → Tap Item
→ View Details → Place Bid → (outbid? bid again)
→ Auction Ends → Won! → Checkout Screen
→ Pick EcoCash → Enter Phone → Pay
→ USSD Prompt → Confirm on Phone
→ Payment Status → Success!
→ View in Payment History
```

### Seller Journey
```
Sign Up → Post Tab → Fill Form → Upload Photos
→ Set Starting Price → Set Duration → Submit
→ "Under Review" in My Listings
→ Approved → Goes Live on Feed
→ Watch Bids Come In (Notifications)
→ Auction Ends → Buyer Pays → Get Paid (minus 5% fee)
```

---

## Design System Notes

| Element | Spec |
|---------|------|
| **Target device** | Mobile web, 375px width primary |
| **Currency** | USD ($), Zimbabwe uses USD |
| **Color mood** | Green primary (agriculture), earth tones |
| **Font** | System font stack (clean, fast loading) |
| **Icons** | Lucide icons (line style) |
| **Component lib** | Based on shadcn/ui (Radix primitives) |
| **Dark mode** | Supported via CSS variables |

### Brand Elements to Include
- Paynow logo (on checkout + payment buttons)
- EcoCash green (#00A651)
- OneMoney blue (#0072BC)
- Verified seller checkmark badge
- Health status badges (green=verified, yellow=pending, red=rejected)

### Zimbabwe-Specific Context
- **Locations**: Harare, Bulawayo, Mutare, Masvingo, Gweru, Chinhoyi, Kadoma, Kwekwe
- **Livestock categories**: Cattle (most common), Goats, Sheep, Pigs, Chickens
- **Payment reality**: Most users pay via EcoCash USSD (*151#), not cards
- **Connectivity**: Design for slow connections (loading states, optimistic UI)
- **Language**: English (primary), consider Shona labels for key actions later

---

## What Exists vs What Needs Design

| Screen | Code Built | Needs Design Work |
|--------|:----------:|:-----------------:|
| Auth Screen | Yes | Refine |
| Home Feed | Yes | Refine |
| Item Detail / Bidding | Yes | Refine |
| **Checkout Screen** | **No** | **Design from scratch** |
| Payment Status | Yes | Refine |
| Post Listing | Yes | Refine |
| My Listings | Yes | Refine |
| Payment History | Yes | Refine |
| Notifications | Partial | Refine |
| Bottom Nav | Yes | Refine |
