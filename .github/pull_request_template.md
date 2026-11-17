## What changed

## Checklist
- [ ] `npm run check` passes locally
- [ ] If the database changed: a new migration file (never an edited old one) and `npm run db:test` passes
- [ ] If a table was added: row level security is enabled and it has a test in `supabase/tests`
- [ ] No secrets, tokens or `.env` files in the diff
- [ ] Docs updated if behaviour or structure changed
