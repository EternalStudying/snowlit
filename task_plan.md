# Snowlit Task Plan

## Current Task

2026-10-22 authorized production deployment: complete. Deployed matching backend/Web artifacts from main 6122588 after reproducing the missing manager canManage field on the old server package. The same authenticated read now returns canManage=true and the actual native presenter enables edit actions. Backend 335 tests, Web 461 tests, typecheck and builds passed. All 129 HTTPS static assets match; all 19 existing table structures/data, production environment and unrelated service PIDs are unchanged. SQL_INIT_MODE remains never; no migration. Rollback material is retained. Native source stays dev; no native upload, Git commit or push. Evidence: codex-work/album-edit-deploy-20261022/report.md.

## Previous Implementation

Album editing, deletion and photo ordering (2026-10-21): implemented on feature/album-edit from clean main, subsequently merged into main. The owner later authorized committing docs/specs/2026-10-21-album-edit-delete.md and pushing all commits. Backend, disposable-service smoke, Web, mini-program and documentation steps are complete. Production rollout is the separately authorized operation above.

## Verification

- Backend: 334 tests passed. Real throwaway MySQL/Redis/MinIO: 16/16; all owned resources removed.
- Web: 72 files / 460 tests, typecheck and build passed. CUA/Edge checked actual drag, save/refresh, confirmed deletion and desktop/390px scrolling using synthetic APIs.
- Mini program: 204 tests passed in each of UTC, Asia/Shanghai, America/Los_Angeles and Pacific/Kiritimati; 137 JS syntax checks and bundled native template/style compilation passed. Twenty new regressions all failed against main.
- Actual native long-press, cross-row drag, auto-scroll with 30+ photos and quick scrolling remain unverified: computer use failed with ScreenCaptureKit -3811 across apps. The owner explicitly accepted delivery with these four checks open. No native gesture screenshots were captured. Real devices, production and WeChat review/release were not checked.
- Evidence, corrected intermediate failures and limitations: codex-work/album-edit/verification.md. Temporary browser tabs/QA servers were closed; the original DevTools project was closed before any fixture checks to avoid retained localhost services. The isolated 36-photo fixture was prepared but not run.

- 2026-10-22 availability check from main 3111963: the local backend on 8080 had hung (its jar was rebuilt underneath it) and was restarted from a copied jar, codex-work/local-backend/snowlit-3111963.jar, with SQL_INIT_MODE=never. Throwaway-stack smoke passed 16/16. Web: edit, mouse drag, cover, remove, add, save and confirmed delete all worked in the browser, with the database and MinIO checked. Mini program (a DevTools copy pointed at the throwaway backend): detail actions, edit load, tap menu, long-press lift, reorder, remove, save and confirmed delete all worked, with the database and MinIO checked. The drag move/drop could not be driven by DevTools synthetic touches, so it is still a manual check. Everything throwaway was removed.
- 2026-10-22 web album dialog layout: no sideways or vertical form overflow and no fields on the stamp at 1440/1280/1024; stacked below 960px; 461 web tests, typecheck and build passed.

## Owner Decisions and Rollout

AlbumPublisher lacked the length checks/error codes assumed by spec 6.3. The owner chose shared creation/edit validation with ALBUM_TITLE_TOO_LONG, ALBUM_DESCRIPTION_TOO_LONG and ALBUM_LOCATION_TOO_LONG. The requested npm run typecheck was absent; it now wraps existing vue-tsc -b with no added package. Browser QA uses direct browser/computer control as requested.

Only sortablejs and @types/sortablejs were added. The sole schema.sql change is the drafts.kind comment; no migration is required. The production rollout invalidates pre-stamp private access tokens once, so members unlock again. Initial implementation used throwaway services; production access belongs to the separately authorized rollout above. The mini-program dev profile remains unchanged.

Maintain durable domain/API context in GLOSSARY.md, backend/frontend findings and mini-program specifications; keep temporary execution details under codex-work/.

## Active Production UI Follow-up (2026-10-22)

The owner reports that mobile release album detail still shows only the final end tip after pull-to-refresh and a full scroll. A fresh authenticated production manager probe returns canManage=true; the matching jar remains deployed. The exact phone release package/response is not yet captured, so the missing controls are unresolved and are not attributed to database permissions. Generated an isolated main-893b586 prod preview QR with a visible read-only permission label; phone comparison is pending; the source dev profile, unrelated edits, production data and published release stay intact. Relevant native checks: 19 passed, 0 failed. Evidence: codex-work/album-delete-entry-20261022/.
