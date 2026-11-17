# Function reference

What each function does, grouped by layer. Database functions are in [DATABASE.md](DATABASE.md).

## Config (`src/config`)

| Function | Logic |
|---|---|
| `publicEnv()` | Validates the three browser-safe variables once and caches them. Throws a clear error if one is missing. |
| `serverEnv()` | Same for secrets. The file is `server-only`, so importing it into browser code fails the build. |

## Domain (`src/domain`)

| Function / schema | Logic |
|---|---|
| `slugify(text)` | Lower-cases, strips accents, turns ₹ into "rs", replaces anything else with `-`, trims to 120 characters. Falls back to `post`. |
| `postInputSchema` | What a new post must contain: title (1–160), deck (≤300), category, up to 20 tags, a body that passes the block registry, optional https source link and price check date. |
| `postUpdateSchema` | Same fields, all optional, plus the post `id`. |
| `searchParamsSchema` | `q` (≤100), `category`, up to 10 `tags`, `page` (1–500). |
| `hasRole(user, allowed)` | True when the user has one of the allowed roles. |
| `AppError(code, message)` | An error whose message is safe to show to the person using the admin. |
| `ok(data)` / `fail(code, message)` | Build the `ActionResult` every action returns. |

## Blocks (`src/blocks`)

| Function | Logic |
|---|---|
| `defineBlock(def)` | Declares a block: `type`, `label`, `schema`, `empty()`, `toPlainText()`. |
| `BlockRegistry.register(def)` | Adds a block. Rejects bad or duplicate type names. |
| `BlockRegistry.bodySchema()` | Validates a whole body: version must be 1, at most 200 blocks, unique ids, every block's type must be registered and its data must pass that block's schema. Applies defaults. |
| `BlockRegistry.toPlainText(body)` | Joins the readable text of every block. |

| Block type | Data | House rule enforced |
|---|---|---|
| `heading` | text, level 2 or 3 | |
| `text` | text (≤5000) | plain text only |
| `image` | mediaId, caption, tilt | |
| `gallery` | 1–20 mediaIds, caption | |
| `spec_table` | 2–4 columns, 1–30 rows, note | each row has one value per column |
| `price_table` | rows (model, priceInr, movement, note), source, checkedOn | source and check date are required |
| `verdict` | pick, price, summary, reasons, drawback, runner-up | at least one reason and a drawback |
| `instagram_embed` | permalink | must be an `instagram.com/p/…` or `/reel/…` address |

## Data (`src/data`)

All take the request's database client, so row level security applies.

| Function | Logic |
|---|---|
| `getPostById(db, id)` | One post, or `not_found`. |
| `getPublishedPostBySlug(db, slug)` | Published post for the article page, or null. |
| `listPostsForAdmin(db, status?)` | Latest 200 posts, optionally by status. |
| `slugExists(db, slug)` | Is this web address taken? |
| `insertPost` / `updatePost` / `deletePost` | Single-row writes. `deletePost` reports `forbidden` if nothing was deleted (non-admins cannot see the row to delete). |
| `setPostTags(db, postId, tagIds)` | Replaces the post's tags with exactly this set. |
| `setPostMedia(db, postId, mediaIds)` | Replaces the post's slides, in order. |
| `searchPosts(db, params)` | Calls `search_posts`, 24 per page, maps rows to `PostSummary`. |
| `saveImage(db, image)` | Uploads to `media/<source>/<random>.ext`, inserts the `media` row, removes the file again if the row fails. |
| `findSource` / `insertSource` | Has this outside post been imported? Record where a post came from. |
| `getIntegrationToken(provider)` | Reads a third-party token with the secret-key client. Reports a clear error when missing or expired. |
| `raise(error, context)` | Maps database error codes to `AppError`s (duplicate → `conflict`, permission → `forbidden`, …). |

## Integrations (`src/integrations`)

| Function | Logic |
|---|---|
| `assertSafeUrl(link, allowedHosts)` | Requires https, no user/password, default port, and a host that is on the list or a sub-domain of it. |
| `safeDownload(link, options)` | `assertSafeUrl`, then fetch with redirects refused and a timeout; checks status 200, content type and size (declared and actual). |
| `ImporterRegistry.resolve(link)` | Parses the link, requires https, returns the importer whose `matches()` accepts it. |
| `parseInstagramPermalink(url)` | Accepts `/p/<code>/`, `/reel/<code>/` and `/<user>/p/<code>/` on instagram.com; returns the short code and a clean address. |
| `findOwnMediaByShortcode(token, code, options)` | Pages through the connected account's media (50 per page, up to 6 pages) until a permalink contains the short code. Token is sent in a header. |
| `createInstagramImporter(options)` | The Instagram `SourceImporter`: returns caption plus image addresses in slide order, skipping videos. |

## Services (`src/services`)

| Function | Logic |
|---|---|
| `uniqueSlug(db, wanted)` | `slugify`, then tries `name`, `name-2`, … until one is free. |
| `createPost(ctx, input)` | Creates a **draft** owned by the caller, then sets its tags. |
| `updatePost(ctx, input)` | Updates only the fields given. Refuses to change the web address of a post that has been published. |
| `setPostStatus(ctx, id, status)` | Publish, archive or return to draft. Publishing an empty post is refused. |
| `removePost(ctx, id)` | Deletes a post (admin only, enforced by action and database). |
| `headlineFromCaption(caption)` | First non-empty line of a caption, up to 160 characters. |
| `importFromLink(ctx, request, deps)` | Resolve source → get token → fetch post → refuse if already imported or no images → download and store each slide → create draft gallery post → link slides → record source. |

## Server (`src/lib/action.ts`, `src/server`)

| Function | Logic |
|---|---|
| `makeAction(deps)` | Returns `action(options)`. Each action runs: validate → `requireRole` → rate limit → handler; converts `AppError` to a result and hides anything else. Dependencies are injected for testing. |
| `getSessionUser(db)` | Verifies the session token, reads the role from `profiles`. Null when signed out. |
| `requireRole(db, allowed)` | Throws `unauthenticated` or `forbidden`. |
| `createPostAction`, `updatePostAction`, `setPostStatusAction` | Staff. Thin wrappers over the services; refresh cached pages. |
| `deletePostAction` | Admin only. |
| `importFromLinkAction` | Staff, limited to 10 per 10 minutes per person. |
| `proxy(request)` | For `/admin` and `/login`: strict CSP with a nonce, session refresh, redirect signed-out visitors, `no-store`, `noindex`. |
| `GET /api/search` | Validates the query string, returns `{ results }`, cached for 60 seconds. |
| `GET /api/health` | `{ ok: true }` for uptime checks. |
