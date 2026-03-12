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
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    verified IS NOT DISTINCT FROM (select verified from public.profiles where id = auth.uid())
    and rating IS NOT DISTINCT FROM (select rating from public.profiles where id = auth.uid())
    and sales_count IS NOT DISTINCT FROM (select sales_count from public.profiles where id = auth.uid())
  );

-- LIVESTOCK ITEMS
create policy "Listings are viewable by everyone"
  on public.livestock_items for select using (true);

create policy "Authenticated users can create listings"
  on public.livestock_items for insert
  with check (auth.uid() = seller_id);

create policy "Sellers can update own listings"
  on public.livestock_items for update
  using (auth.uid() = seller_id)
  with check (
    current_bid IS NOT DISTINCT FROM (select current_bid from public.livestock_items where id = livestock_items.id)
    and bid_count IS NOT DISTINCT FROM (select bid_count from public.livestock_items where id = livestock_items.id)
    and view_count IS NOT DISTINCT FROM (select view_count from public.livestock_items where id = livestock_items.id)
    and status IS NOT DISTINCT FROM (select status from public.livestock_items where id = livestock_items.id)
    and end_time IS NOT DISTINCT FROM (select end_time from public.livestock_items where id = livestock_items.id)
    and seller_id IS NOT DISTINCT FROM (select seller_id from public.livestock_items where id = livestock_items.id)
  );

create policy "Sellers can delete own listings with no bids"
  on public.livestock_items for delete
  using (auth.uid() = seller_id and bid_count = 0 and status = 'active');

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

-- No user-facing update policy -- only service role updates payments

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

create policy "Users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

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

-- FAVORITES
alter table public.favorites enable row level security;

create policy "Users can view own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can insert own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- CONVERSATIONS
alter table public.conversations enable row level security;

create policy "Users can view own conversations"
  on public.conversations for select
  using (auth.uid() = participant_1 or auth.uid() = participant_2);

create policy "Users can create conversations they are part of"
  on public.conversations for insert
  with check (auth.uid() = participant_1);

create policy "Users can update own conversations"
  on public.conversations for update
  using (auth.uid() = participant_1 or auth.uid() = participant_2);

-- MESSAGES
alter table public.messages enable row level security;

create policy "Users can view messages in own conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  );

create policy "Users can insert messages in own conversations"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  );

-- Sender can update own messages (e.g. edit content)
create policy "Sender can update own messages"
  on public.messages for update
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

-- Recipient can only mark messages as read
create policy "Recipient can mark messages as read"
  on public.messages for update
  using (
    auth.uid() != sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  )
  with check (
    -- Only the read column can change; content and sender_id must stay the same
    content IS NOT DISTINCT FROM (select content from public.messages where id = messages.id)
    and sender_id IS NOT DISTINCT FROM (select sender_id from public.messages where id = messages.id)
  );
