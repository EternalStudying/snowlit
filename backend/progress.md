# Backend Progress Baseline

## Published album management (2026-10-21)

Implemented AlbumEditor, internal edit drafts, atomic save/delete with after-commit cleanup, stamped private tokens and creation order. Maven: 334 tests passed; real throwaway MySQL/Redis/MinIO smoke: 16/16, with all owned resources removed. Only the drafts.kind comment changed in schema.sql. No retained-service access, deployment or push. Old private tokens invalidate once on eventual deployment.

## Production Mini-program Notice (2026-10-21)

After the owner reviewed the wording and selected title v1.2.0, inserted one enabled miniprogram notice (id 16, version 1.2.0) with five approved items. Existing notices and notice_mutes stayed unchanged; a restricted pre-insert snapshot and guarded rollback are retained on the server. Authenticated HTTPS reads returned the exact mini notice and unchanged Web notice. The expired simulator session initially returned 401; a fresh native WeChat verification session passed and was immediately revoked. No schema, application source, configuration, restart, binding or simulator auth-cache change. Evidence: ignored codex-work/mini-notice-20261021/.

## Production Mini-program Acceptance (2026-10-21)

Recompiled the mini program and exercised real production WeChat login, native simulator location, Home weather, and album/diary/moment creation uploads. Found a stale production AppSecret: AppID matched local configuration, but the secret differed and WeChat returned 40125. Validated the authorized local secret (invalid-code probe returned 40029), backed up the server environment, synchronized only that secret and restarted the backend. Real UI login and authenticated auth/me passed. No account binding was created or changed.

Fixed WechatLoginRestGateway so invalid/reused codes remain authentication failures, invalid application credentials are configuration failures, and provider errors are dependency failures. Regression tests first reported 2 failures out of 7, then the complete offline backend suite passed 310/310. The packaged fix was deployed with SHA-256 verification and rollback backup, and the owned local backend was restarted with SQL_INIT_MODE=never. A fresh real WeChat exchange against the final production package returned 200; its extra verification session was revoked while the simulator's original session stayed valid.

Native wx.getLocation and the real Home update flow succeeded; the weather endpoint returned 200 with known country/city, condition and temperature, and the page displayed populated weather/place. Normal Home location/weather persistence ran for the current member. Generated images exercised the actual page controls, compression, wx.uploadFile, autosave and native online image decoding for album, diary and moment. Three drafts produced four MinIO objects, verified with signed server-side reads. Public previews matched the MinIO bytes; album originals remained private under the existing policy (anonymous 403). No policy was changed.

All three task-marked drafts were discarded through guarded normal APIs; reads returned no draft and all four signed MinIO reads returned 404. The generated simulator fixture and test memory were removed, chooseMedia was restored, and the simulator was left on Home with auth/me 200. No content was published, no schema initialized, no unrelated service changed, and no mini-program package was uploaded. Fresh native checks passed 184 tests in each of four timezones and syntax checks passed all 133 JS files. Temporary evidence is in ignored codex-work/mini-production-smoke-20261021/.

Native file picking was replaced only with a generated fixture result; physical devices, production WeChat domain/privacy approval and publication were not verified. The existing private developer-tool setting disables legal-domain checking, so these simulator requests do not prove release-domain approval. No commit or push.


## Full Production Deployment (2026-10-21)

Under explicit owner authorization, deployed the complete current backend and matching Web build to the existing server, started the previously stopped local backend, and restarted only snowlit-backend.service. Production now uses the configured Geoapify CDN origin with Open-Meteo unchanged. Both environments retain SQL_INIT_MODE=never. The owner separately approved creating the sole missing drafts table; production had no old drafts to convert. The original sixteen business tables' definitions and data matched the pre-deployment backup. Existing accounts, credentials and media were preserved.

The server jar matches the local packaged artifact SHA-256; all 129 HTTPS static files match the local Web build. Production public story reads pass (200), protected weather/drafts require login (401), and the retired album draft route returns 404. Fresh frontend checks: 451 tests, vue-tsc/build passed. The deployed gateway with live process provider configuration passed 8 location and 8 weather checks in an isolated context. The public login form rendered with no captured browser errors. Other service MainPIDs were unchanged. Root-only rollback material is retained on the server; ignored detailed evidence is under codex-work/geoapify-deploy-20261021/.

Authenticated production write/login/geolocation flows and mini-program simulator/device checks were not run; the owner will upload the mini program. Existing sessions need sign-in again. Changes remain uncommitted on codex/geoapify-configurable-endpoint, with no push; the owner's untracked specification is untouched.


