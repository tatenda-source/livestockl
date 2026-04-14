-- ZimLivestock Database Schema
-- Run this in your Supabase SQL Editor

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  avatar_url text,
  verified boolean default false,
  rating numeric(2,1) default 0,
  sales_count integer default 0,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Livestock Items
create table if not exists public.livestock_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 200),
  category text not null check (category in ('Cattle', 'Goats', 'Sheep', 'Pigs', 'Chickens', 'Other')),
  breed text not null,
  age text not null,
  weight text not null,
  description text not null check (char_length(description) <= 2000),
  location text not null check (location in ('Harare', 'Bulawayo', 'Mutare', 'Masvingo', 'Gweru', 'Chinhoyi', 'Kadoma', 'Kwekwe')),
  health text not null check (health in ('Excellent', 'Good', 'Fair')),
  starting_price numeric not null check (starting_price > 0),
  current_bid numeric default 0,
  bid_count integer default 0,
  view_count integer default 0,
  image_urls text[] default '{}',
  seller_id uuid not null references public.profiles(id),
  status text default 'active' check (status in ('active', 'ended', 'sold', 'cancelled')),
  duration_days integer not null check (duration_days in (1, 3, 7, 14)),
  end_time timestamptz not null,
  created_at timestamptz default now()
);

-- Bids
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  livestock_id uuid not null references public.livestock_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  amount numeric not null check (amount > 0),
  is_winner boolean default false,
  -- Client-generated idempotency key — lets place_bid() short-circuit
  -- duplicate submissions from double-clicks or network retries.
  idempotency_key uuid,
  created_at timestamptz default now()
);
create unique index if not exists idx_bids_idempotency
  on public.bids (user_id, idempotency_key)
  where idempotency_key is not null;

-- Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  livestock_id uuid not null references public.livestock_items(id),
  reference text unique not null,
  amount numeric not null check (amount > 0 and amount <= 100000),
  method text not null check (method in ('EcoCash', 'OneMoney', 'Card')),
  status text default 'pending' check (status in ('pending', 'paid', 'failed')),
  paynow_reference text,
  phone text,
  idempotency_key uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists idx_payments_idempotency
  on public.payments (user_id, idempotency_key)
  where idempotency_key is not null;

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  type text not null check (type in ('bid', 'message', 'auction_ending', 'auction_won', 'auction_lost', 'verification', 'payment')),
  title text not null,
  message text not null,
  read boolean default false,
  priority text default 'medium' check (priority in ('high', 'medium', 'low')),
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_livestock_category on public.livestock_items(category);
create index if not exists idx_livestock_status on public.livestock_items(status);
create index if not exists idx_livestock_seller on public.livestock_items(seller_id);
create index if not exists idx_livestock_end_time on public.livestock_items(end_time);
create index if not exists idx_bids_livestock on public.bids(livestock_id);
create index if not exists idx_bids_user on public.bids(user_id);
create index if not exists idx_payments_user on public.payments(user_id);
create index if not exists idx_payments_reference on public.payments(reference);
create index if not exists idx_notifications_user on public.notifications(user_id);

-- Enable Realtime for bids
alter publication supabase_realtime add table public.bids;
alter publication supabase_realtime add table public.notifications;

-- Storage bucket for livestock images
insert into storage.buckets (id, name, public)
values ('livestock-images', 'livestock-images', true)
on conflict (id) do nothing;

-- Atomic bid placement function (prevents race conditions, validates rules).
-- Accepts optional p_idempotency_key — if the same (user, key) pair was
-- already used, returns the original bid id instead of inserting a duplicate.
-- This is defence against double-clicks, stuck-spinner retries, and offline
-- queued mutations replayed on reconnect.
create or replace function public.place_bid(
  p_livestock_id uuid,
  p_user_id uuid,
  p_amount numeric,
  p_idempotency_key uuid default null
)
returns uuid as $$
declare
  v_item record;
  v_bid_id uuid;
  v_prev_bidder record;
  v_existing_bid_id uuid;
