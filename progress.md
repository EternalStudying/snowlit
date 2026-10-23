# Snowlit Progress and Verification Baseline

## Production Album-management Rollout (2026-10-22)

Deployed the owner-authorized current main backend and Web. The reproduced cause was an old production detail response missing canManage; after rollout the same manager/API/presenter check passes with true. Backend 335 tests, Web 461 tests, typecheck and builds passed; 129 HTTPS assets match and all 19 existing table schemas/data are unchanged. Production environment and unrelated service PIDs were preserved; no migration. Native source remains dev, and no native package or Git change was published. Prior private-album unlocks require re-entry once. No production album mutation or physical-device acceptance was performed. See ignored codex-work/album-edit-deploy-20261022/report.md and area progress files.

## Main-only Git Checkpoint (2026-10-21)

The owner explicitly requested all changes on main and only one remaining local branch. Reviewed eighteen modified tracked files and the untracked drafts source specification; the latest all-changes instruction authorizes including that specification. main and codex/geoapify-configurable-endpoint share the same starting commit, and no additional worktree is registered. Added-line credential-pattern checks found no candidates; local credentials, developer-tool private settings and codex-work remain ignored. The mini-program active profile remains dev. Existing backend 310-test and native 184-test passing results cover the current application changes; no application edit was added for this Git checkpoint. Final commit/branch receipts are reported from Git after the checkpoint. No remote push, deployment or production mutation is part of this request.

## Mini-program Development Profile (2026-10-21)

Under the owner's explicit request, changed CURRENT_ENV from prod to dev. The existing shared request/upload wrappers now select http://localhost:8080 through configuration, and relative media uses the same origin. Kept the production profile and synchronized the existing configuration assertions and current technical/development docs. node --test miniprogram/tests/*.test.js passed all 184 tests; git diff --check passed. No new tests or dependencies, simulator refresh, live request, service restart, production data change, package upload, commit or push. Developer-tool recompilation is still needed to apply the source setting; select prod again before a production upload.

## Production Notice Wording Review (2026-10-21)

The owner reviewed the five announcement items and changed the title to v1.2.0. Inspected production notices/schema and confirmed no matching version. Added one enabled miniprogram row (id 16) with title v1.2.0 and version 1.2.0, using a guarded insert. Existing notice records and mute-state digest matched the baseline afterward. A restricted server snapshot and guarded rollback SQL are retained under the backend backups directory. No application code, schema, Web notice, service configuration or restart was required. The bundled rg executable remains absent, so scoped Python searches were used.

The simulator's existing session returned 401 on both client notice reads. A fresh real wx.login exchange returned 200; its temporary in-memory session verified both HTTPS notice responses (200). Mini title/version and all five items matched the approved text, and Web retained its original id/title/items. The extra session was immediately revoked (204); existing simulator auth storage and bindings were unchanged. No mini-program package upload, commit or push. UI rendering was not separately exercised for this data-only change. Evidence is in ignored codex-work/mini-notice-20261021/.

## Production Mini-program Acceptance (2026-10-21)

Recompiled the mini program and exercised real production WeChat login, native simulator location, Home weather, and album/diary/moment creation uploads. Found a stale production AppSecret: AppID matched local configuration, but the secret differed and WeChat returned 40125. Validated the authorized local secret (invalid-code probe returned 40029), backed up the server environment, synchronized only that secret and restarted the backend. Real UI login and authenticated auth/me passed. No account binding was created or changed.

Fixed WechatLoginRestGateway so invalid/reused codes remain authentication failures, invalid application credentials are configuration failures, and provider errors are dependency failures. Regression tests first reported 2 failures out of 7, then the complete offline backend suite passed 310/310. The packaged fix was deployed with SHA-256 verification and rollback backup, and the owned local backend was restarted with SQL_INIT_MODE=never. A fresh real WeChat exchange against the final production package returned 200; its extra verification session was revoked while the simulator's original session stayed valid.

Native wx.getLocation and the real Home update flow succeeded; the weather endpoint returned 200 with known country/city, condition and temperature, and the page displayed populated weather/place. Normal Home location/weather persistence ran for the current member. Generated images exercised the actual page controls, compression, wx.uploadFile, autosave and native online image decoding for album, diary and moment. Three drafts produced four MinIO objects, verified with signed server-side reads. Public previews matched the MinIO bytes; album originals remained private under the existing policy (anonymous 403). No policy was changed.

