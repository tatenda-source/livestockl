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