## Configurable Geoapify Ingress (2026-10-21)

- Started on `codex/geoapify-configurable-endpoint` from main. The tracked tree was clean; the owner's untracked specification remains untouched. No commit or push is authorized.
- Prior server probes found the default and official EU hostnames unavailable on that route, but the EU endpoint's public CDN alias worked with the existing key. A separate JDK transport probe passed 12 Geoapify and 2 Open-Meteo requests; this does not yet verify the changed application gateway.
- Implemented one configurable Geoapify origin for reverse/boundary lookups, selected the tested CDN alias in ignored mode-600 local.properties, and updated routing regressions/example/development documentation. Open-Meteo is unchanged. No deployment, retained-service restart or data access.
- The first Maven invocation ran from the repository root and stopped before tests because that directory has no pom.xml; corrected the working directory to backend.
- Targeted sandbox run: 101 tests, 0 assertion failures, 58 errors caused by sandbox-blocked Mockito/Byte Buddy JVM attachment; all 43 gateway checks passed. Original XML/text evidence is retained in ignored codex-work/geoapify-config-20261021/sandbox-reports/.
- Complete `mvn -o test` rerun from backend in the normal host environment: 307 tests, 0 failures/errors/skips. No assertion was weakened or skipped.
- An initial real-gateway harness bundled all runtime libraries; slow SSH upload was stopped before execution. Its task-owned upload ended with the expected BrokenPipeError. A process-status lookup was also blocked by the sandbox; the permitted host inspection confirmed transfer progress. Changed approach to an 18KB thin jar and read only the already-present public runtime dependencies on the server, verifying all 14 jars against local Maven SHA-256 hashes before use.
- The actual changed GlobalWeatherGateway and application.yml were wired through an isolated Spring context on the authorized server. Four public city-centre fixtures, two rounds: location 8/8 and weather 8/8 passed. Observed outbound paths: 8 reverse and 6 optional administrative-boundary requests all used the configured CDN; all 8 weather requests used api.open-meteo.com. Country and populated-location checks are not a complete audit of provider hierarchy quality. Structured results and a detailed report are under ignored codex-work/geoapify-config-20261021/.
- The Java jar/key existed only in remote anonymous memory; no server application configuration or business beans were loaded, and no service/configuration/database/media was changed. No dependency was installed. Local mode-600 settings take effect at the next backend start; no retained backend restart or remote deployment was performed. git diff --check passed. Source changes remain uncommitted and not pushed.
- A context lookup initially used a nonexistent architecture/SpringModuleWiringTests path; discovery will use the actual file path. No source or verification result was affected.

## Unified Drafts (2026-10-20)

Unified drafts, narrow publication seams, UTF-8 validation and retired album endpoints are implemented. The 16 previous table definitions are unchanged. The latest complete offline Maven suite passed 301 tests. No retained-service or database rollout checks ran. Source changes are committed on `feature/drafts` (`a77d8e8 / 9af661f / b096289`); no push. Detailed command history and resolved failure outputs are in [the implementation report](../docs/drafts-implementation-report.md).


## City Hierarchy and Original Coordinates (2026-10-20)

- Actual reverse-geocoding output omitted a parent city and used a county name as city. The same provider's administrative point response contained the correct hierarchy. Added optional enrichment for suburb/district/county results, administrative-district preference and graceful enrichment failure. [Provider API reference](https://apidocs.geoapify.com/docs/boundaries/).
- By explicit user instruction, removed coordinate rounding while retaining finite/range validation. Provider request assertions verify original precision. Cache tests verify same-pair reuse and separate responses for nearby distinct pairs; cache bounds and expiry stay unchanged.
- Generic hierarchy regressions failed before the repair. All 263 backend tests pass in the normal host environment; the first full sandbox run failed because Mockito could not attach to its JVM. The precision-test compilation initially lacked an ArgumentMatchers import; this was corrected before the successful full run.
- Restarted the identified, previously running backend with SQL_INIT_MODE=never and existing credentials/storage. A read-only request from the authenticated simulator using the supplied photo's original coordinates returned the correct parent city and district. Current page data stayed unchanged. No database/schema/media writes or new test albums; no original coordinates or source-photo bytes added to project files. Backend remains running.

## Album Shooting Metadata Repair (2026-10-19)

