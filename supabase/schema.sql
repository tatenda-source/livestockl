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
  created_at timestamptz default now()
);

-- Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  livestock_id uuid not null references public.livestock_items(id),
  reference text unique not null,
  amount numeric not null check (amount > 0),
  method text not null check (method in ('EcoCash', 'OneMoney', 'Card')),
  status text default 'pending' check (status in ('pending', 'paid', 'failed')),
  paynow_reference text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

-- Atomic bid placement function (prevents race conditions, validates rules)
create or replace function public.place_bid(
  p_livestock_id uuid,
  p_user_id uuid,
  p_amount numeric
)
returns uuid as $$
declare
  v_item record;
  v_bid_id uuid;
begin
  -- Verify the caller is the user they claim to be (prevents RLS bypass)
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
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

  if v_item.end_time < now() then
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
  insert into public.bids (livestock_id, user_id, amount)
  values (p_livestock_id, p_user_id, p_amount)
  returning id into v_bid_id;

  -- Update livestock item atomically
  update public.livestock_items
  set current_bid = p_amount,
      bid_count = bid_count + 1
  where id = p_livestock_id;

  return v_bid_id;
end;
$$ language plpgsql security definer;

-- Atomic view count increment (prevents race condition)
create or replace function public.increment_view_count(p_item_id uuid)
returns void as $$
begin
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
  for v_item in
    select id, seller_id, title
    from public.livestock_items
    where status = 'active' and end_time < now()
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
              'You won the auction for ' || v_item.title || ' at $' || v_winning_bid.amount,
              'high');

      -- Notify seller
      insert into public.notifications (user_id, type, title, message, priority)
      values (v_item.seller_id, 'auction_ending', 'Auction ended',
              'Your listing ' || v_item.title || ' sold for $' || v_winning_bid.amount,
              'high');
    end if;
  end loop;
end;
$$ language plpgsql security definer;

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
