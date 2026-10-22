# Snowlit Task Plan

## Goal

Checkpoint all reviewed project changes on main under the owner's latest authorization, including the drafts source specification, and retain only the local main branch. Preserve the completed deployment, fixes and current mini-program dev profile. Do not push. Context remains English; earlier deployment/configuration phases below are historical context.

## Current Phase

The owner requested all project changes on main and removal of other local branches. Review found only main and codex/geoapify-configurable-endpoint, both at the same existing commit, with no additional worktrees. This checkpoint includes all eighteen modified tracked files and the previously untracked drafts specification. Private configuration and codex-work remain ignored. Earlier instructions excluding the specification and disallowing commits are superseded by this explicit all-changes checkpoint request; pushing remains unauthorized.

### Phase 16: Main-only Git checkpoint (2026-10-21)
- **Status:** complete
- Reviewed source/test/context changes and scanned added content for credential patterns; no candidates found. The specification contains no private key or long hexadecimal secret candidate. The current mini-program profile remains dev. Reuse completed validation: backend 310 tests and native 184 tests passed for this source; this checkpoint adds no application behavior. Stage all project changes, commit on main, and safely delete the already-contained temporary local branch. Git supplies the final commit receipt and branch/status verification; no remote mutation.

## Previous Development Profile Switch

Mini-program development mode is complete. CURRENT_ENV selects dev, so requests and uploads use http://localhost:8080. Updated the existing configuration contract and current configuration docs; all 184 native Node tests passed. Developer-tool recompilation/runtime requests were not exercised for this source-only switch. No service restart, production data change or package upload.

### Phase 15: Mini-program development profile (2026-10-21)
- **Status:** complete
- Switched the static active profile to dev under the owner's request. Both environment definitions and unrelated pending changes are preserved. Updated the existing configuration assertions and current technical/development docs. node --test miniprogram/tests/*.test.js passed 184/184; git diff --check passed. Compilation is required to apply the source setting in the developer tool; uploading later requires selecting prod again. No simulator refresh, service restart or production mutation was performed.

## Previous Notice Rollout

Production mini-program announcement is complete. Added one enabled miniprogram notice (id 16), title v1.2.0, version 1.2.0 and the five reviewed items. Authenticated production reads returned the exact content. Historical notices, Web content and mute state were preserved; no restart or source deployment was needed.

### Phase 14: Production mini-program announcement (2026-10-21)
- **Status:** complete
- The owner reviewed the five items and changed the title to v1.2.0. Production had no matching version. Snapshotted existing notices, performed a guarded single-row insert and verified existing rows/mute state unchanged. Both client-scoped HTTPS notice reads returned 200; mini content matched exactly and Web retained id 13. The old simulator session returned 401; a fresh native WeChat exchange supplied an in-memory verification session, revoked immediately afterward. No binding or simulator auth cache was changed. Evidence: codex-work/mini-notice-20261021/.

## Previous Acceptance

Production mini-program simulator acceptance is complete. Real login, location/weather and album/diary/moment uploads passed; the stale server secret and misleading gateway error classification were repaired and deployed. Temporary drafts, MinIO objects and simulator fixture were cleaned. Local/production backends run the same tested package. Native picking, devices and WeChat domain/privacy approval remain unverified. No commit, push or mini-program upload.

### Phase 13: Production mini-program simulator acceptance (2026-10-21)
- **Status:** complete
- Owner explicitly authorized recompilation and simulator checks of real production login, location/weather and uploads, fixing reproduced defects. Preserve existing server data/bindings/drafts; use generated images and task-owned unpublished resources only, clean them afterward, and do not upload/release to the WeChat platform. Reuse prior agreement/location authorization where applicable; ask if a genuinely new consent or binding is needed. Real UI WeChat login, native location/weather and three generated-image upload flows passed. Fixed and deployed stale production AppSecret and provider-error classification; full backend 310 tests and native four-timezone 184 tests each passed. Four MinIO objects were verified then cleaned with the three guarded test drafts. The simulator remains on Home with an active production session. Evidence and failed diagnostic assumptions are recorded in codex-work/mini-production-smoke-20261021/report.md. Existing source changes and the untracked owner specification stay preserved; no commit or push.

### Phase 12: Mini-program production endpoint activation (2026-10-21)
- **Status:** complete
- Owner reported localhost requests after server deployment. The actual config still selects dev statically; both request/upload wrappers use it. A direct deployed-origin assertion failed with actual http://localhost:8080 vs expected https://snowlit.xyz. Switched the active profile to prod, retained the explicit dev profile for future local work, aligned origin-specific tests and release documentation, and verified request/upload/media origins through their actual shared wrappers with a controlled wx mock. Four timezone suites each passed 184 tests; all 133 JS syntax checks passed. No backend/Web redeployment or mini-program upload is required for this source setting; the owner will recompile and upload the updated package.