All three task-marked drafts were discarded through guarded normal APIs; reads returned no draft and all four signed MinIO reads returned 404. The generated simulator fixture and test memory were removed, chooseMedia was restored, and the simulator was left on Home with auth/me 200. No content was published, no schema initialized, no unrelated service changed, and no mini-program package was uploaded. Fresh native checks passed 184 tests in each of four timezones and syntax checks passed all 133 JS files. Temporary evidence is in ignored codex-work/mini-production-smoke-20261021/.

Native file picking was replaced only with a generated fixture result; physical devices, production WeChat domain/privacy approval and publication were not verified. The existing private developer-tool setting disables legal-domain checking, so these simulator requests do not prove release-domain approval. No commit or push.


## Mini-program Production Origin (2026-10-21)

The owner reported localhost requests after server deployment. The static CURRENT_ENV was still dev; both API and upload wrappers used it. The new live-origin assertion and updated production-profile contract failed before the source change, with actual localhost/dev instead of snowlit.xyz/prod. Selected prod in constants/config.js, preserving the explicit local dev profile. Existing config tests now enforce the production default; draft-page media assertions use the configured origin and the exact expected photo path. Technical/development documentation explains that developer-tool runs also use production and that an already uploaded package must be rebuilt/re-uploaded.

Verification: default, America/Los_Angeles, Asia/Singapore and UTC each passed all 184 Node tests; node --check passed all 133 JS files. A controlled wx mock exercised the real request/upload wrappers and media resolver: API, upload and relative-media origins are https://snowlit.xyz. No real upload/API write, backend/Web restart, account/binding change, simulator refresh, device acceptance, mini-program upload, commit or push occurred. Evidence, including the failing pre-fix output, is under ignored codex-work/mini-prod-endpoint-20261021/.


## Full Production Deployment (2026-10-21)

Under explicit owner authorization, deployed the complete current backend and matching Web build to the existing server, started the previously stopped local backend, and restarted only snowlit-backend.service. Production now uses the configured Geoapify CDN origin with Open-Meteo unchanged. Both environments retain SQL_INIT_MODE=never. The owner separately approved creating the sole missing drafts table; production had no old drafts to convert. The original sixteen business tables' definitions and data matched the pre-deployment backup. Existing accounts, credentials and media were preserved.

The server jar matches the local packaged artifact SHA-256; all 129 HTTPS static files match the local Web build. Production public story reads pass (200), protected weather/drafts require login (401), and the retired album draft route returns 404. Fresh frontend checks: 451 tests, vue-tsc/build passed. The deployed gateway with live process provider configuration passed 8 location and 8 weather checks in an isolated context. The public login form rendered with no captured browser errors. Other service MainPIDs were unchanged. Root-only rollback material is retained on the server; ignored detailed evidence is under codex-work/geoapify-deploy-20261021/.

Authenticated production write/login/geolocation flows and mini-program simulator/device checks were not run; the owner will upload the mini program. Existing sessions need sign-in again. Changes remain uncommitted on codex/geoapify-configurable-endpoint, with no push; the owner's untracked specification is untouched.


## Configurable Geoapify Ingress (2026-10-21)

Added a shared Geoapify origin setting for reverse and boundary requests, selected the validated CDN alias in ignored local settings, and retained Open-Meteo unchanged. Full `mvn -o test`: 307 tests, zero failures/errors/skips. On the authorized server, the actual changed Spring gateway plus application.yml passed 8 location and 8 weather checks in an isolated context; outbound observations confirmed both geocoding paths use the configured host. No application deployment, retained-service restart or business-data access. Existing processes need a restart/deployment before the new configuration is active. The CDN alias is configurable and carries no separately established stability guarantee. Changes remain uncommitted/unpushed on `codex/geoapify-configurable-endpoint`; the owner's untracked specification remains untouched. See backend/progress.md for the sandbox failures and transfer workaround; ignored detailed evidence is under codex-work/geoapify-config-20261021/.

## Current Drafts Implementation (2026-10-20)

Implementation is complete on `feature/drafts` with no push. Latest checks: `mvn -o test` 301/301; `npx vitest run` 70 files / 450 tests; `npx vue-tsc -b` and `npm run build` passed. Native Node tests passed 180/180 each in default, America/Los_Angeles, Asia/Singapore and UTC; all 133 JS files passed `node --check`. The shared album cap is 50, older over-cap drafts are preserved, and Web recovery permits editing a missing date defaulted to local today. Other owner clarifications cover UTF-8 bytes and missing photo dates. See [the report](docs/drafts-implementation-report.md) for per-section status, exact commands, resolved failure outputs and commit receipts.