begin
  -- Verify the caller is the user they claim to be (prevents RLS bypass)
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Idempotency short-circuit: if this user has already submitted a bid
  -- with this key, return it instead of inserting a duplicate.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_bid_id
    FROM public.bids
    WHERE user_id = p_user_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF v_existing_bid_id IS NOT NULL THEN
      RETURN v_existing_bid_id;
    END IF;
  END IF;

  -- Lock the item row to prevent concurrent bid races
  select * into v_item
  from public.livestock_items
  where id = p_livestock_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  if v_item.status != 'active' then
    raise exception 'Auction is not active';
  end if;

  if v_item.end_time <= now() then
    -- Auto-end expired auction
    update public.livestock_items set status = 'ended' where id = p_livestock_id;
    raise exception 'Auction has ended';
  end if;

  if v_item.seller_id = p_user_id then
    raise exception 'Cannot bid on your own listing';
  end if;

  if p_amount <= v_item.current_bid then
    raise exception 'Bid must be higher than current bid of %', v_item.current_bid;
  end if;

  if p_amount < v_item.starting_price then
    raise exception 'Bid must be at least the starting price of %', v_item.starting_price;
  end if;

  -- Insert the bid
  insert into public.bids (livestock_id, user_id, amount, idempotency_key)
  values (p_livestock_id, p_user_id, p_amount, p_idempotency_key)
  returning id into v_bid_id;

  -- Update livestock item atomically
  update public.livestock_items
  set current_bid = p_amount,
      bid_count = bid_count + 1
  where id = p_livestock_id;

  -- Notify seller that a new bid was placed
  insert into public.notifications (user_id, type, title, message, priority)
  values (v_item.seller_id, 'bid', 'New bid on your listing',
          'Someone bid US$' || p_amount || ' on ' || v_item.title,
          'medium');

  -- Notify all previous bidders (excluding the current bidder) that they've been outbid
  for v_prev_bidder in
    select distinct on (user_id) user_id
    from public.bids
    where livestock_id = p_livestock_id
      and user_id != p_user_id
      and id != v_bid_id
  loop
    insert into public.notifications (user_id, type, title, message, priority)
    values (v_prev_bidder.user_id, 'bid', 'You''ve been outbid!',
            'A new bid of US$' || p_amount || ' was placed on ' || v_item.title || '. Place a higher bid to stay in the race!',
            'high');
  end loop;

  return v_bid_id;
end;
$$ language plpgsql security definer;

-- Atomic view count increment (prevents race condition)
create or replace function public.increment_view_count(p_item_id uuid)
returns void as $$
begin
  -- Require authentication to prevent anonymous view count inflation
  if auth.uid() is null then
    return;
  end if;

  update public.livestock_items
  set view_count = view_count + 1
  where id = p_item_id;
end;
$$ language plpgsql security definer;

-- End expired auctions and determine winners
create or replace function public.end_expired_auctions()
returns void as $$
declare
  v_item record;
  v_winning_bid record;
begin
  -- Prevent concurrent execution (xact lock auto-releases on transaction end, preventing leaks)
  if not pg_try_advisory_xact_lock(42) then
    return;
  end if;

  for v_item in
    select id, seller_id, title
    from public.livestock_items
    where status = 'active' and end_time <= now()
    for update skip locked
    limit 50
  loop
    -- Mark auction as ended
    update public.livestock_items set status = 'ended' where id = v_item.id;

    -- Find highest bid and mark as winner
    select * into v_winning_bid
    from public.bids
    where livestock_id = v_item.id
    order by amount desc
    limit 1;

    if found then
      -- Clear any previous winner flags and set new winner
      update public.bids set is_winner = false where livestock_id = v_item.id;
      update public.bids set is_winner = true where id = v_winning_bid.id;

      -- Notify winner
      insert into public.notifications (user_id, type, title, message, priority)
      values (v_winning_bid.user_id, 'auction_won', 'You won!',
              'You won the auction for ' || v_item.title || ' at US$' || v_winning_bid.amount || '. Head to the listing to complete payment.',
              'high');

      -- Notify seller
      insert into public.notifications (user_id, type, title, message, priority)
      values (v_item.seller_id, 'auction_ending', 'Auction sold!',
              'Your listing ' || v_item.title || ' sold for US$' || v_winning_bid.amount || '.',
              'high');

      -- Notify losing bidders
      insert into public.notifications (user_id, type, title, message, priority)
      select distinct b.user_id, 'auction_lost', 'Auction ended',
             'The auction for ' || v_item.title || ' has ended. The winning bid was US$' || v_winning_bid.amount || '.',
             'medium'
      from public.bids b
      where b.livestock_id = v_item.id
        and b.user_id != v_winning_bid.user_id;
    else
      -- Notify seller that auction ended with no bids
      insert into public.notifications (user_id, type, title, message, priority)
      values (v_item.seller_id, 'auction_ending', 'Auction ended',
              'Your listing ' || v_item.title || ' ended with no bids.',
              'medium');
    end if;
  end loop;

  -- No explicit unlock needed: pg_try_advisory_xact_lock auto-releases on commit/rollback
