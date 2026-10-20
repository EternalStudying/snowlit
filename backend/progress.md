# Backend Progress Baseline

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