- Reproduced blank-location persistence as Earth with failing album regression tests, then changed draft/photo creation to retain empty optional locations. Existing records and schemas were not changed.
- Targeted album tests: 25 passed. Full `mvn -o test`: 259 tests, zero failures/errors/skips. Restarted the identified local Java backend using SQL_INIT_MODE=never and existing ignored local configuration; no storage fallback or runtime exception was observed.
- In the refreshed simulator, the real EXIF reader parsed a generated valid JPEG's known 2024-02-29 date and public test-landmark GPS, and the existing backend resolved a place. A second fixture contained neither shooting date nor GPS: both fields stayed empty, an inline hint appeared and save was blocked until a date was selected.
- Used the real page compression/upload queue for two unpublished drafts. Reads confirmed album/photo date and place, including a preserved blank location with a manually selected date. Original/preview URLs pointed to MinIO and native image decoding passed.
- Discarded both drafts through their normal API, removed the owned simulator fixture and temporary mc configuration, and checked all 16 table counts/content checksums plus the original two-object inventory against the baseline. All matched. Backend remains running. No native picker or physical-device acceptance; the exact user-selected source photo was not identified.

## Four-Domain MinIO Upload Acceptance (2026-10-19)

- Under explicit user authorization, tested diary, moment, wish-completion and feedback uploads against the retained local backend/MinIO using a generated 32px, 793-byte JPEG. A private database snapshot, all 16 table counts/checksums and the original two-object inventory were recorded first under ignored codex-work/media-upload-check-20261019/.
- Diary, moment and feedback used their real mini-program page upload methods and shared wx.uploadFile wrapper without saving/publishing/submitting business content. Diary inserted the returned URL into in-memory Markdown. Wish completion used a task-owned newly created wish through its real page confirmation handler, persisted completed=true with the MinIO image URL and closed the completion sheet.
- Each flow created one MinIO object. Independently fetched all four through mc and HTTP: SHA-256 matched the fixture, HTTP 200 image/jpeg and native image decoding passed. Diary/feedback upload metadata matched object name, URL, MIME and size; wish state referenced the matching object.
- No application upload defect reproduced. `node --test` over diary-service, diary-edit-upload, story-service, feedback-service, wish-service, media-upload-state and upload-quality: 18 tests passed. No new source code or unit tests were needed.
- Cleaned the task-owned wish through its delete API, the two unreferenced task-owned upload metadata rows through exact ID/object/URL guards, all four test objects, and simulator fixture/state. Original objects, every table count and every table content checksum matched baseline afterward. Active disk uploads stayed empty and the backend log contained no exception or local-fallback markers.
- Native picking was bypassed. The initial native component tag lookup returned no instance; the same owned wish was resumed using the bound page handler and normal event payload. Physical devices, the picker UI and production were not tested. Backend remains running.

## Local MinIO Setup and Migration (2026-10-19)

- User explicitly authorized using the retained local MinIO service, migrating disk photos/references, restarting and testing uploads. The existing bucket and read policy were reused without policy changes.
- Stopped the identified backend, privately backed up the full database, local configuration and media, and recorded exact URL references and rollback SQL under ignored codex-work/minio-migration-20261019/ (directory 700; sensitive files 600).
- Migrated two objects for one album photo (original and preview; 5,022,004 bytes total), keeping object names. SHA-256 matched for local, recovery and MinIO bytes; HTTP reads returned image/jpeg. Updated three fields (one album cover and two photo URLs) in one transaction with old-value checks.
- Persisted all five LOCAL_MINIO_* settings and restarted using SQL_INIT_MODE=never. No local-store fallback warning or exception markers appeared. Retired the active disk files after verification; recovery copies remain.
- Actual mini-program album page compressed and uploaded a generated 32px JPEG using its existing uploadPhotos/wx.uploadFile path. The response pointed to MinIO; both objects existed and native image decoding passed. The unpublished test draft and both objects were deleted through the normal discard API. Native photo selection was bypassed for this fixture.
- Refreshed the original album: its MinIO cover decoded at the original dimensions. Final row counts for all tables and the account/binding checksum matched the pre-migration baseline. No application code changed or unit suite rerun for this configuration/data operation. Backend remains running; physical devices and production were not tested.

## Album Media Diagnosis (2026-10-19)

The reported album upload problem was a client media-URL contract gap. Existing uploaded JPEGs were present in local storage, served with HTTP 200 and image/jpeg, and decoded successfully when their server origin was included. `/uploads/...` alone failed in the native image API. No backend change, SQL initialization, test album publication or existing-media rewrite was needed. The mini-program now resolves these paths; list/detail checks and 112 Node tests passed. A new native picker/upload/publication flow was not performed in this repair.

## Local Login Repair (2026-10-19)

