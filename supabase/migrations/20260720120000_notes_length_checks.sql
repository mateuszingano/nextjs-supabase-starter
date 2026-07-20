-- Enforce the note size limits AT THE DATABASE, not only in the Zod schema.
--
-- The API route validates title/body with Zod, but `authenticated` holds a
-- direct grant on public.notes (needed for RLS to be the thing that scopes
-- rows), so a user can talk to PostgREST with their own JWT and skip the app
-- layer entirely — inserting a 10 MB title that Zod never saw. These CHECK
-- constraints make the limit true regardless of which client wrote the row,
-- and keep the two layers in agreement (Zod: title 1..200, body <= 10 000).
--
-- Added as a follow-up migration rather than editing the original, so existing
-- databases upgrade cleanly — the pattern the starter wants you to copy.

alter table public.notes
  add constraint notes_title_len check (char_length(title) between 1 and 200),
  add constraint notes_body_len check (char_length(body) <= 10000);
