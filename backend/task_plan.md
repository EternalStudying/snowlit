# Backend Task Plan

## Current Task

Context initialized. No backend development request is active.

### Phase 1: Baseline Initialization
- **Status:** complete

## Entry Points

Read root AGENTS.md and task_plan.md, then [findings](findings.md), [progress](progress.md), and the [cross-client specification](../docs/product/current-spec.md).

## Workflow for the Next Request

1. Check interfaces, authorization, data, and all client callers against current DTOs, VOs, Mappers, and business modules.
2. Plan migrations and recovery for schema changes. Retained databases always require SQL_INIT_MODE=never.
3. Run relevant behavior, HTTP, and architecture checks. Package or perform live-service acceptance only when the change requires it.
4. Update findings and verification, then remove obsolete troubleshooting narratives.

## Known Items, Not Scheduled

Real devices, production domains/TLS, and WeChat privacy settings require acceptance. Public content and image-metadata boundaries are implementation facts, not authorization to change product behavior.
