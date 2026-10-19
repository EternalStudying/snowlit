# Web Task Plan

## Current Task

Frontend architecture refactor from the 2026-10-18 review: complete and fast-forwarded into local main (not pushed).

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

## Entry Points

Read root AGENTS.md and task_plan.md, then [findings](findings.md), [progress](progress.md), and the [cross-client specification](../docs/product/current-spec.md).

## Workflow for the Next Request

1. Define the affected module, observable behavior, and acceptance criteria.
2. Preserve module entry points and the separation between remote state and visual lifecycles. Coordinate contract changes with backend and mini-program callers.
3. Run relevant tests and the build. Use existing browser capabilities for live UI acceptance when needed.
4. Record facts and verification separately, then compact completed work into the baseline.

## Known Items, Not Scheduled

The 390px home-page overflow, the pre-existing issues listed in findings.md, external maps, and complete write/permission flows. Do not begin fixes or redesigns without a new request.
