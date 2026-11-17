# Architecture

## Principles

1. **The database is the last line of defence.** Every rule about who can read or change what is enforced in Postgres (row level security). The app checks too, but a bug in the app cannot open the data.
2. **One way in.** The browser changes data only through server actions, and every action goes through the same wrapper.
3. **Registries, not switch statements.** Content blocks and import sources are registered in one place each. Adding one does not touch existing code.
4. **Pure core.** `domain` and `blocks` have no database, network or framework code, so they are trivial to test and reuse.
5. **No stored HTML.** Articles are structured data. Nothing a writer or an outside API supplies is ever rendered as markup.

## Saving a post

```mermaid
sequenceDiagram
  actor Ed as Editor
  participant UI as Admin page
  participant Act as Server action<br/>(makeAction wrapper)
  participant Svc as posts.service
  participant Repo as posts.repo
  participant DB as Postgres (RLS)

  Ed->>UI: Press Save
  UI->>Act: updatePostAction(input)
  Act->>Act: 1. Validate with zod (blocks registry checks every block)
  Act->>DB: 2. Verify session, read role
  Act->>Act: 3. Rate limit (if configured)
  Act->>Svc: 4. updatePost(ctx, input)
  Svc->>Repo: updatePost / setPostTags
  Repo->>DB: UPDATE posts ... (as the signed-in user)
  DB->>DB: RLS: is this user staff?
  DB->>DB: Trigger: store previous version, write audit log
  DB-->>Repo: row
  Repo-->>Svc: PostRow
  Svc-->>Act: PostRow
  Act->>Act: revalidate cached pages
  Act-->>UI: { ok: true, data }
```

If any step fails, the action returns `{ ok: false, error: { code, message } }`. Only messages written for people (`AppError`) reach the browser; anything unexpected is logged on the server and replaced with a generic message.

## Importing from an Instagram link

```mermaid
sequenceDiagram
  actor Ed as Editor
  participant Act as importFromLinkAction
  participant Svc as import.service
  participant Reg as Importer registry
  participant IG as Instagram API
  participant SF as safeDownload
  participant DB as Postgres + Storage

  Ed->>Act: { link, categoryId }
  Act->>Act: Validate, require staff, rate limit (10 per 10 min)
  Act->>Svc: importFromLink
  Svc->>Reg: resolve(link)
  Reg-->>Svc: instagram importer (https + known host only)
  Svc->>DB: read token (secret-key client, this table only)
  Svc->>IG: list own media, find the post by short code
  IG-->>Svc: caption + image addresses
  Svc->>DB: already imported?
  loop each slide (max 20)
    Svc->>SF: download (allow-listed host, no redirects, 8 MB cap, image types only)
    Svc->>DB: upload to media bucket + media row
  end
  Svc->>DB: create draft gallery post, link slides, record source
  Svc-->>Act: { postId, slides }
```

The import always creates a **draft**. Publishing is a separate action, so nothing reaches the public site without a person choosing to publish it.

## Reading (public pages)

Public pages read with the anonymous key. Row level security returns only published posts, so the same query functions are safe to call from any page. Public pages are static or cached; they do not pass through `proxy.ts`.

Search is one database function, `search_posts`, called from `GET /api/search` and from server-rendered pages:

```mermaid
flowchart LR
  A[Archive page] -->|q, category, tags, page| B["/api/search"]
  B -->|zod validation| C[search.repo]
  C -->|rpc| D["search_posts()"]
  D -->|full text + partial title + tag name<br/>AND category AND all tags| E[(published posts only)]
```

## Content blocks

A post body is `{ "version": 1, "blocks": [ { "id", "type", "data" } ] }`.

```mermaid
flowchart LR
  subgraph Registry["src/blocks/index.ts"]
    H[heading] --- T[text] --- I[image] --- G[gallery]
    S[spec_table] --- P[price_table] --- V[verdict] --- IE[instagram_embed]
  end
  Body[posts.body] -->|bodySchema| Registry
  Registry -->|unknown type or bad data| X[Rejected]
  Registry -->|valid| OK[Saved]
```

Each block definition carries its own validation, its empty state and its plain-text form. House rules live in the block: a price table cannot be saved without a source and a check date, and a verdict cannot be saved without a drawback.

In the UI phase each definition gains a `Renderer` (public page) and an `Editor` (admin) component, registered the same way.

## Where state lives

| State | Lives in | Notes |
|---|---|---|
| Posts, tags, categories, products, prices | Postgres | |
| Images | Supabase Storage, `media` bucket | Random file names; rows in `media` |
| Sign-in session | HTTP-only cookies set by Supabase Auth | Refreshed in `proxy.ts` |
| Roles | `profiles.role` | Changed only by `set_user_role()` |
| Third-party tokens | `integration_tokens` | Server-only |
| Feature flags | `site_settings` | |
| History | `post_revisions`, `audit_log` | Written by triggers; cannot be edited from the app |
