# Backend Current Findings

## Architecture

Spring Boot, MyBatis, and MySQL form a monolith. The Maven compilation target is Java 17. The root Java package and Maven group are xyz.snowlit. Domain terms are in the [glossary](../GLOSSARY.md).

Eleven vertical domains are album, auth, diary, draft, feedback, home, messages, notices, story, weather, and wishes. Shared modules:

| Package | Owns |
|---|---|
| web | The HTTP seam: `RequestActorResolver`, `@CurrentActor`, `ApiExceptionHandler` |
| auth | Accounts, WeChat binding, and `AuthSessions` (issue / resolve / revoke business sessions) |
| storage | `ImageIntake`, `ImagePolicy`, `ImageFormat`, and the `ObjectStore` seam |
| failure | `ApplicationFailure`, mapped to HTTP by `ApiExceptionHandler` |
| text | `Text.trim` / `Text.trimToNull` for optional user-entered text |
| paging | `PageWindow`: page/size clamping, offset, hasMore |
| infrastructure | Adapters: MinIO and local-disk object stores, Redis session and album-token stores, WeChat and weather gateways |
| config | Wiring: `ClockConfig` (the one application `Clock`), `StorageConfig` (picks the object store) |

Inside features:

| Feature | Modules |
|---|---|
| album | `AlbumModule` (published catalog, daily likes/views, highlights), `AlbumPublisher` (publication validation, insertion and upload policies), `AlbumPrivateAccess` (password unlock, failure lock, access tokens); package-private `Albums` holds shared lookups and response mapping |
| diary | `DiaryModule`; package-private `DiaryMarkdown` reads title, summary and image URLs from Markdown |
| home | `HomeModule` composes the overview from other features' modules; `MemberLocations` owns each member's stored location (Diary uses it for weather snapshots) |
| weather | `WeatherModule`; `WeatherCondition` is the typed condition (label + state/variant/precipitation) the gateway reports |

Features read each other only through modules: `DiaryModule.latestShared`, `AlbumModule.latestPublicPhoto/photoCount`, `WishModule.latest/totals`, `MessageModule.latest/count`. `ArchitectureTests.mappersOnlyQueryTheirOwnFeature` fails when a mapper imports another feature.

Do not restore retired packages, per-domain image storage classes, or single-implementation service/Impl layers. Modules have one constructor and take the shared `Clock` bean; tests pass a fixed clock. `SpringModuleWiringTests` covers every business module plus `ImageIntake`, `AuthSessions`, `DraftModule`, `AlbumPublisher`, `AlbumPrivateAccess` and `MemberLocations`. Modules using `@Transactional` (AlbumModule, DiaryModule) must stay non-final.

Defensive style: trust framework guarantees (generated ids, required bodies, injected beans, non-null columns) and let unexpected infrastructure failures surface. Null handling belongs only where data is genuinely optional (nullable columns, optional request fields, absent rows).

## Authentication and Sessions

- A business session is a 256-bit random URL-safe token stored in Redis (`loginSession:<token>` → user id) for one hour. There is no JWT. Logout revokes the presented token idempotently and answers 401 only when no token is sent.
- A handler requires login exactly when it declares a required `@CurrentActor` parameter; there is no URL-based rule. `ArchitectureTests.everyEndpointDeclaresWhetherItNeedsLogin` fails for any endpoint that neither requires an actor nor appears in its explicit public list (login, WeChat login/bind, logout, story list/detail).
- Every 401 uses the standard `{status, code, message}` body with code `UNAUTHORIZED`. Missing or unreadable request bodies answer 400 `REQUEST_BODY_INVALID`.
- `AuthenticatedActor` carries the validated couple role (`boyfriend`/`girlfriend`, or null) and the manager flag. Home and Diary reject a null role with their own `*_ROLE_NOT_CONFIGURED` codes; album, story and wish writes call `actor.requireManager` with their own `*_FORBIDDEN` codes.

## Authorization and Data Contracts

