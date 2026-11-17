# Adding features

Each recipe lists every file you touch. If a change seems to need more than this, it probably belongs in a different layer.

## A new content block (for example a pull quote)

1. Create `src/blocks/definitions/pull-quote.ts`:
   ```ts
   export const pullQuote = defineBlock({
     type: 'pull_quote',
     label: 'Pull quote',
     schema: z.object({ quote: requiredText(300), credit: text(80).default('') }),
     empty: () => ({ quote: 'Quote', credit: '' }),
     toPlainText: (d) => d.quote,
   })
   ```
2. Add `.register(pullQuote)` in `src/blocks/index.ts`.
3. Add a case to `tests/blocks.test.ts`.

No migration: block data lives in `posts.body`. Never rename a `type` once posts use it; to change a block's shape incompatibly, add a new type.

## A new import source (for example YouTube)

1. Create `src/integrations/importers/youtube/importer.ts` implementing `SourceImporter` (`provider`, `imageHosts`, `matches`, `fetchPost`).
2. Register it in `src/integrations/importers/index.ts`.
3. Store its token: `insert into integration_tokens (provider, access_token) values ('youtube', …)`.
4. Add tests beside `tests/importers.test.ts`.

No migration: `social_sources.provider` and `integration_tokens.provider` are free text. `importFromLink` and the admin screen work unchanged.

## A new server action

```ts
const run = action({
  name: 'tags.create',
  roles: STAFF,                      // who may call it
  schema: z.object({ name: z.string().trim().min(1).max(60) }),
  rateLimit: { bucket: 'tags', max: 30, windowSeconds: 60 },   // optional
  handler: (input, ctx) => createTag(ctx, input),               // service function
})
export async function createTagAction(input: unknown) { return run(input) }
```

Put the database query in `src/data`, the rule in `src/services`, and only wiring here.

## A new table

1. `npx supabase migration new <name>`.
2. In it: create the table, `enable row level security`, add grants, add policies using `private.is_staff()` / `private.is_admin()`.
3. Add checks to `supabase/tests/` for a visitor, a user with no role, an editor and an admin.
4. Add a repository file in `src/data`.
5. `npm run db:test`.

## A new role (for example "contributor")

1. Migration: `alter type public.app_role add value 'contributor';` and policies for what the role may do.
2. `src/domain/roles.ts`: add it to `ROLES` and to the right role lists.
3. Tests in `supabase/tests`.

## A new page

Public pages go in `src/app/<route>/page.tsx` and read through `src/data` with `createSessionClient()`. Admin pages go under `src/app/admin/`, where the layout and `proxy.ts` already gate them.

## A feature flag

Insert a row in `site_settings` (`feature.<name>`), read it through a repository function, and branch on it in the service. Mark it `is_public` only if the browser needs it.

## A new field on posts

1. Migration: `alter table public.posts add column …` with a `check` constraint.
2. `src/data/types.ts` and the `COLUMNS` list in `posts.repo.ts`.
3. `postInputSchema` in `src/domain/post.ts` and `toRow` in `posts.service.ts`.
