# Snowlit Task Plan

## Current Task

Album editing, deletion and photo ordering (2026-10-21): implemented on feature/album-edit from clean main. The source specification docs/specs/2026-10-21-album-edit-delete.md stays intentionally untracked. Backend, disposable-service smoke, Web, mini-program and documentation steps are complete. Never push or deploy as part of this task.

## Verification

- Backend: 334 tests passed. Real throwaway MySQL/Redis/MinIO: 16/16; all owned resources removed.
- Web: 72 files / 460 tests, typecheck and build passed. CUA/Edge checked actual drag, save/refresh, confirmed deletion and desktop/390px scrolling using synthetic APIs.
- Mini program: 204 tests passed in each of UTC, Asia/Shanghai, America/Los_Angeles and Pacific/Kiritimati; 137 JS syntax checks and bundled native template/style compilation passed. Twenty new regressions all failed against main.
- Actual native long-press, cross-row drag, auto-scroll with 30+ photos and quick scrolling remain unverified: computer use failed with ScreenCaptureKit -3811 across apps. The owner explicitly accepted delivery with these four checks open. No native gesture screenshots were captured. Real devices, production and WeChat review/release were not checked.
- Evidence, corrected intermediate failures and limitations: codex-work/album-edit/verification.md. Temporary browser tabs/QA servers were closed; the original DevTools project was closed before any fixture checks to avoid retained localhost services. The isolated 36-photo fixture was prepared but not run.

## Owner Decisions and Rollout

AlbumPublisher lacked the length checks/error codes assumed by spec 6.3. The owner chose shared creation/edit validation with ALBUM_TITLE_TOO_LONG, ALBUM_DESCRIPTION_TOO_LONG and ALBUM_LOCATION_TOO_LONG. The requested npm run typecheck was absent; it now wraps existing vue-tsc -b with no added package. Browser QA uses direct browser/computer control as requested.

Only sortablejs and @types/sortablejs were added. The sole schema.sql change is the drafts.kind comment; no migration is required. Future backend deployment invalidates pre-stamp private access tokens once, so members unlock again. No retained MySQL/Redis/MinIO or production was accessed. The mini-program dev profile remains unchanged.

Maintain durable domain/API context in GLOSSARY.md, backend/frontend findings and mini-program specifications; keep temporary execution details under codex-work/.
