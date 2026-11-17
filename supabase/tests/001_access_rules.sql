-- Access-rule tests. Plain SQL: each check raises an exception on failure, so psql exits non-zero.
-- Runs inside one transaction that is rolled back, leaving the database untouched.
begin;

-- ---------------------------------------------------------------- fixtures (as owner)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test'),
  ('00000000-0000-0000-0000-00000000000e', 'editor@test'),
  ('00000000-0000-0000-0000-00000000000f', 'second-editor@test'),
  ('00000000-0000-0000-0000-000000000001', 'nobody@test');
update public.profiles set role = 'admin'  where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'editor' where id in ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000f');

insert into public.media (id, storage_path, mime_type, alt) values
  ('10000000-0000-0000-0000-000000000001', 'covers/published.jpg', 'image/jpeg', 'published cover'),
  ('10000000-0000-0000-0000-000000000002', 'covers/draft.jpg', 'image/jpeg', 'draft cover');

insert into public.posts (id, slug, title, deck, status, category_id, cover_media_id) values
  ('20000000-0000-0000-0000-000000000001', 'tissot-prx-or-citizen-tsuyosa', 'Tissot PRX or Citizen Tsuyosa?',
   'Two integrated-bracelet icons.', 'published',
   (select id from public.categories where slug = 'comparison'), '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'secret-draft', 'Unreleased Hamilton piece', '', 'draft',
   (select id from public.categories where slug = 'verdict'), '10000000-0000-0000-0000-000000000002');
insert into public.post_tags (post_id, tag_id)
  select '20000000-0000-0000-0000-000000000001', id from public.tags where slug in ('tissot', 'citizen');
insert into public.post_tags (post_id, tag_id)
  select '20000000-0000-0000-0000-000000000002', id from public.tags where slug = 'hamilton';
insert into public.integration_tokens (provider, access_token) values ('instagram', 'super-secret');
insert into public.site_settings (key, value, is_public) values ('test.private', '1'::jsonb, false);

