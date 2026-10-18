# Backend Task Plan

## Current Task

Backend architecture refactor (deepening opportunities 1–6 from the 2026-10-18 review). All phases complete; merged into local main (not pushed).

### Phase 1: Defensive-code sweep and diary transactions
- **Status:** complete

### Phase 2: Couple role on the authenticated actor
- **Status:** complete

### Phase 3: Image intake module and local-disk object store
- **Status:** complete

### Phase 4: Opaque-token business sessions
- **Status:** complete

### Phase 5: `@CurrentActor` as the only login rule
- **Status:** complete

### Phase 6: Atomic album daily activity
- **Status:** complete

### Phase 7: Documentation, glossary, smoke verification
- **Status:** complete

### Phase 8: Second pass (clock/paging, manager flag, weather condition, Home boundaries, album split, diary Markdown)
- **Status:** complete on branch `refactor/backend-deepening-2` (not merged, not pushed)

## Entry Points

Read root AGENTS.md and task_plan.md, then [findings](findings.md), [progress](progress.md), the [glossary](../GLOSSARY.md), and the [cross-client specification](../docs/product/current-spec.md).

## Workflow for the Next Request

1. Check interfaces, authorization, data, and all client callers against current DTOs, VOs, Mappers, and business modules.
2. Plan migrations and recovery for schema changes. Retained databases always require SQL_INIT_MODE=never.
3. Run relevant behavior, HTTP, and architecture checks. Package or perform live-service acceptance only when the change requires it; use throwaway containers rather than the developer's retained services.
4. Update findings and verification, then remove obsolete troubleshooting narratives.

## Known Items, Not Scheduled

MinIO adapter live check, client regression runs against the refactored backend, real devices, production domains/TLS, and WeChat privacy settings require acceptance. Public content and image-metadata boundaries are implementation facts, not authorization to change product behavior.