- `User.isManager` currently grants management to user IDs 1 and 2. Complete multi-couple tenant isolation is not implemented; it would need couple-owned records and a schema change, which was deliberately left out.
- Private diaries are author-readable; updates/deletes check authorship. Messages can be deleted only by their author. Album draft operations check ownership. Wish complete/reopen requires authentication. Client visibility cannot replace backend authorization.
- WeChat login/binding reuses users and Redis sessions. Business tokens are returned; openid, session_key, and AppSecret are not returned to clients.
- Album draft creation and photo metadata preserve missing location as an empty string. They do not substitute Earth. Draft fields and photo shooting dates may be absent. Album eventDate is required at publish; a photo without takenAt uses that eventDate, as confirmed by the owner. The mini program waits for EXIF/place work and otherwise asks for an album date. Existing records and the locked-private-album presentation mask are unchanged.
- Current fields include originalUrl/previewUrl, diary entryDate with date on creation, and feedback imageUrls. Contract changes require checking both clients.
- Story lists/details are public and include record-supplied address/coordinates. Home is authenticated. Image storage keeps uploaded bytes without centralized EXIF removal.
- Diary create, update, and delete each run in one transaction; album likes and views run in one transaction each.

## Unified Drafts

`DraftModule` owns one `drafts` row per `(user_id, kind)` for album, diary and moment. Its annotated mapper never writes another domain's tables. Publication enters the narrow `AlbumModule.createFromDraft`, `DiaryModule.createFromDraft` and `StoryModule.createFromDraft` methods. The album helper retains the existing original/WebP-preview policies; diary and story draft uploads share their edit-upload policies.

- `GET/PUT/DELETE /api/drafts/{kind}` read, replace fields, or discard. `POST .../images`, `DELETE .../images/{imageId}`, and `POST .../publish` own media and publication. Kind URLs contain no draft or member id.
- Album/moment require manager authorization; diaries resolve the signed-in couple role. Every operation addresses the acting member's row only.
- `fields_json` is a strict partial form: reject unknown keys, wrong types, invalid enums/dates and column-length overflow as `DRAFT_FIELDS_INVALID`. Diary Markdown retains its 60,000-character cap; text and the complete serialized fields object must also fit 65,535 UTF-8 bytes (owner clarification). Passwords are accepted only in the album publish envelope and never saved.
- `images_json` contains server-generated opaque ids and server-owned object metadata. Responses expose only display data, never object names. Uploads compensate stored objects on failure. Image mutations lock the row; fields saves update only fields_json. Field saves from different clients use last-save-wins.
- Publication saves the latest fields before create validation. Expected validation/conflict failures commit only those fields and retain images; unexpected write failures roll back. Successful creation and draft deletion share one transaction. Object cleanup runs best effort after commit, including unused diary images and discarded/removed images.
- Draft diary images never enter diary_uploads before publication, so hourly six-hour temporary-upload cleanup cannot expire them. Publication inserts permanent uploads/references only for images actually referenced by Markdown.
- The owner superseded the original 300-Web/9-mini split with a **50-photo album cap everywhere**. Native selection remains at most nine per picker call across batches. Older over-cap drafts remain intact and can be reduced before publication. Diary/moment image limits remain 20/3.
- Old album draft endpoints, lifecycle methods/VOs and `ALBUM_DRAFT_EXISTS` are removed. Catalog, detail, activity and public highlights remain published-only. Existing diary/story upload endpoints remain available for editing.

Only schema.sql changes SQL: drafts is added after moments; all 16 existing table definitions are unchanged. Retained databases with SQL_INIT_MODE=never need a reviewer-approved, backed-up, one-time table creation and conversion of old album drafts. This implementation did **not** inspect or migrate retained databases, restart services or push.

## Images and Object Storage

- Every upload goes through `ImageIntake` with the flow's `ImagePolicy`. The format is detected from the file's first bytes (JPEG, PNG, WebP, GIF); client MIME types and file names are ignored, so extensionless or `application/octet-stream` WeChat files are accepted. Stored objects get the detected content type and extension.
- Policies keep per-domain error codes: `<DOMAIN>_IMAGE_TYPE_INVALID` (400), `<DOMAIN>_IMAGE_TOO_LARGE` (413), `<DOMAIN>_IMAGE_UPLOAD_FAILED` (502). Feedback uses `FEEDBACK_SCREENSHOT_REQUIRED/_TYPE_NOT_ALLOWED/_TOO_LARGE/_UPLOAD_FAILED`; album previews must be WebP (`ALBUM_PREVIEW_TYPE_INVALID`). Limit is 10MB per image.
- Object keys: `<prefix>[/yyyy/MM]/<path…>/<uuid>.<ext>`. Prefixes are fixed in code (album, diary/tmp, story, wish, messages, feedback); the former `minio.*-prefix` settings are gone.
- `StorageConfig` uses MinIO when endpoint, access key, secret key, bucket, and public base URL are all set; otherwise it logs a warning and uses `LocalDiskObjectStore` (`storage.local.directory`, default `target/local-uploads`), served at `storage.local.public-path` (default `/uploads/**`).
- The retained local setup now supplies all five LOCAL_MINIO_* settings in ignored local.properties (2026-10-19). Existing disk album objects and URL references were migrated with backups and SHA-256 verification. The local bucket's existing read policy was reused unchanged. A restart with configuration alone never migrates existing media.
- Album likes: one insert-or-flip statement per request, then the matching counter change. Views count when the request creates today's activity row or marks a like-only row as viewed.