create function tests.expect(p_ok boolean, p_label text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAIL: %', p_label; end if;
  raise notice 'ok - %', p_label;
end $$;
grant execute on function tests.expect(boolean, text) to anon, authenticated;

-- Runs a statement that must be refused (permission error or RLS violation) or must touch no rows.
create function tests.expect_denied(p_sql text, p_label text) returns void language plpgsql as $$
declare v_rows bigint;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
  exception when insufficient_privilege then
    raise notice 'ok - % (refused)', p_label;
    return;
  end;
  if v_rows > 0 then raise exception 'FAIL: % (statement changed % rows)', p_label, v_rows; end if;
  raise notice 'ok - % (no rows visible)', p_label;
end $$;
grant execute on function tests.expect_denied(text, text) to anon, authenticated;

-- ---------------------------------------------------------------- 1. anonymous visitor
select tests.as_anon();
select tests.expect((select count(*) from public.posts) = 1, 'anon sees only the published post');
select tests.expect((select count(*) from public.media) = 1, 'anon sees only media used by a published post');
select tests.expect((select count(*) from public.post_tags) = 2, 'anon sees tags of published posts only');
select tests.expect((select count(*) from public.site_settings where key = 'test.private') = 0, 'anon cannot read private settings');
select tests.expect((select count(*) from public.site_settings where key = 'site.tagline') = 1, 'anon can read public settings');
select tests.expect_denied($$insert into public.posts (slug, title, category_id) select 'x', 'x', id from public.categories limit 1$$, 'anon cannot create a post');
select tests.expect_denied($$update public.posts set title = 'hacked'$$, 'anon cannot edit a post');
select tests.expect_denied($$delete from public.posts$$, 'anon cannot delete a post');
select tests.expect_denied($$select * from public.integration_tokens$$, 'anon cannot read integration tokens');
select tests.expect_denied($$select * from public.audit_log$$, 'anon cannot read the audit log');
select tests.expect_denied($$select * from public.profiles$$, 'anon cannot read profiles');
select tests.expect_denied($$select * from public.social_sources$$, 'anon cannot read import sources');
select tests.expect_denied($$select public.set_user_role('00000000-0000-0000-0000-000000000001', 'admin')$$, 'anon cannot call set_user_role');
select tests.expect_denied($$select public.hit_rate_limit('import', 5, 60)$$, 'anon cannot use the rate limiter');
select tests.expect_denied($$select * from private.rate_limits$$, 'anon cannot read rate limit rows');
select tests.expect((select count(*) from public.search_posts('hamilton')) = 0, 'search does not leak drafts to anon');
select tests.expect((select count(*) from public.search_posts('citiz')) = 1, 'search matches a partial word in the title');
select tests.expect((select count(*) from public.search_posts('', null, array['tissot', 'citizen'])) = 1, 'search filters by all given tags');
select tests.expect((select count(*) from public.search_posts('', null, array['tissot', 'hmt'])) = 0, 'search requires every tag to match');
select tests.expect((select count(*) from public.search_posts('', 'verdict')) = 0, 'search filters by category');
select tests.expect((select count(*) from public.search_posts('100%_\')) = 0, 'search treats wildcard characters as plain text');

-- ---------------------------------------------------------------- 2. signed in, no role
select tests.as_user('00000000-0000-0000-0000-000000000001');
select tests.expect((select count(*) from public.posts) = 1, 'user without a role sees only published posts');
select tests.expect((select count(*) from public.profiles) = 1, 'user without a role sees only their own profile');
select tests.expect_denied($$insert into public.posts (slug, title, category_id, author_id) select 'y', 'y', id, '00000000-0000-0000-0000-000000000001' from public.categories limit 1$$, 'user without a role cannot create a post');
select tests.expect_denied($$update public.posts set title = 'hacked'$$, 'user without a role cannot edit a post');
select tests.expect_denied($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001'$$, 'user cannot promote themselves by editing their profile');
select tests.expect_denied($$select public.set_user_role('00000000-0000-0000-0000-000000000001', 'admin')$$, 'user without a role cannot grant roles');
select tests.expect_denied($$insert into storage.objects (bucket_id, name) values ('media', 'evil.jpg')$$, 'user without a role cannot upload files');
select tests.expect_denied($$select * from public.integration_tokens$$, 'signed-in user cannot read integration tokens');
update public.profiles set display_name = 'Reader' where id = '00000000-0000-0000-0000-000000000001';
select tests.expect((select display_name from public.profiles) = 'Reader', 'user can change their own display name');

-- ---------------------------------------------------------------- 3. editor
select tests.as_user('00000000-0000-0000-0000-00000000000e');
select tests.expect((select count(*) from public.posts) = 2, 'editor sees drafts');
insert into public.posts (id, slug, title, category_id, author_id)
  select '20000000-0000-0000-0000-000000000003', 'editor-post', 'Editor post', id, '00000000-0000-0000-0000-00000000000e'
  from public.categories where slug = 'story';
select tests.expect(true, 'editor can create a post');
select tests.expect_denied($$insert into public.posts (slug, title, category_id, author_id) select 'forged', 'Forged', id, '00000000-0000-0000-0000-00000000000a' from public.categories limit 1$$, 'editor cannot create a post in someone else''s name');
update public.posts set title = 'Editor post, revised', status = 'published' where id = '20000000-0000-0000-0000-000000000003';
select tests.expect((select published_at is not null from public.posts where id = '20000000-0000-0000-0000-000000000003'), 'publishing sets the publish date');
select tests.expect((select count(*) from public.post_revisions where post_id = '20000000-0000-0000-0000-000000000003') = 1, 'an edit stores the previous version');
select tests.expect_denied($$delete from public.posts where id = '20000000-0000-0000-0000-000000000003'$$, 'editor cannot delete a post');
select tests.expect_denied($$select public.set_user_role('00000000-0000-0000-0000-00000000000e', 'admin')$$, 'editor cannot promote themselves');
select tests.expect_denied($$select * from public.audit_log$$, 'editor cannot read the audit log');
select tests.expect_denied($$insert into public.site_settings (key, value) values ('x.y', '1')$$, 'editor cannot change settings');
select tests.expect_denied($$insert into public.post_revisions (post_id, snapshot) values ('20000000-0000-0000-0000-000000000003', '{}')$$, 'editor cannot forge revisions');
select tests.expect_denied($$insert into public.audit_log (action, entity) values ('fake', 'post')$$, 'editor cannot forge audit entries');
insert into storage.objects (bucket_id, name) values ('media', 'slides/a.jpg');
select tests.expect(true, 'editor can upload to the media bucket');
select tests.expect_denied($$insert into storage.objects (bucket_id, name) values ('other', 'a.jpg')$$, 'editor cannot upload to another bucket');
select tests.expect(public.hit_rate_limit('import', 2, 3600), 'rate limit allows the first call');
select tests.expect(public.hit_rate_limit('import', 2, 3600), 'rate limit allows the second call');
select tests.expect(not public.hit_rate_limit('import', 2, 3600), 'rate limit blocks the third call');
select tests.as_user('00000000-0000-0000-0000-00000000000f');
select tests.expect(public.hit_rate_limit('import', 2, 3600), 'rate limit is counted per user');

-- ---------------------------------------------------------------- 4. admin
select tests.as_user('00000000-0000-0000-0000-00000000000a');
select public.set_user_role('00000000-0000-0000-0000-000000000001', 'editor');
select tests.expect((select role = 'editor' from public.profiles where id = '00000000-0000-0000-0000-000000000001'), 'admin can grant a role');
select tests.expect_denied($$select public.set_user_role('00000000-0000-0000-0000-00000000000a', 'editor')$$, 'admin cannot change their own role');
delete from public.posts where id = '20000000-0000-0000-0000-000000000003';
select tests.expect((select count(*) from public.posts where id = '20000000-0000-0000-0000-000000000003') = 0, 'admin can delete a post');
select tests.expect((select count(*) from public.audit_log where action in ('post.create', 'post.status', 'post.delete', 'role.set')) >= 4, 'writes are recorded in the audit log');
select tests.expect_denied($$update public.audit_log set action = 'edited'$$, 'admin cannot rewrite the audit log');
select tests.expect_denied($$delete from public.audit_log$$, 'admin cannot erase the audit log');
select tests.expect_denied($$select * from public.integration_tokens$$, 'even an admin session cannot read integration tokens');

-- ---------------------------------------------------------------- 5. every public table has RLS on
select tests.as_owner();
select tests.expect(
  (select count(*) from pg_tables t join pg_class c on c.oid = (quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))::regclass
   where t.schemaname = 'public' and not c.relrowsecurity) = 0,
  'every table in public has row level security enabled');

rollback;
