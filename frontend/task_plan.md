# Web Task Plan

## Current Task

2026-10-22 motion redesign: complete; `feature/motion-redesign` was fast-forwarded into local main (not pushed or deployed). GSAP motion kit plus per-module choreography; see findings.md (Motion System) and progress.md.

2026-10-22 code-first visual redesign: complete; `feature/code-first-ui` was fast-forwarded into local main (not pushed or deployed). The new tokens, shared paper pieces and image rules are in findings.md under Visual System. The verification record is in progress.md.

2026-10-21 album editing/deletion: complete. Implemented manager edit/delete, shared creation/edit SortableJS photo grid, immediate edit uploads, confirmed discard/delete and final order publication. Vitest: 72 files / 460 passed; typecheck/build passed. Direct CUA/Edge drag/save/delete and desktop/390px checks used isolated synthetic APIs. No production acceptance or deployment.

2026-10-21 production deployment: complete under explicit owner authorization. Full current Web and matching backend are active, preserving the previous release. All 129 HTTPS static files match the local build; the online login form renders with no captured browser errors. No production sign-in or write flow was executed. Fresh Vitest: 70 files / 451 tests passed; production build (including vue-tsc) passed. No UI source changes.

2026-10-20 unified drafts: complete on `feature/drafts` (`2f17921 / b096289`). The album gateway/lifecycle uses the unified drafts API, explicit save only. Resumed private passwords are re-entered; missing dates default to local today and are editable. Saved pinned state survives recovery. The shared album cap is 50. Latest checks: 70 files / 450 Vitest tests, vue-tsc and production build passed; live browser/device checks were not run.

2026-10-20 precision disclosure: complete. The top bar now explains that original coordinates reach Geoapify/Open-Meteo, matching the backend change requested by the user. Weather HTTP/refresh checks (11 tests) and the Web production build passed. No Web geolocation/browser interaction was rerun.

Frontend architecture refactor from the 2026-10-18 review, plus a second pass to the target architecture: complete and fast-forwarded into local main (not pushed).

| Candidate | Status |
|---|---|
| Shared display helpers, trusted API types | complete |
| Behaviour tests instead of source-text tests | complete |
| Weather pipeline pruned to LazyLayers | complete |
| One image-picking rule | complete |
| Session epoch and request guards | complete |
| Motion module (reduced motion, instant test mode, close-once) | complete |
| Wishes data split from choreography | complete |
| Journal shell to src/shell; weather owns its schedule | complete |
| Browser check against throwaway services | complete |
| Second pass: Story motion and map split, motion slots everywhere, shell styles, tidy-ups | complete (`refactor/frontend-ideal`) |
| Computed-style comparison against main | complete |

## Entry Points

Read root AGENTS.md and task_plan.md, then [findings](findings.md), [progress](progress.md), and the [cross-client specification](../docs/product/current-spec.md).

## Workflow for the Next Request

1. Define the affected module, observable behavior, and acceptance criteria.
2. Preserve module entry points and the separation between remote state and visual lifecycles. Coordinate contract changes with backend and mini-program callers.
3. Run relevant tests and the build. Use existing browser capabilities for live UI acceptance when needed.
4. Record facts and verification separately, then compact completed work into the baseline.

## Known Items, Not Scheduled

The pre-existing issues listed in findings.md, external maps, and complete write/permission flows. Do not begin fixes or redesigns without a new request.