- Reproduced the simulator's real WeChat login request: HTTP 500. Public story reads also returned 500 although Java listened on 8080.
- The running process had no LOCAL_DB_PASSWORD and the local file contained only provider keys. A read-only authentication probe reproduced MySQL error 1045, `using password: NO`. The existing container password worked; required user columns were present; Redis answered PONG. Two accounts and one existing WeChat binding were present.
- Saved the existing database password in ignored, mode-600 local.properties and persisted SQL_INIT_MODE=never. Restarted the identified backend without initializing SQL, modifying schemas or rebuilding retained data. No application code changed.
- After restart: public story reads 200; the pool connected; no access-denied errors. Actual simulator agreement checkbox and login-button taps completed WeChat login (200), stored the business session and followed the saved redirect to Diary. The stored session passed `/api/auth/me` (200).
- Updated the tracked local configuration example and development guide. No unit suites were rerun for this configuration-only repair. This verifies local simulator login, not real-device or production acceptance. The backend remains running; its ignored log is under codex-work/login-debug/.

## Current State

2026-10-18: backend architecture refactor complete and fast-forwarded into local main from `refactor/backend-deepening` (not pushed). See [findings](findings.md) for the resulting structure.

| Commit | Change |
|---|---|
| a728af7 | Removed defensive guards; shared `Text` helper; `REQUEST_BODY_INVALID`; diary writes transactional |
| 49423a7 | Couple role carried on the authenticated actor |
| a060336 | `ImageIntake` + `ImagePolicy` replace six image storage classes; local-disk object store adapter |
| deb0d52 | `AuthSessions` with opaque Redis tokens replaces JWT and RequestIdentity |
| 9d87159 | Required `@CurrentActor` is the only login rule; interceptor removed |
| 0c2245a | Atomic album like toggle and view counting |
| d50b52e | `@Autowired` on `ImageIntake`; wiring test covers it |

## Second Refactor (2026-10-18, branch `refactor/backend-deepening-2`)

| Commit | Change |
|---|---|
| 238c1a0 | One injected `Clock` bean; `PageWindow` replaces three paging clamps |
| 7604425 | Manager status decided by `User` and carried on the actor; `SiteManagerPolicy` removed |
| e72ea89 | Weather gateway returns `WeatherCondition`; Chinese keyword matcher removed |
| dd29a6f | Home reads other features through their modules; `MemberLocations`; mapper-boundary architecture test |
| f98190b | Album split into `AlbumModule`, `AlbumDrafts`, `AlbumPrivateAccess` |
| e7780cf | `DiaryMarkdown` extracted from `DiaryModule` |

Checks: `mvn -o test` 258 tests passing. Packaged-jar smoke run against throwaway MySQL 8.4 / Redis 7.4 (seeded): home latest/stats shape, album list paging and canManage, private album lock and wrong-password errors, draft upload with WebP-preview rule, publish, like, view, new draft + discard, diary title/summary from Markdown, wish and story canManage for manager vs guest, weather fallback on invalid coordinates, demo_b login. Weather provider calls were not exercised to avoid sending coordinates to external services.

## Verification Run in This Task

- `mvn -o test`: 269 tests, 0 failures.
- New album activity SQL executed against a throwaway MySQL 8.4 container: like toggles on/off/on with correct `liked_at`; view insert/mark row counts return 1 only for the first view.
- Smoke run of the packaged jar against throwaway MySQL 8.4 (seeded with `SQL_INIT_MODE=always`) and Redis 7.4 containers, MinIO unset so the local-disk store was used. Passed: anonymous 401 bodies, login with an opaque 43-character token, home, extensionless PNG screenshot upload served from `/uploads`, GIF message upload and file removal on delete, diary image + private diary create/delete with file cleanup, `REQUEST_BODY_INVALID`, type rejection, like ×3, view ×2, logout (204, idempotent, 401 without token), public story list.
- The developer's own MySQL, Redis, and MinIO containers and retained data were not touched.

## Not Verified

- MinIO adapter against a real MinIO server (constructor and configuration selection are unit-tested only).
- Web and mini-program clients against the refactored backend; no client changes were required (neither decodes tokens nor depends on image error codes or 413 handling), but live flows were not rerun.
- Real devices, production domains/TLS, WeChat privacy settings, and production runtime state.

## Deployment Notes

- Deploying ends all existing sessions (old JWT tokens are not recognised); members sign in again.
- `JWT_SECRET` and `minio.*-prefix` settings are no longer read. Existing databases must use `SQL_INIT_MODE=never`; no schema change was made.