## Configuration and Runtime

On 2026-10-21 the owner authorized a full current backend/Web production deployment and separately approved the missing drafts table. Production retains its existing credentials, prod profile, data and media with SQL_INIT_MODE=never. GEOAPIFY_BASE_URL and the existing authorized provider key are now supplied through the mode-600 production environment; the local backend is also running. Backups and receipt paths are recorded in progress.md / ignored deployment evidence.

- Dev defaults: port 8080, MySQL 127.0.0.1:3306/snowlit_dev, Redis 6379, and MinIO 9000. Actual configuration and environment variables remain authoritative.
- Dev SQL initialization defaults to always and can recreate/reseed tables. Prod defaults to never. Explicitly use never for retained data and perform migrations separately.
- The [local configuration example](config/local.properties.example) corresponds to ignored local.properties: mode 600, outside resources, imported only by dev from root/backend working directories. Environment variables take precedence.
- Database, Redis, and storage credentials use LOCAL_* or production variables. Never copy real keys into source, documentation, reports, or client bundles.
- When SQL initialization is disabled, a listening port does not establish MySQL authentication: the pool can connect lazily on the first query. The local credential file also supports LOCAL_DB_PASSWORD and SQL_INIT_MODE=never. Check a database-backed endpoint when verifying startup.
- Album likes/views use UTC calendar days; dev JDBC defaults to UTC. Existing activity dates are not recalculated. Other time fields retain their contracts.
- Removed Java sources may leave stale classes in `target/`. Remove only those obsolete class files or build in an isolated checkout before packaging. Preserve any retained `target/local-uploads`; do not blindly clean a retained upload directory.

## Global Location and Weather

Geoapify and Open-Meteo receive the original WGS84 coordinates after finite/range validation; rounding was removed by user request on 2026-10-20. Geoapify is requested at city level. If it returns a suburb/district/county, an optional administrative point lookup can identify the parent city for a mislabeled city field. Its failure preserves the already resolved location. District fields prefer administrative districts/counties over suburbs. No names or countries are hardcoded. Missing country/city stays unknown; location and weather fail independently.

Complete results cache for 20 minutes, partial/failure results for 2 minutes, with about 2048 exact-coordinate entries and same-coordinate request coalescing. Expiry uses Instant. Geoapify credentials remain backend-only; an Open-Meteo commercial key is optional.

`GEOAPIFY_BASE_URL` / `geoapify.base-url` selects the origin for both reverse and administrative-boundary requests. Omitted or blank values retain `https://api.geoapify.com`; whitespace and trailing slashes are removed. The ignored dev local configuration currently selects `https://geoapify-api-htz.b-cdn.net`, a public DNS alias of the official EU endpoint that passed direct server checks. It is not a separately guaranteed API hostname and may change. Production sets this variable through its deployment environment; it does not read dev local.properties. Open-Meteo host/key selection, precise coordinates, timeouts and fallback behaviour are unchanged.

HomeVo contains couple, dailyNote, personStatuses, distance, latest, and stats. Seed accounts are demo_a/demo_b with blank location; existing accounts, bindings, and actual content remain preserved.

## Deliberately Not Done

- Entities stay mutable classes: MyBatis inserts write generated ids back through setters, so records do not fit.
- No migration tool and no tests against a real database (user decision, 2026-10-18).
- Weather keyword variants that no provider produces (haze, dust, sandstorm, windy, hot, cold) are no longer mapped.

## Verification Limits

Recorded results are in progress.md. Local code does not establish real-device behavior, production state, registration ownership, WeChat backend settings, or metadata in existing uploaded photos.

## WeChat Production Configuration and Failures (2026-10-21)

Production configuration is separate from ignored dev local.properties. The stale server AppSecret was synchronized only after the authorized local credential was validated with the official API; AppID and bindings stayed unchanged. Invalid/reused code errors (40029/40163) map to authentication failure, invalid application credentials (40013/40125) map to configuration failure, and other provider errors map to dependency failure. Credentials and complete upstream bodies must remain outside project artifacts.
