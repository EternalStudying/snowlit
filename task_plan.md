# Snowlit Task Plan

## Goal

Initialize all project context and maintenance documents in English from the current code baseline. Remove obsolete task history while retaining current contracts, user decisions, constraints, and verification limits.

## Current Phase

Initialization complete. No business development task is active.

### Phase 1: Inventory and Fact Check
- **Status:** complete

### Phase 2: Initialize Context and Update Entry Points
- **Status:** complete

### Phase 3: Verify English, Links, Coverage, and Protected Files
- **Status:** complete

## Context Entry Points

| Scope | Required reading |
|---|---|
| All tasks | [Agent rules](AGENTS.md), [current findings](findings.md), [verification baseline](progress.md), [domain vocabulary](CONTEXT.md) |
| Web | [Plan](frontend/task_plan.md), [findings](frontend/findings.md), [progress](frontend/progress.md) |
| Backend | [Plan](backend/task_plan.md), [findings](backend/findings.md), [progress](backend/progress.md) |
| Mini program | [Product specification](miniprogram/product-spec.md), [technical specification](miniprogram/technical-spec.md); also backend context when interfaces are involved |
| Cross-client and runtime | [Current specification](docs/product/current-spec.md), [development guide](docs/development.md) |

## Acceptance Criteria

- Every maintained project Markdown document is in English; agent rules retain their original meaning.
- Plans describe the current state and do not turn completed audits or unapproved suggestions into active requirements.
- Findings contain durable facts and decisions; progress distinguishes earlier verification from checks run in this task.
- Existing source, configuration, credentials, assets, business data, running services, and Git history remain unchanged.
- Links and documented paths resolve; no real credentials, personal names, addresses, or coordinates are copied into context.

## Ongoing Boundaries

Use SQL_INIT_MODE=never with retained data. Preserve existing accounts, WeChat bindings, and the ICP component. Chinese language, holidays, fonts, maps, and npm mirror choices may remain; they must not be treated as evidence of the user's physical location.

For the next user request, replace the goal and phases, record discoveries in findings.md and verification in progress.md, and compact completed work into a current baseline.
