-- Move Mindful — When each member last looked at the group chat
-- Run in the Supabase SQL Editor after 024_voice_announcements.sql.
--
-- For the violet dot on the Chat tab, which shows only when a trainer has
-- posted since the member last had the chat open. The trainer's side is a row
-- in app_settings (key 'chat_last_trainer_post_at', written by the Stream
-- webhook); this is the member's. Set each time they open or leave /chat
-- (apps/web/src/lib/chat/dot-server.ts). Null = never opened it.
--
-- On member_preferences, so deleting an account (deleteMemberData) already
-- clears it. Read and written only on the server, like the rest of the row.

alter table public.member_preferences
  add column chat_seen_at timestamptz;
