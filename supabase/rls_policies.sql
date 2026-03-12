-- Row Level Security Policies for ZimLivestock
-- Run this after schema.sql

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.livestock_items enable row level security;
alter table public.bids enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;

-- PROFILES
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- LIVESTOCK ITEMS
create policy "Listings are viewable by everyone"
  on public.livestock_items for select using (true);

create policy "Authenticated users can create listings"
  on public.livestock_items for insert
  with check (auth.uid() = seller_id);

create policy "Sellers can update own listings"
  on public.livestock_items for update
  using (auth.uid() = seller_id);

create policy "Sellers can delete own listings"
  on public.livestock_items for delete
  using (auth.uid() = seller_id);

-- BIDS
create policy "Bids are viewable by everyone"
  on public.bids for select using (true);

create policy "Authenticated users can place bids"
  on public.bids for insert
  with check (auth.uid() = user_id);

-- PAYMENTS
create policy "Users can view own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Authenticated users can create payments"
  on public.payments for insert
  with check (auth.uid() = user_id);

-- Only payment owner can view status; service role bypasses RLS for webhook updates
create policy "Users can update own payment status"
  on public.payments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- NOTIFICATIONS
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Users can only create notifications for themselves; service role bypasses RLS for system notifications
create policy "Users can create own notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id);

-- STORAGE: livestock-images
create policy "Anyone can view livestock images"
  on storage.objects for select
  using (bucket_id = 'livestock-images');

create policy "Authenticated users can upload to own folder"
  on storage.objects for insert
  with check (bucket_id = 'livestock-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own images"
  on storage.objects for delete
  using (bucket_id = 'livestock-images' and auth.uid()::text = (storage.foldername(name))[1]);
