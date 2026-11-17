-- Starting reference data. Safe to run more than once.
insert into public.categories (slug, name, sort_order) values
  ('comparison', 'Comparisons', 10),
  ('buying-guide', 'Buying guides', 20),
  ('verdict', 'Verdicts', 30),
  ('story', 'Stories', 40),
  ('awards', 'Awards', 50)
on conflict (slug) do nothing;

insert into public.tags (slug, name) values
  ('tissot', 'Tissot'), ('citizen', 'Citizen'), ('g-shock', 'G-Shock'), ('hamilton', 'Hamilton'),
  ('hmt', 'HMT'), ('jaipur-watch-company', 'Jaipur Watch Company'), ('gphg', 'GPHG'),
  ('automatic', 'Automatic'), ('integrated-bracelet', 'Integrated bracelet'),
  ('made-in-india', 'Made in India'), ('on-screen', 'On screen'),
  ('under-5k', 'Under ₹5K'), ('under-1-lakh', 'Under ₹1 lakh')
on conflict (slug) do nothing;

insert into public.site_settings (key, value, is_public) values
  ('feature.instagram_import', 'true'::jsonb, false),
  ('site.tagline', '"Thoughtful comparisons. Clearer choices."'::jsonb, true)
on conflict (key) do nothing;