Simulator acceptance was skipped using the task's explicit option; no disposable backend was provisioned. WXML/WXSS compilation, native picker/device, real SQL/concurrency and production checks were not run for drafts. No retained service/data was accessed, restarted, initialized or migrated. The new table/legacy draft conversion remains the separate reviewer rollout. Source specification remains intentionally uncommitted. Historical results below are earlier snapshots, not current draft acceptance.

## Current State

2026-10-20 photo place display and precision: complete. Album place text now prefers district/city, then province/country, omits the trailing city suffix for display and skips duplicate/unknown components. The observed reverse-geocoding response mislabeled a county as the city and omitted its parent; an optional Geoapify administrative point lookup supplies the actual parent city. Generic regressions reproduced both client formatting and backend hierarchy gaps before repair. At the user's explicit request, providers now receive original validated WGS84 coordinates and cache entries use exact coordinate pairs, with no two-decimal rounding. Web and mini-program disclosures were synchronized. Mini-program 124/124, backend 263/263, relevant Web 11/11 and Web typecheck/build passed. Initial full backend execution hit sandbox-blocked Mockito JVM attachment; the normal-host rerun passed. Restarted the previously running backend using SQL_INIT_MODE=never. A read-only simulator request with the supplied photo's original coordinates and current formatter returned the requested district/city label while preserving current page data. No records or media were created/rewritten, no real coordinates were added to source/tests/context, and no simulator refresh discarded user input. Backend remains running. Existing saved/manual place strings are not migrated automatically.

2026-10-20 original JPEG check: the supplied file contains a shooting timestamp and valid GPS. GPS uses signed SRATIONAL (TIFF type 10), which the former parser rejected. Added generic signed-component/endian/zero-denominator regressions, observed two failures before the repair, then enabled signed GPS integers. All 121 mini-program Node tests pass. Re-read the supplied original directly from its existing local path: the first 256KB and the actual readPhotoMetadata wrapper both return the expected date and valid GPS; coordinates were not printed or saved. No copy of the image or real coordinates was added to source/tests/context. No backend, provider, database, upload, or simulator call was needed; the backend was stopped at the user's request after the previous acceptance run and remains stopped. Native picker/device behavior is still unverified.

2026-10-19 album shooting metadata: repaired save-before-EXIF/place races and removed-photo callbacks. Missing metadata no longer silently becomes today/Earth; a date must be read or selected, and unknown location stays empty. Fresh mini-program suite: 118/118; backend: 259/259; album WXML/WXSS compilation passed. After backend restart and simulator refresh, real filesystem parsing and reverse geocoding filled a known synthetic JPEG's date/place; two unpublished drafts verified both EXIF-derived and manually selected metadata through actual compressed MinIO uploads and native image reads. Test drafts/objects/fixture were removed; retained table counts/checksums and object inventory matched. Only then-current parser output was inspected in the application cache: none of 12 cached JPEGs yielded GPS, and one yielded a date. The later signed-rational defect means those results cannot establish that GPS tags were absent. They also cannot be mapped conclusively to the user's exact selection. Native picker UI and physical devices remain unverified; see [technical specification](miniprogram/technical-spec.md). Backend remains running.

2026-10-19 four-domain uploads: diary, moment, wish-completion and feedback uploads all passed in the mini-program simulator and MinIO. All four object hashes matched the synthetic fixture; HTTP image reads, diary insertion, upload metadata and wish completion state passed. Relevant client tests: 18/18. No application defect or code change was needed. All test rows/objects/fixture/state were cleaned; retained table counts/checksums and object inventory matched baseline. Native picking and physical devices remain unverified; see [backend verification](backend/progress.md).

2026-10-19 MinIO setup/migration: complete. Configured the existing local service and bucket, backed up data/configuration/media, hash-verified one photo's original and preview in MinIO, and updated three URL references transactionally. Removed active disk files while retaining private recovery copies. The restarted backend passed an actual mini-program compression/upload/read check; its unpublished test draft and objects were cleaned. The original album now loads from MinIO. All table counts and account/binding checksum matched. Backend remains running; see [backend verification](backend/progress.md).

2026-10-19 album photo repair: complete. The upload had succeeded but native image loading failed on `/uploads/...`. Album service/presenters now resolve server-relative media URLs using the media/API origin. New regression checks reproduced the failure before the fix; all 112 mini-program Node tests pass. Recompiled simulator list and detail pages loaded the existing uploaded photo successfully. No new test album, backend-code or schema change. Native picking and real-device acceptance were not rerun.

