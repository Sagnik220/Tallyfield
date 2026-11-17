-- Bulk sync with Instagram.
-- content_edited_at: set when someone changes a post's title, intro or text by hand. Sync never overwrites
-- a post that has it; clearing it (from the Sync screen) lets Instagram update the post again.
alter table public.posts add column content_edited_at timestamptz;

-- Imported posts that were changed after import, before this column existed, count as edited (the safe side).
update public.posts
   set content_edited_at = updated_at
 where source_url is not null
   and updated_at > created_at + interval '2 minutes';

-- Deleting a post keeps the record of where it came from (with no post), so sync knows not to bring it back.
alter table public.social_sources drop constraint if exists social_sources_post_id_fkey;
alter table public.social_sources
  add constraint social_sources_post_id_fkey foreign key (post_id) references public.posts (id) on delete set null;
