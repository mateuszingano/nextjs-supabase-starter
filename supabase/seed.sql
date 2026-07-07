-- Local development seed. Runs after migrations on `supabase db reset`.
-- Demo login →  email: demo@example.com   password: password123

-- NOTE: the token columns must be '' (empty string), not NULL. GoTrue reads them
-- as Go strings and a NULL makes sign-in fail with a 500.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'demo@example.com',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{}'
);

-- Identity row (required by GoTrue for email/password sign-in).
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@example.com"}',
  'email',
  '11111111-1111-1111-1111-111111111111',
  now(), now(), now()
);

-- A couple of starter notes owned by the demo user.
insert into public.notes (author_id, title, body)
values
  ('11111111-1111-1111-1111-111111111111',
   'Welcome to your Next.js + Supabase starter',
   'This note is yours. Row-Level Security guarantees only you can read it — not other signed-in users, not anonymous visitors.'),
  ('11111111-1111-1111-1111-111111111111',
   'Try the RLS test',
   'Run `npm run test:rls` to watch two users stay isolated. Proof, not vibes.');
