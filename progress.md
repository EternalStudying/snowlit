# Snowlit Progress and Verification Baseline

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
