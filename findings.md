# Snowlit Current Findings

Baseline date: 2026-10-17. This file records facts and decisions. Task status belongs in task_plan.md; verification evidence and limits belong in progress.md.

## Project Structure

| Directory | Implementation and boundary |
|---|---|
| frontend | Vue 3, Vite, TypeScript; ten business modules under src/modules with index.ts public entry points |
| backend | Spring Boot, MyBatis, MySQL; xyz.snowlit root package and ten vertical business domains |
| miniprogram | Native WeChat application with 17 registered pages, sharing the existing backend and business data |
| docs | Development instructions and cross-client contracts; not a runtime asset source |
| codex-work | Git-ignored temporary checks and local debugging material; not a permanent specification |

Web requests share SessionRequest and drop responses from an earlier session; the regular route shell lives in frontend/src/shell. On the backend a required `@CurrentActor` is the only login rule, `AuthSessions` owns opaque business sessions, `ImageIntake` accepts every uploaded image over the ObjectStore seam, ApplicationFailure represents business failures, and infrastructure contains external adapters. Details are in [backend findings](backend/findings.md); domain terms are in the [glossary](GLOSSARY.md).

## Confirmed User Decisions

- Write all project context and maintenance documents in English; reply to the user in English.
- Backend refactor decisions (2026-10-18): images are recognised by content for every flow and GIF is allowed everywhere; per-domain image error codes stay; oversized feedback screenshots answer 413; local disk is the object store whenever MinIO is not fully configured; session tokens are opaque (no JWT); `@CurrentActor` is the only login rule; overly defensive code is removed. Domain vocabulary lives in GLOSSARY.md (CONTEXT.md retired).
- Frontend refactor decisions (2026-10-18): a session change discards in-flight responses and clears cached feature state; one image rule (JPEG/PNG/WebP/GIF by type or extension, ≤10MB, message "只支持 jpg、png、webp、gif，单张不超过 10MB"); legacy weather scenes removed; a shared motion module with a test-only instant mode replaces test-runner checks and animations must look the same; the wish completion stamp plays only after the server confirms; the journal shell lives in src/shell and weather owns its consent and schedule; source-text tests are replaced by behaviour tests except seam audits and cross-client contract checks; the 390px Home overflow stays out of scope.
- Preserve the public ICP component and its current record number.
- Do not hardcode personal names, addresses, or real precise coordinates. Use generic initialization data and actual location results; unresolved locations remain unknown.
- The privacy criterion concerns direct evidence of the user's physical location in mainland China. Chinese language, holidays, simplified fonts, AMap, WeChat, and npm mirror choices may remain.
- After initial disclosure and platform permission, update weather automatically every 20 minutes in the foreground and pause in the background. Weather attribution UI remains hidden as requested; privacy disclosures still describe actual processing.
- Preserve existing accounts and user-confirmed WeChat bindings. The developer tool service port may remain enabled. Do not put real account aliases in documentation.

## Data, Time, and Configuration

- MySQL and Redis are runtime dependencies; MinIO is used when fully configured, otherwise uploads go to a served local directory. Retained databases require SQL_INIT_MODE=never; dev defaults to always and can recreate/reseed tables.
- Local WeChat and Geoapify credentials are read from backend/config/local.properties: ignored by Git, mode 600, outside application resources. Environment variables take precedence; prod does not import this file.
- Album likes and views use UTC calendar days. The development JDBC default is UTC; existing activity dates are not migrated.
- Plain YYYY-MM-DD values retain calendar-date semantics. Timestamps retain instant semantics and use client-local presentation.
- Geoapify location and Open-Meteo weather can succeed or fail independently. Provider requests receive coordinates rounded to two decimal places; this is not a promise of anonymity or zero retention.
- Git uses main and a cleaned initial baseline. Do not commit or rebuild history without explicit user authorization.

## Current Product Boundaries

- Backend authorization is authoritative. The client stores business tokens. Management currently permits user IDs 1 and 2; full multi-couple tenant isolation is not implemented.
- Story lists and details are public, including record-supplied location, address, and coordinates. Home requires authentication.
- Uploaded files are stored as supplied; GPS/EXIF removal is not centralized. Clean built-in assets do not establish that user-uploaded photos lack metadata.
- These are implementation facts, not approved requests to change public content or image behavior.

## Known Items, Not Scheduled

- The Web home page overflows horizontally at a 390px viewport. External maps and complete Web write/permission flows still need live acceptance checks.
- Real devices, system image selection, production domains/TLS, WeChat privacy settings, and release approval require external verification.
- Local source inspection does not establish production state or the contents of existing business records and uploaded photos.