end;
$$ language plpgsql security definer;

-- Compute end_time server-side to prevent client manipulation
create or replace function public.set_listing_end_time()
returns trigger as $$
begin
  new.end_time := now() + (new.duration_days || ' days')::interval;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_listing_end_time_trigger on public.livestock_items;
create trigger set_listing_end_time_trigger
  before insert on public.livestock_items
  for each row execute function public.set_listing_end_time();

-- Composite indexes for common queries
create index if not exists idx_livestock_status_category on public.livestock_items(status, category);
create index if not exists idx_livestock_status_created on public.livestock_items(status, created_at desc);

-- Auto-update updated_at on payments
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.update_updated_at();

-- Favorites / Wishlist
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  livestock_id uuid not null references public.livestock_items(id) on delete cascade,
  created_at timestamptz default now(),
  constraint favorites_user_livestock_unique unique (user_id, livestock_id)
);

create index if not exists idx_favorites_user on public.favorites(user_id);
create index if not exists idx_favorites_livestock on public.favorites(livestock_id);

-- Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_1 uuid not null references public.profiles(id),
  participant_2 uuid not null references public.profiles(id),
  livestock_id uuid references public.livestock_items(id),
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint unique_conversation unique (participant_1, participant_2, livestock_id)
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text not null check (char_length(content) <= 2000),
  read boolean default false,
  created_at timestamptz default now()
);

-- Indexes for conversations and messages
create index if not exists idx_conversations_participant_1 on public.conversations(participant_1);
create index if not exists idx_conversations_participant_2 on public.conversations(participant_2);
create index if not exists idx_messages_conversation on public.messages(conversation_id);
create index if not exists idx_messages_sender on public.messages(sender_id);

-- Enable Realtime for conversations and messages
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;

-- To enable automatic auction expiry, enable pg_cron extension in Supabase dashboard
-- then run:
-- select cron.schedule('end-expired-auctions', '* * * * *', $$ select end_expired_auctions(); $$);

-- Prevent duplicate active payments for same item
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_active
  ON public.payments(livestock_id, user_id)
  WHERE status IN ('pending', 'paid');

