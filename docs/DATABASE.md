# Database

Postgres on Supabase. The schema lives in `supabase/migrations/` as numbered SQL files applied in order.

| Migration | Contents |
|---|---|
| `…090000_foundations.sql` | `private` schema, roles, profiles, audit log, rate limiter |
| `…090100_content.sql` | Categories, tags, media, posts, links, revisions, products, prices, settings, tokens |
| `…090200_security.sql` | Table privileges and every row level security policy |
| `…090300_search.sql` | `search_posts()` and its indexes |
| `…090400_storage.sql` | `media` bucket and its upload rules |

## Data model

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : has
  CATEGORIES ||--o{ POSTS : groups
  POSTS ||--o{ POST_TAGS : ""
  TAGS ||--o{ POST_TAGS : ""
  POSTS ||--o{ POST_MEDIA : "ordered slides"
  MEDIA ||--o{ POST_MEDIA : ""
  MEDIA |o--o{ POSTS : "cover"
  POSTS ||--o{ POST_REVISIONS : "history"
  POSTS ||--o| SOCIAL_SOURCES : "imported from"
  POSTS ||--o{ POST_PRODUCTS : ""
  PRODUCTS ||--o{ POST_PRODUCTS : ""
  PRODUCTS ||--o{ PRICE_POINTS : "India prices"

  PROFILES {
    uuid id PK
    text display_name
    app_role role "admin, editor or null"
  }
  POSTS {
    uuid id PK
    slug slug UK
    text title
    text deck
    post_kind kind "gallery or article"
    post_status status "draft, published, archived"
    uuid category_id FK
    uuid cover_media_id FK
    jsonb body "versioned block document"
    text source_url
    date prices_checked_on
    text price_sources
    timestamptz published_at
    tsvector search "generated"
  }
  MEDIA {
    uuid id PK
    text storage_path UK
    text alt
    text mime_type
    media_source source "upload or instagram"
  }
  SOCIAL_SOURCES {
    uuid id PK
    uuid post_id FK
    text provider
    text external_id
    text permalink
    text caption
  }
  PRODUCTS {
    uuid id PK
    slug slug UK
    text brand
    text model
    text reference
  }
  PRICE_POINTS {
    uuid id PK
    uuid product_id FK
    int price_inr
    text retailer
    date checked_on
  }
```

Standalone tables: `site_settings` (feature flags), `integration_tokens` (server-only secrets), `audit_log` (append-only), `private.rate_limits`.

## Who can do what

| Table | Visitor | Signed in, no role | Editor | Admin |
|---|---|---|---|---|
| `posts` | read published | read published | read all, create, edit | + delete |
| `categories`, `tags`, `products` | read | read | + create, edit | + delete |
| `price_points` | read | read | full | full |
| `post_tags`, `post_media`, `post_products` | read if post is published | same | full | full |
| `media` | read if used by a published post | same | full | full |
| `social_sources`, `post_revisions` | none | none | read (sources: full) | same |
| `profiles` | none | own row; edit own name | same | read all; roles via `set_user_role()` |
| `site_settings` | read public keys | read public keys | read public keys | full |
| `audit_log` | none | none | none | read only |
| `integration_tokens` | none | none | none | none (server secret key only) |
| Storage `media` bucket | fetch by URL | fetch by URL | upload, replace, remove | same |

Every row of this table is covered by a check in `supabase/tests/001_access_rules.sql`.

## Database functions

| Function | Called by | What it does |
|---|---|---|
| `public.search_posts(q, category, tags, limit, offset)` | anyone | Published posts matching free text (full-text, partial title, tag name), a category and **all** given tags. Limit capped at 50. |
| `public.set_user_role(user_id, role)` | admin | Grants or changes a role. Refuses non-admins and refuses changing your own role. Audited. |
| `public.hit_rate_limit(bucket, max, window_seconds)` | signed-in users | Counts a hit for the caller; returns false once over the limit. |
| `private.has_role(...)`, `is_staff()`, `is_admin()` | policies | Role checks used inside every policy. |
| `private.audit(action, entity, id, meta)` | triggers | Appends to `audit_log`. |
| `private.handle_new_user()` | trigger on `auth.users` | Creates a profile with **no** role for each new sign-in. |
| `private.posts_before_write()` | trigger on `posts` | Maintains `updated_at`; stamps `published_at` on first publish. |
| `private.posts_after_write()` | trigger on `posts` | Stores the previous version in `post_revisions`; audits create, status change and delete. |

## Rules for changing the schema

1. **Never edit a merged migration.** Add a new file: `npx supabase migration new <name>`.
2. **Every new table:** enable row level security, add explicit grants, add policies, add checks to `supabase/tests`. The test suite fails if any `public` table has RLS off.
3. **Every function:** `set search_path = ''` and fully qualified names. `security definer` only when a policy or trigger needs it, and then in the `private` schema.
4. **Run `npm run db:test`** before pushing. CI runs it again, and the deploy workflow runs it a third time before touching production.

## Running the database tests locally

```bash
# any throwaway Postgres 15+; the script drops and recreates its schemas
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run db:test
```

`supabase/tests/bootstrap/supabase_stub.sql` stands in for the parts of Supabase the migrations rely on (`auth.users`, `auth.uid()`, the `anon` / `authenticated` / `service_role` roles, storage tables), so the tests need only plain Postgres. The script refuses to run against a Supabase-hosted database.
