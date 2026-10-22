# Backend Task Plan

## Current Task

2026-10-21 production mini-program acceptance: complete. Synchronized the verified authorized WeChat secret to production and corrected provider error classification. Full offline suite: 310 passed. The packaged repair is deployed and the owned local backend restarted with SQL_INIT_MODE=never. Real simulator login/weather and three upload flows passed; test resources were cleaned. See backend/progress.md.

2026-10-21 authorized full-stack activation: complete. Local and production backends are running; public DB-backed and production HTTPS endpoints return 200. The full backend package and 129 Web assets match local artifacts; deployed-provider checks passed 16/16. The owner selected the full current backend and matching Web deployment and explicitly approved creating the missing production drafts table; the other sixteen business tables are structurally present. No old production drafts require conversion. Rollback snapshots were taken on the server; SQL_INIT_MODE stays never and other services/data remain preserved.

2026-10-21 configurable Geoapify ingress: complete on `codex/geoapify-configurable-endpoint`, uncommitted and not pushed. GEOAPIFY_BASE_URL controls both geocoding operations; omitted/blank keeps the official default, while ignored local configuration selects the validated CDN alias. Open-Meteo is unchanged. Full offline suite: 307 passed. Isolated changed-gateway server checks: 8 location and 8 weather passed, with both Geoapify request paths observed on the configured host. No existing service was restarted/deployed; retained data was untouched. The alias is not an independently guaranteed stable API endpoint.

2026-10-20 unified drafts: complete on `feature/drafts` (`a77d8e8 / 9af661f / b096289`). Unified drafts, narrow publication seams, UTF-8 validation and retired album endpoints are implemented. The 16 previous table definitions are unchanged. The latest complete offline Maven suite passed 301 tests. No retained-service or database rollout checks ran.

2026-10-20 city hierarchy and original coordinates: complete. Optional Geoapify administrative point lookup corrects a lower-level reverse result mislabeled as a city; failures retain the base result. Original valid WGS84 coordinates now pass unchanged to both providers and key the cache, as requested. Full suite: 263 tests passed; restarted the previously running service with SQL_INIT_MODE=never and verified the requested district/city result for the supplied photo. Existing records, schema and images were not modified.

2026-10-19 album metadata repair: complete. Preserve an unknown album/photo location as an empty string instead of inventing Earth. Regression tests failed before the repair; the complete backend suite now passes (259 tests). Restarted with SQL_INIT_MODE=never and existing MinIO settings; actual simulator unpublished-draft uploads verified date/place persistence and blank-location preservation. Test resources were removed and retained data/object baselines matched. No schema or existing-record changes.

2026-10-19 four-domain upload acceptance: complete. All four simulator upload flows produced MinIO objects with fixture-matching SHA-256 and image/jpeg HTTP reads. Diary/feedback metadata and wish completion state matched. No upload defect reproduced; 18 relevant client checks passed. All temporary rows/objects/state were cleaned; retained table counts/checksums and object inventory match the baseline. No application code changed.

2026-10-19 MinIO setup and media migration: complete. Under explicit user authorization, configured the existing service, backed up data/configuration/files, hash-verified two copied objects, updated three URL fields transactionally, retired active disk files, and restarted with SQL_INIT_MODE=never. Actual mini-program compression/upload/read passed and the temporary unpublished draft/objects were cleaned. Retained table counts and account/binding checksum matched. Recovery material stays in ignored codex-work/minio-migration-20261019/.

2026-10-19 album photo diagnosis: complete. Uploads reached local storage successfully; root-relative media URLs were not resolved by the mini-program. The client fix passed regression checks and actual simulator list/detail image loads. No backend code or schema change required.

2026-10-19 local mini-program login repair: complete. Reproduced HTTP 500 with a real WeChat code, found missing MySQL authentication, saved the existing password in ignored local configuration, restarted with SQL initialization disabled, and verified actual simulator login plus authenticated `/api/auth/me` (200). No application code or schema changes.

Earlier: backend architecture refactor (deepening opportunities 1–6 from the 2026-10-18 review). All phases complete; merged into local main (not pushed).

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
- **Status:** complete; fast-forwarded into local main from `refactor/backend-deepening-2` (not pushed)

## Entry Points

Read root AGENTS.md and task_plan.md, then [findings](findings.md), [progress](progress.md), the [glossary](../GLOSSARY.md), and the [cross-client specification](../docs/product/current-spec.md).

## Workflow for the Next Request

1. Check interfaces, authorization, data, and all client callers against current DTOs, VOs, Mappers, and business modules.
2. Plan migrations and recovery for schema changes. Retained databases always require SQL_INIT_MODE=never.
3. Run relevant behavior, HTTP, and architecture checks. Package or perform live-service acceptance only when the change requires it; use throwaway containers rather than the developer's retained services.
4. Update findings and verification, then remove obsolete troubleshooting narratives.

## Known Items, Not Scheduled

The local MinIO adapter was exercised through a real mini-program mobile album upload on 2026-10-19. Complete client regression runs, real devices, production domains/TLS, and WeChat privacy settings still require acceptance. Public content and image-metadata boundaries are implementation facts, not authorization to change product behavior.
