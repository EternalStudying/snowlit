# Snowlit Task Plan

## Goal

Implement server drafts for albums, diaries and moments from `docs/specs/2026-10-20-drafts.md`, including the owner's subsequent clarifications. Branch `feature/drafts`, no push. Context remains English.

## Current Phase

Implementation, regression review and documentation are complete. Backend/Web/native commits are recorded in [the report](docs/drafts-implementation-report.md). Simulator acceptance is explicitly skipped; retained-database rollout remains outside this task.

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

## Owner Clarifications

1. Keep the 60,000-character diary cap; additionally limit text and complete serialized fields_json to 65,535 UTF-8 bytes. DRAFT_FIELDS_INVALID on overflow; existing table definitions unchanged.
2. Missing photo takenAt stays unknown in a draft and uses album eventDate only at publication.
3. Unify album maximum at 50 on backend/Web/mini; native picker batches stay at most nine. Preserve all older over-cap images and allow removal before publish.
4. Web recovery defaults a missing album date to client-local today and permits editing it.

## Safety and Continuity

Never push or access developer MySQL/Redis/MinIO or retained data. Retained databases use SQL_INIT_MODE=never; do not run the destructive whole schema.sql on them. Only separately owned throwaway services may use SQL_INIT_MODE=always for checks. Temporary scripts/logs belong in codex-work/. Never copy real secrets or coordinates into fixtures/context. Earlier media/location work was committed on main before this branch and was preserved.

Future tasks should replace the goal/phases and use current source plus area context. Do not treat historical test results or a listening port as current end-to-end acceptance.
