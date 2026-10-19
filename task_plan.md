# Snowlit Task Plan

## Goal

Refactor the backend and Web architecture: deepen shallow modules found in the 2026-10-18 architecture review and remove overly defensive code, without changing client-visible contracts beyond the decisions recorded in [findings](findings.md).

## Current Phase

Backend refactor complete and fast-forwarded into local main (not pushed). Frontend refactor and its second pass complete and fast-forwarded into local main (not pushed). Mini-program targeted refactor complete and fast-forwarded into local main (not pushed).

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
- **Status:** complete; fast-forwarded into local main from `refactor/miniprogram-deepening` (not pushed). No rework of the native architecture: one shared image picker, a latest-request guard (fixes the Story filter race), and Home weather in its own module — see [technical specification](miniprogram/technical-spec.md)

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
