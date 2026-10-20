# Snowlit Task Plan

## Goal

Current: format automatically resolved album photo places using the local district and city when available (2026-10-20), with useful missing-field fallbacks and no hardcoded country/city. Also forward original coordinates as explicitly requested, synchronizing both clients' privacy text and the exact-coordinate cache contract.

## Current Phase

Photo place display and original-coordinate forwarding are complete. Actual provider responses exposed a missing parent-city level; optional administrative point lookup repairs it. The provided photo now resolves to the requested district/city label. Mini-program 124 tests, backend 263 tests, relevant Web 11 tests and the Web build passed. The backend was restarted with retained configuration and SQL initialization disabled; live read-only verification left current page data unchanged.

### Current: Photo place display
- [x] Verify the current formatter and actual returned address fields.
- [x] Update the format and exercise administrative-level fallbacks.
- [x] Verify the actual photo result and update English specifications.

### Current: Original JPEG compatibility
- [x] Inspect the original bytes and distinguish absent metadata from unsupported encoding.
- [x] Reproduce signed GPS rejection with generic fixtures and apply the minimal parser repair.
- [x] Verify the supplied original and mini-program regressions without restarting services.
- [x] Update English context without saving real coordinates or the private source image.

### Current: Photo shooting date and place
- [x] Capture the actual selection/metadata state and reproduce the fallback.
- [x] Add failing regression coverage for confirmed defects and implement the smallest repair.
- [x] Verify original metadata reading, async form filling and save readiness in the simulator.
- [x] Update context with the verified result and remaining platform limits.

### Current: Four-domain MinIO upload checks
- [x] Record baselines and inspect the four upload contracts and cleanup paths.
- [x] Exercise each upload in the simulator and confirm actual MinIO object content.
- [x] Repair reproduced failures and run relevant regression checks (no upload defect reproduced; 18 relevant tests pass).
- [x] Clean temporary data, verify retained baselines and update context.

### Current: MinIO setup and media migration
- [x] Inventory the existing MinIO bucket, local files and database references.
- [x] Back up retained data/configuration and migrate verified objects and references.
- [x] Restart using MinIO and verify migrated photos plus a new mini-program upload.
- [x] Clean up only temporary test resources and update context.

### Current: Album photo upload
- [x] Capture and reproduce the failed album upload.
- [x] Fix the cause and add a regression check at the affected boundary.
- [x] Verify the simulator flow and update context.

### Current: Mini-program login diagnosis
- [x] Reproduce the simulator failure and capture a safe error summary.
- [x] Identify and fix the failing boundary without reinitializing retained data.
- [x] Repeat the original login flow and update the relevant context.

### Phase 1: Architecture review and design decisions
- **Status:** complete

### Phase 2: Backend refactor (six candidates)
- **Status:** complete — see [backend plan](backend/task_plan.md) and [backend progress](backend/progress.md)

### Phase 3: Documentation and glossary
- **Status:** complete

### Phase 4: Second backend pass (review items 3–7)
- **Status:** complete; fast-forwarded into local main from `refactor/backend-deepening-2` (not pushed); migrations and real-database tests excluded by user decision

### Phase 5: Frontend refactor (eight candidates)
- **Status:** complete; fast-forwarded into local main from `refactor/frontend-deepening` (not pushed) — see [Web plan](frontend/task_plan.md) and [Web progress](frontend/progress.md)

### Phase 6: Frontend second pass (target architecture)
- **Status:** complete; fast-forwarded into local main from `refactor/frontend-ideal` (not pushed)

### Phase 7: Mini-program targeted refactor
- **Status:** complete; fast-forwarded into local main from `refactor/miniprogram-deepening` (not pushed). No rework of the native architecture: one shared image picker, one upload queue (`refactor/miniprogram-upload-queue`), a latest-request guard (fixes the Story filter race), and Home weather in its own module — see [technical specification](miniprogram/technical-spec.md)

### Phase 8: Album date and place from photos (mini program)
- **Status:** complete; fast-forwarded into local main from `feature/album-photo-metadata` (not pushed). Decisions: album creation only; earliest date and first GPS photo; never overwrite set fields; place via the existing backend lookup; upload compressed copies; per-photo takenAt; one hint when nothing is found — see [technical specification](miniprogram/technical-spec.md). Simulator acceptance and async-state repairs completed on 2026-10-19; physical devices and native picking remain unverified.

## Context Entry Points

| Scope | Required reading |
|---|---|
| All tasks | [Agent rules](AGENTS.md), [current findings](findings.md), [verification baseline](progress.md), [domain glossary](GLOSSARY.md) |
| Web | [Plan](frontend/task_plan.md), [findings](frontend/findings.md), [progress](frontend/progress.md) |
| Backend | [Plan](backend/task_plan.md), [findings](backend/findings.md), [progress](backend/progress.md) |
| Mini program | [Product specification](miniprogram/product-spec.md), [technical specification](miniprogram/technical-spec.md); also backend context when interfaces are involved |
| Cross-client and runtime | [Current specification](docs/product/current-spec.md), [development guide](docs/development.md) |

## Ongoing Boundaries

Use SQL_INIT_MODE=never with retained data. Preserve existing accounts, WeChat bindings, and the ICP component. Verify against throwaway containers, not the developer's retained MySQL/Redis/MinIO. Chinese language, holidays, fonts, maps, and npm mirror choices may remain; they must not be treated as evidence of the user's physical location.

For the next user request, replace the goal and phases, record discoveries in findings.md and verification in progress.md, and compact completed work into a current baseline.