### Phase 11: Authorized full-stack activation and server deployment (2026-10-21)
- **Status:** complete
- The owner selected the complete local backend and matching Web deployment, then explicitly approved creating the sole missing production drafts table. No old production drafts required conversion. Created root-only rollback backups, activated byte-verified packages and production provider configuration, and restarted only snowlit-backend.service. SQL_INIT_MODE stayed never. Read-only application/HTTPS/database preservation checks and isolated deployed-provider checks passed; public login-page rendering passed. Frontend: 451 tests plus typecheck/build. No commit, push or mini-program upload.

### Phase 9: Configurable Geoapify ingress (2026-10-21)
- **Status:** complete
- Add one base URL for reverse and administrative-boundary requests. Keep the official default, enable the tested alias in ignored local.properties, and leave Open-Meteo unchanged. Add focused request-routing regressions and update the configuration example/development guide.

### Phase 10: Verification and durable context (2026-10-21)
- **Status:** complete
- Full offline suite: 307 passed. The changed Spring gateway plus actual application.yml ran in an isolated server context: 8 location and 8 Open-Meteo checks passed. Reverse/boundary requests used the configured CDN, with no provider substitution. Same-version public runtime libraries were read only and hash-verified; no business dependencies or server application configuration were loaded. Evidence is under ignored codex-work/geoapify-config-20261021/. No commit, push or deployment.

### Phase 1: Backend
- **Status:** complete
- Unified drafts table/API, ownership, locked image changes, transactional publication, byte validation and old endpoint removal. Latest offline suite: 301 passed.

### Phase 2: Web albums
- **Status:** complete
- New kind-scoped gateway, explicit save/upload/recovery/publish/discard, editable date completion and password re-entry. Latest Vitest: 70 files / 450 tests; typecheck/build passed.

### Phase 3: Native creation pages
- **Status:** complete
- One service/autosave helper, album/diary/moment recovery, immediate uploads, hide/unload flush, token guards and image removal. Four timezones each 180 tests passed; all 133 JS files passed syntax checks.

### Phase 4: Durable context and glossary
- **Status:** complete
- Glossary, product/API contracts, area plans/findings/progress and detailed verification report updated in English. The source specification is intentionally uncommitted.

### Phase 5: Simulator decision and handoff
- **Status:** complete
- Simulator acceptance skipped using the user's explicit option. No throwaway backend was provisioned, and no retained services/data were accessed. WXML/WXSS compilation, browser/native picker/device, real SQL/concurrency and production remain unverified. Database table creation/conversion is the reviewer's separately approved task.

### Phase 6: Final diary delete/unload regression review
- **Status:** complete
- Reproduced and repaired pending deletion racing with unload. Fields flush immediately, then a final cleaned snapshot is saved after successful deletion; failed deletion preserves references and token changes stop writes. Four new controlled exit tests pass; latest native suites each pass 180 tests.

### Phase 7: Review fixes (2026-10-21)
- **Status:** complete
- Queued uploads now finish after a creation page closes; pinned albums keep sort order 10; the Web omits a cleared album date. Drafts API smoke-tested against throwaway MySQL/Redis (34/34). See the review section of [the report](docs/drafts-implementation-report.md).

### Phase 8: Local database rollout (2026-10-21)
- **Status:** complete
- Backed up `snowlit_dev`, created the drafts table and converted the one legacy album draft (9205) in one transaction; other tables unchanged. The local backend on 8080 was restarted from main (`mvn spring-boot:run`, SQL_INIT_MODE=never, existing local settings and MinIO); `/api/drafts/album` answers 401 without a session while the removed `/api/albums/drafts/current` answers 404. An authenticated read was not done (the seed password is not the account's). See the report.

## Owner Clarifications

1. Keep the 60,000-character diary cap; additionally limit text and complete serialized fields_json to 65,535 UTF-8 bytes. DRAFT_FIELDS_INVALID on overflow; existing table definitions unchanged.
2. Missing photo takenAt stays unknown in a draft and uses album eventDate only at publication.
3. Unify album maximum at 50 on backend/Web/mini; native picker batches stay at most nine. Preserve all older over-cap images and allow removal before publish.
4. Web recovery defaults a missing album date to client-local today and permits editing it.

## Safety and Continuity

Never push. Do not directly modify developer MySQL/Redis/MinIO or retained data; the separately authorized backend startup and read-only application checks may use their existing connections. Retained databases use SQL_INIT_MODE=never; do not run the destructive whole schema.sql on them. Only separately owned throwaway services may use SQL_INIT_MODE=always for checks. Temporary scripts/logs belong in codex-work/. Never copy real secrets or coordinates into fixtures/context. Earlier media/location work was committed on main before this branch and was preserved.

Future tasks should replace the goal/phases and use current source plus area context. Do not treat historical test results or a listening port as current end-to-end acceptance.
