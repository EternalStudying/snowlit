# Backend Current Findings

## Architecture

Spring Boot, MyBatis, and MySQL form a monolith. The Maven compilation target is Java 17. The root Java package and Maven group are xyz.snowlit. Domain terms are in the [glossary](../GLOSSARY.md).

Ten vertical domains are album, auth, diary, feedback, home, messages, notices, story, weather, and wishes. Shared modules:

| Package | Owns |
|---|---|
| web | The HTTP seam: `RequestActorResolver`, `@CurrentActor`, `ApiExceptionHandler` |
| auth | Accounts, WeChat binding, and `AuthSessions` (issue / resolve / revoke business sessions) |
| storage | `ImageIntake`, `ImagePolicy`, `ImageFormat`, and the `ObjectStore` seam |
| failure | `ApplicationFailure`, mapped to HTTP by `ApiExceptionHandler` |
| text | `Text.trim` / `Text.trimToNull` for optional user-entered text |
| infrastructure | Adapters: MinIO and local-disk object stores, Redis session and album-token stores, WeChat and weather gateways |
| config | Wiring, including `StorageConfig`, which picks the object store |

Do not restore retired packages, per-domain image storage classes, or single-implementation service/Impl layers. A class with more than one constructor needs `@Autowired` on the injection constructor; `SpringModuleWiringTests` covers every business module plus `ImageIntake` and `AuthSessions`. Modules using `@Transactional` (AlbumModule, DiaryModule) must stay non-final.

Defensive style: trust framework guarantees (generated ids, required bodies, injected beans, non-null columns) and let unexpected infrastructure failures surface. Null handling belongs only where data is genuinely optional (nullable columns, optional request fields, absent rows).

## Authentication and Sessions

- A business session is a 256-bit random URL-safe token stored in Redis (`loginSession:<token>` → user id) for one hour. There is no JWT. Logout revokes the presented token idempotently and answers 401 only when no token is sent.
- A handler requires login exactly when it declares a required `@CurrentActor` parameter; there is no URL-based rule. `ArchitectureTests.everyEndpointDeclaresWhetherItNeedsLogin` fails for any endpoint that neither requires an actor nor appears in its explicit public list (login, WeChat login/bind, logout, story list/detail).
- Every 401 uses the standard `{status, code, message}` body with code `UNAUTHORIZED`. Missing or unreadable request bodies answer 400 `REQUEST_BODY_INVALID`.
- `AuthenticatedActor` carries the validated couple role (`boyfriend`/`girlfriend`, or null). Home and Diary reject a null role with their own `*_ROLE_NOT_CONFIGURED` codes.

## Authorization and Data Contracts

- [SiteManagerPolicy](src/main/java/xyz/snowlit/auth/SiteManagerPolicy.java) currently grants management to user IDs 1 and 2. Complete multi-couple tenant isolation is not implemented.
- Private diaries are author-readable; updates/deletes check authorship. Messages can be deleted only by their author. Album draft operations check ownership. Wish complete/reopen requires authentication. Client visibility cannot replace backend authorization.
- WeChat login/binding reuses users and Redis sessions. Business tokens are returned; openid, session_key, and AppSecret are not returned to clients.
- Current fields include originalUrl/previewUrl, diary entryDate with date on creation, and feedback imageUrls. Contract changes require checking both clients.
- Story lists/details are public and include record-supplied address/coordinates. Home is authenticated. Image storage keeps uploaded bytes without centralized EXIF removal.
- Diary create, update, and delete each run in one transaction; album likes and views run in one transaction each.

## Images and Object Storage

- Every upload goes through `ImageIntake` with the flow's `ImagePolicy`. The format is detected from the file's first bytes (JPEG, PNG, WebP, GIF); client MIME types and file names are ignored, so extensionless or `application/octet-stream` WeChat files are accepted. Stored objects get the detected content type and extension.
- Policies keep per-domain error codes: `<DOMAIN>_IMAGE_TYPE_INVALID` (400), `<DOMAIN>_IMAGE_TOO_LARGE` (413), `<DOMAIN>_IMAGE_UPLOAD_FAILED` (502). Feedback uses `FEEDBACK_SCREENSHOT_REQUIRED/_TYPE_NOT_ALLOWED/_TOO_LARGE/_UPLOAD_FAILED`; album previews must be WebP (`ALBUM_PREVIEW_TYPE_INVALID`). Limit is 10MB per image.
- Object keys: `<prefix>[/yyyy/MM]/<path…>/<uuid>.<ext>`. Prefixes are fixed in code (album, diary/tmp, story, wish, messages, feedback); the former `minio.*-prefix` settings are gone.
- `StorageConfig` uses MinIO when endpoint, access key, secret key, bucket, and public base URL are all set; otherwise it logs a warning and uses `LocalDiskObjectStore` (`storage.local.directory`, default `target/local-uploads`), served at `storage.local.public-path` (default `/uploads/**`).
- Album likes: one insert-or-flip statement per request, then the matching counter change. Views count when the request creates today's activity row or marks a like-only row as viewed.

## Configuration and Runtime

- Dev defaults: port 8080, MySQL 127.0.0.1:3306/snowlit_dev, Redis 6379, and MinIO 9000. Actual configuration and environment variables remain authoritative.
- Dev SQL initialization defaults to always and can recreate/reseed tables. Prod defaults to never. Explicitly use never for retained data and perform migrations separately.
- The [local configuration example](config/local.properties.example) corresponds to ignored local.properties: mode 600, outside resources, imported only by dev from root/backend working directories. Environment variables take precedence.
- Database, Redis, and storage credentials use LOCAL_* or production variables. Never copy real keys into source, documentation, reports, or client bundles.
- Album likes/views use UTC calendar days; dev JDBC defaults to UTC. Existing activity dates are not recalculated. Other time fields retain their contracts.
- After `git` removes source files, run `mvn clean` before packaging; stale classes in `target/` can break startup.

## Global Location and Weather

Geoapify and Open-Meteo receive WGS84 coordinates only after WeatherGateway.Coordinates rounds them to two decimal places. Location is requested at city level. Missing country/city stays unknown; location and weather fail independently.

Complete results cache for 20 minutes, partial/failure results for 2 minutes, with about 2048 grid entries and same-grid request coalescing. Expiry uses Instant. Geoapify credentials remain backend-only; an Open-Meteo commercial key is optional.

HomeVo contains couple, dailyNote, personStatuses, distance, latest, and stats. Seed accounts are demo_a/demo_b with blank location; existing accounts, bindings, and actual content remain preserved.

## Verification Limits

Recorded results are in progress.md. Local code does not establish real-device behavior, production state, registration ownership, WeChat backend settings, or metadata in existing uploaded photos.