2026-10-19: local mini-program login repaired and verified. The backend was listening but MySQL authentication was missing, causing login and public reads to return 500. The existing database password and SQL_INIT_MODE=never are now persisted in ignored local configuration. After restart, actual simulator login and authenticated `/api/auth/me` returned 200; the session was stored and the saved Diary redirect completed. No schema, application-code or binding changes; backend left running. See [backend verification](backend/progress.md). Earlier baselines follow.

## Checks in This Task

| Check | Result |
|---|---|
| Context coverage, documented paths, and relative links | 17 Markdown files and 83 relative links checked |
| English language and consistency with confirmed user decisions | Passed; no CJK prose remains |
| Non-document files and unchanged agent-rule semantics | 764 protected files unchanged; all 29 rules preserved in English |

This task updates Markdown only. It does not rerun business tests, start or stop services, access business data, change credentials, or commit to Git.

## Frontend Second Pass (2026-10-18)

Merged into local main from `refactor/frontend-ideal` (not pushed): Story choreography and map camera/marker motion as modules, motion slots in every component, the shell's own stylesheet and class names, album partial acceptance. Web 69 files / 445 tests passing, vue-tsc clean and build passing after every commit; a computed-style comparison against main matched on every page apart from timing and randomness (details in [Web progress](frontend/progress.md)).

## Frontend Refactor (2026-10-18)

Merged into local main from `refactor/frontend-deepening` (not pushed): Web 66 files / 431 tests passing, vue-tsc clean and production build passing after every commit; a live browser check of every page and the main dialogs and uploads ran against throwaway MySQL/Redis and the packaged backend jar (details in [Web progress](frontend/progress.md)). Backend and mini-program code did not change.

## Second Backend Pass (2026-10-18)

Merged into local main from `refactor/backend-deepening-2`: 258 backend tests passing and a packaged-jar smoke run against throwaway MySQL/Redis passed (details in [backend progress](backend/progress.md)). Clients were not rerun.

## Backend Refactor (2026-10-18)

Merged into local main from `refactor/backend-deepening`: backend `mvn -o test` 269/269 passing, new album SQL checked on a throwaway MySQL 8.4, and a packaged-jar smoke run against throwaway MySQL/Redis passed (details in [backend progress](backend/progress.md)). Web and mini-program suites were not rerun after the refactor; no client code changed.

## Handover Review (2026-10-17)

The documentation rewrite above was reviewed and committed. Spot checks against source (page count, Java target, Vite proxy, SQL init defaults, weather cache TTLs, album photo limit, mini-program environments) matched. The user confirmed removal of the former Chinese design-reference index and its two mini-program design images under docs/product/assets; the README link to that index was removed.

Fresh unit-test runs in this review: Web 64 files / 501 tests, backend 259 tests (mvn -o test), mini program 80 tests; all passed. The production build, mini-program template compilation, simulator, and live services were not rerun.

## Most Recent Recorded Business Verification

These results belong to the previous implementation baseline, not a fresh test run in this task.

| Area | Recorded result |
|---|---|
| Web | 64 test files, 501 tests, and production build passed |
| Backend | 259 tests passed, including UTC date boundaries and Spring wiring |
| Mini program | 80 tests, 112 JS syntax checks, 32 WXML and 35 WXSS compilation checks passed |
| Simulator | WeChat login/binding/logout, principal read/write flows, five image upload flows, and global location/weather integration checked |
| Retained data | Earlier table-count and account/binding digests were unchanged; initialization was not rerun |

## Read-Only Environment Observations in This Task

- Available tools: Node 24.16.0, npm 11.13.0, Java 21.0.11, Maven 3.9.16.
- Port 8080 has a listener; port 5173 does not. This is not a fresh interface or end-to-end acceptance result.
- The local credential file exists with mode 600; its contents were not displayed. Frontend dependencies are present.
- Docker dependency health, native WeChat pages, real devices, and production services were not rechecked.

## Next Handoff

Start a new plan from the next user request. Record the exact checks performed and their limits; do not promote historical tests or a listening port into current end-to-end verification.

## 2026-10-22 production mobile action follow-up

Owner confirms album detail reaches the final end tip after refresh, with neither management action visible. Fresh manager production API and jar identity checks passed, but do not establish the phone package behavior. Relevant native checks passed 19/19. Generated an isolated main-893b586 prod preview QR (823863-byte package) with a read-only D1 permission label; awaiting a phone screenshot. Native source remains dev; production release/data and unrelated work were preserved. No application fix claimed. Evidence: codex-work/album-delete-entry-20261022/.