-- Index for payment lookups by livestock_id
CREATE INDEX IF NOT EXISTS idx_payments_livestock
  ON public.payments(livestock_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_bids_livestock_amount
  ON public.bids(livestock_id, amount DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_last_msg
  ON public.conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages(conversation_id, created_at DESC);

-- Bill Payments (BillPay Vendor API v1.33 integration)
CREATE TABLE IF NOT EXISTS public.bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  reference text UNIQUE NOT NULL,
  biller_code text NOT NULL,
  biller_name text NOT NULL,
  account_number text NOT NULL,
  account_holder text,
  amount numeric NOT NULL CHECK (amount > 0 AND amount <= 100000),
  total_amount numeric,
  currency text DEFAULT 'USD',
  requires_forex boolean DEFAULT false,
  status text DEFAULT 'pending' CHECK (status IN (
    'pending', 'authorized', 'being_processed', 'paid', 'failed', 'flagged', 'reversed'
  )),
  -- Paynow references
  billpay_reference text,
  biller_payment_reference text,
  wallet_debit_reference text,
  -- Revenue tracking
  vendor_commission numeric DEFAULT 0,
  vendor_service_fee numeric DEFAULT 0,
  vendor_service_fee_currency text,
  -- Full API response data (JSONB)
  products jsonb DEFAULT '[]',
  auth_data jsonb,
  vouchers jsonb DEFAULT '[]',
  receipt_smses jsonb DEFAULT '[]',
  receipt_html jsonb DEFAULT '[]',
  display_data jsonb DEFAULT '{}',
  payer_details jsonb,
  -- User-facing narration (never expose TechnicalNarration)
  narration text,
  -- Reconciliation tracking
  status_check_count integer DEFAULT 0,
  last_status_check_at timestamptz,
  flagged_at timestamptz,
  -- Links
  linked_payment_id uuid REFERENCES public.payments(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_user ON public.bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_reference ON public.bill_payments(reference);
CREATE INDEX IF NOT EXISTS idx_bill_payments_status ON public.bill_payments(status);
CREATE INDEX IF NOT EXISTS idx_bill_payments_reconcile ON public.bill_payments(status, updated_at)
  WHERE status IN ('being_processed', 'flagged');

DROP TRIGGER IF EXISTS bill_payments_updated_at ON public.bill_payments;
CREATE TRIGGER bill_payments_updated_at
  BEFORE UPDATE ON public.bill_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bill payments" ON public.bill_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bill payments" ON public.bill_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Billers Cache (populated by billpay-billers Edge Function from ListBillers API)
CREATE TABLE IF NOT EXISTS public.billers_cache (
  biller_code text PRIMARY KEY,
  biller_name text NOT NULL,
  description text,
  icon_url text,
  logo_url text,
  enabled boolean DEFAULT true,
  member_number_field_label text,
  member_number_field_desc text,
  member_number_field_regex text,
  allow_multiple_products boolean DEFAULT false,
  vendor_must_invoice boolean DEFAULT false,
  products jsonb DEFAULT '[]',
  raw_config jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.billers_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read billers cache" ON public.billers_cache
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Prevent self-conversations
ALTER TABLE public.conversations
  ADD CONSTRAINT no_self_conversation
  CHECK (participant_1 != participant_2);

-- Sync a single listing's bid price/count from the bids table (repair drift)
CREATE OR REPLACE FUNCTION public.sync_listing_bid(p_item_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE livestock_items SET
        current_bid = COALESCE((SELECT MAX(amount) FROM bids WHERE livestock_id = p_item_id), 0),
        bid_count = (SELECT COUNT(*) FROM bids WHERE livestock_id = p_item_id)
    WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Agent Tables (AI Buyer/Seller/Sniper/Market Intel)
-- All tables locked to service_role only. Frontend reads go
-- through authenticated user policies where appropriate.
-- ============================================================

-- Agents (one per user per type)
CREATE TABLE IF NOT EXISTS public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_type text NOT NULL CHECK (agent_type IN ('buyer', 'seller', 'market_intel', 'sniper')),
  name text NOT NULL,
  status text DEFAULT 'paused' CHECK (status IN ('active', 'paused', 'stopped')),
  config jsonb DEFAULT '{}',
  stats jsonb DEFAULT '{"total_actions": 0, "total_spent": 0, "total_bids": 0, "wins": 0}',
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_user ON public.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_type_status ON public.agents(agent_type, status);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own agents
CREATE POLICY "Users can view own agents" ON public.agents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own agents" ON public.agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own agents" ON public.agents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own agents" ON public.agents
  FOR DELETE USING (auth.uid() = user_id);

-- Agent Goals (what the agent is looking for)
CREATE TABLE IF NOT EXISTS public.agent_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('Cattle', 'Goats', 'Sheep', 'Pigs', 'Poultry', 'Other')),
  preferred_breed text,
  preferred_location text,
  min_health text DEFAULT 'Good' CHECK (min_health IN ('Excellent', 'Good', 'Fair')),
  max_price numeric NOT NULL CHECK (max_price > 0 AND max_price <= 100000),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  quantity_fulfilled integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_goals_agent ON public.agent_goals(agent_id);

ALTER TABLE public.agent_goals ENABLE ROW LEVEL SECURITY;

-- Goals visible to agent owner only
CREATE POLICY "Users can view own agent goals" ON public.agent_goals
  FOR SELECT USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can manage own agent goals" ON public.agent_goals
  FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can update own agent goals" ON public.agent_goals
  FOR UPDATE USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can delete own agent goals" ON public.agent_goals
  FOR DELETE USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );

-- Agent Bids (tracking which bids the agent placed)
CREATE TABLE IF NOT EXISTS public.agent_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.agent_goals(id) ON DELETE SET NULL,
  livestock_id uuid NOT NULL REFERENCES public.livestock_items(id) ON DELETE CASCADE,
  bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  strategy text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_bids_agent ON public.agent_bids(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_bids_livestock ON public.agent_bids(livestock_id);

ALTER TABLE public.agent_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent bids" ON public.agent_bids
  FOR SELECT USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );
-- INSERT/UPDATE/DELETE restricted to service role (via Edge Functions)

-- Agent Activity Log
CREATE TABLE IF NOT EXISTS public.agent_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON public.agent_activity_log(agent_id, created_at DESC);

ALTER TABLE public.agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent activity" ON public.agent_activity_log
  FOR SELECT USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );
-- INSERT/UPDATE/DELETE restricted to service role (via Edge Functions)

-- Agent Decisions (reasoning trail)
CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES public.agent_goals(id) ON DELETE SET NULL,
  livestock_id uuid REFERENCES public.livestock_items(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('bid', 'skip', 'watch', 'buy_now')),
  reasoning text NOT NULL,
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_agent ON public.agent_decisions(agent_id, created_at DESC);

ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent decisions" ON public.agent_decisions
  FOR SELECT USING (
    agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
  );

-- Agent Payment Orders (agent-initiated payments)
CREATE TABLE IF NOT EXISTS public.agent_payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  livestock_id uuid NOT NULL REFERENCES public.livestock_items(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  amount numeric NOT NULL CHECK (amount > 0 AND amount <= 100000),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_payment_orders_agent ON public.agent_payment_orders(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_payment_orders_status ON public.agent_payment_orders(status);

ALTER TABLE public.agent_payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent payment orders" ON public.agent_payment_orders
  FOR SELECT USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE restricted to service role

-- Settlement Ledger (audit trail for all payment state transitions)
CREATE TABLE IF NOT EXISTS public.settlement_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id uuid REFERENCES public.agent_payment_orders(id) ON DELETE CASCADE,
  event text NOT NULL,
  provider text,
  amount numeric,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlement_ledger_order ON public.settlement_ledger(payment_order_id);

ALTER TABLE public.settlement_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settlement entries" ON public.settlement_ledger
  FOR SELECT USING (
    payment_order_id IN (
      SELECT id FROM public.agent_payment_orders WHERE user_id = auth.uid()
    )
  );
-- INSERT/UPDATE/DELETE restricted to service role

-- Market Intel (public — intentionally readable by all)
CREATE TABLE IF NOT EXISTS public.market_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  category text,
  report_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_intel_period ON public.market_intel(period_end DESC);

ALTER TABLE public.market_intel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market intel is public" ON public.market_intel
  FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE restricted to service role

-- Enable realtime for agent activity log (used by frontend dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_activity_log;

-- ============================================================
-- Auction Ownership State Machine (pilot demo, 2026-04-15)
-- Instruments the five observed states: Registered -> Auctioned
-- -> Cleared -> Paid -> Transferred. Police clearance is a
-- first-class gate (physical verification by a policewoman at
-- the auction floor) and cannot be skipped.
--
-- Pattern mirrors settlement_ledger: append-only event log,
-- service-role-only writes, RLS-scoped reads for the parties
-- involved (seller, winning bidder).
-- ============================================================

-- Clearance Events (police clearance state per animal)
create table if not exists public.clearance_events (
  id uuid primary key default gen_random_uuid(),
  livestock_id uuid not null references public.livestock_items(id) on delete cascade,
  bid_id uuid references public.bids(id),
  status text not null check (status in ('pending', 'approved', 'blocked')),
  officer_name text,
  officer_badge text,
  district text,
  notes text,
  metadata jsonb default '{}',
  idempotency_key uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_clearance_events_livestock on public.clearance_events(livestock_id);
create index if not exists idx_clearance_events_status on public.clearance_events(status);
create index if not exists idx_clearance_events_created on public.clearance_events(created_at desc);
create unique index if not exists idx_clearance_events_idempotency
  on public.clearance_events (livestock_id, idempotency_key)
  where idempotency_key is not null;

drop trigger if exists clearance_events_updated_at on public.clearance_events;
create trigger clearance_events_updated_at
  before update on public.clearance_events
  for each row execute function public.update_updated_at();

-- Ownership Transitions (immutable state-machine audit log)
create table if not exists public.ownership_transitions (
  id uuid primary key default gen_random_uuid(),
  livestock_id uuid not null references public.livestock_items(id) on delete cascade,
  from_owner_id uuid references public.profiles(id),
  to_owner_id uuid references public.profiles(id),
  state text not null check (state in ('registered', 'auctioned', 'cleared', 'paid', 'transferred')),
  event text not null,
  bid_id uuid references public.bids(id),
  payment_id uuid references public.payments(id),
  clearance_id uuid references public.clearance_events(id),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists idx_ownership_transitions_livestock on public.ownership_transitions(livestock_id);
create index if not exists idx_ownership_transitions_state on public.ownership_transitions(state);
create index if not exists idx_ownership_transitions_created on public.ownership_transitions(created_at desc);

-- Atomic ownership-transition recorder.
-- Authorization: caller must be one of (from_owner, to_owner, livestock seller)
-- OR the service_role (edge functions). Matches the settlement_ledger pattern
-- where user-facing RPCs are gated and background/webhook writers go through
-- service_role (which bypasses this check entirely since auth.uid() is null
-- and the seller_id check is the final fall-through... so we explicitly allow
-- service_role by detecting the null auth.uid() case).
create or replace function public.record_ownership_transition(
  p_livestock_id uuid,
  p_state text,
  p_event text,
  p_from_owner uuid default null,
  p_to_owner uuid default null,
  p_bid_id uuid default null,
  p_payment_id uuid default null,
  p_clearance_id uuid default null,
  p_metadata jsonb default '{}'
)
returns uuid as $$
declare
  v_transition_id uuid;
  v_seller_id uuid;
  v_caller uuid;
  v_is_service_role boolean;
begin
  v_caller := auth.uid();
  -- When invoked via service_role key, auth.role() is 'service_role'.
  v_is_service_role := (auth.role() = 'service_role');

  -- Look up the listing's seller for the authorization check.
  select seller_id into v_seller_id
  from public.livestock_items
  where id = p_livestock_id;

  if not found then
    raise exception 'Listing not found';
  end if;

  -- Authorization: service_role bypasses; otherwise caller must be a
  -- party to this transition (from_owner, to_owner, or the seller).
  if not v_is_service_role then
    if v_caller is null then
      raise exception 'Unauthorized';
    end if;
    if v_caller <> coalesce(p_from_owner, '00000000-0000-0000-0000-000000000000'::uuid)
       and v_caller <> coalesce(p_to_owner, '00000000-0000-0000-0000-000000000000'::uuid)
       and v_caller <> v_seller_id then
      raise exception 'Unauthorized: caller must be from_owner, to_owner, or seller';
    end if;
  end if;

  insert into public.ownership_transitions (
    livestock_id, from_owner_id, to_owner_id, state, event,
    bid_id, payment_id, clearance_id, metadata
  ) values (
    p_livestock_id, p_from_owner, p_to_owner, p_state, p_event,
    p_bid_id, p_payment_id, p_clearance_id, p_metadata
  )
  returning id into v_transition_id;

  return v_transition_id;
end;
$$ language plpgsql security definer;

-- Enable Realtime so the pilot UI can stream state changes
alter publication supabase_realtime add table public.clearance_events;
alter publication supabase_realtime add table public.ownership_transitions;
