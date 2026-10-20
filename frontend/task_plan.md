# Web Task Plan

## Current Task

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

The 390px home-page overflow, the pre-existing issues listed in findings.md, external maps, and complete write/permission flows. Do not begin fixes or redesigns without a new request.
