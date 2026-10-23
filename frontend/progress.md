# Web Progress Baseline

## Evening world: shell and Home rebuilt (2026-10-22, merged into local main from `feature/warm-rebuild`)

- **Checks.**
  - Vitest: 72 files / 442 tests passed, clean 3 of 3 full runs. The scrapped hero and nav-fusion tests were replaced by shell tests for the cover, the evening opt-in, petals, nav order and the current page, dock scrolling, and route scroll preservation; the Story top-bar tests were kept.
  - `npm run typecheck` and `npm run build` passed.
- **Browser.** Built-in browser against the throwaway stack (backend 15182, worktree Vite 15184), signed in as demo_a.
  - Home was checked section by section at 1440 and 375.
  - Diary was checked inside the new frame.
  - The plaque was confirmed clickable above the top bar.
  - No sideways overflow on Home or Diary at 1440/1280/1024/820/375, at three scroll depths each.
- **Not checked.** Reduced motion in a real browser (gated in code and CSS). Real devices and frame rate on a low-end phone. The other pages, which have not been rebuilt yet.

## Motion redesign (2026-10-22, branch `feature/motion-redesign`, not merged)

The GSAP motion system is described in findings.md under Motion System. It was built in one commit per module: the kit, Home, Album, Diary, Wishes, Messages, Login and About, plus an overflow fix. Story's existing map choreography was left as it was.

- **Checks.**
  - Vitest: 72 files / 461 tests passed, clean three runs in a row after the ScrollTrigger test fix.
  - `npm run typecheck` and `npm run build` passed.
- **Browser.** The built-in browser ran against the throwaway stack (backend 15182, worktree Vite 15184).
  - Home: pinned chapter, odometer, thread, fan, and phone layout.
  - Album: title, lamplight, like spark.
  - Diary: title per month switch, date points, chapter tabs, mood pop.
  - Wishes: badge morph and ring draw, run by hand on the pending badge.
  - Messages: a thrown bubble glides and doesn't open; a click opens.
  - Login and About: titles.
- **Overflow.** The scripted check found Home overflowing by 30px at 1280 and 84px at 1024, and Diary by 5px at 375; all three fixed. After the fix, Home at 1440/1280/1024/820/375 and Diary at 375 read 0 at three scroll depths. The other pages read 0 before the fix.
- **Not checked.** Reduced motion in a real browser (code-gated and covered by unit tests only). A real wish completion with an image upload. Album publish. Real devices.

## Code-first visual redesign (2026-10-22, `feature/code-first-ui`, merged into local main)

The owner chose "snow and lamplight", kept the hero paintings, ships the light theme only (tokens are ready for a night theme), and wanted SVG mood faces. Decorative bitmaps were replaced with tokens, CSS paper pieces, SVG components and Lucide icons, module by module: foundation + Home + shell, Album, Diary, Wishes, Story, then a phone-layout and QA commit. Images: 72 files / 7.48 MB → 8 files / 1.90 MB (hero art, avatars, WebGL weather textures).

- **Checks:** after every commit, Vitest 72 files / 461 tests, `npm run typecheck`, and finally `npm run build` passed. Assertions that pinned the old bitmaps were rewritten to assert the visible text and elements instead: the WebP entry stickers, the painted dialog backgrounds, the transparent painted buttons, the old modal colour, and the files of the folded Home stylesheets. They live in the AlbumView, DiaryView, WishesView, StoryView, naive-ui-migration and architecture tests. Behaviour assertions are unchanged.
- **Browser:** checked in the built-in browser against the throwaway stack (`codex-work/album-edit-check/stack.sh`, backend 15182) with a Vite server for the worktree on 15184. Pages: Home, Album (page, create dialog, edit dialog with photos, gallery), Diary (timeline, editor, mood picker), Wishes (boards, create dialog with live preview), Story (filter panel, timeline, detail, editor), Messages, About and logged-out Login.
- **Overflow:** a scripted horizontal-overflow check found none on any page at 1440, 1280, 1024, 820 and 375.
- **Not checked:** dark mode (not shipped), real AMap, upload/publish writes, real devices, production.
## Production Album-management Rollout (2026-10-22)

Under explicit authorization, deployed the main 6122588 production build with its matching backend. Fresh npx --no-install vitest run: 72 files / 461 tests; npm run typecheck and npm run build passed. All 129 HTTPS static files match the immutable build; release target is /var/www/snowlit/releases/album-edit-full-20261022T102413Z. Older releases remain available for rollback. Production manager detail now returns canManage=true; existing configuration/data and other services are unchanged. No new browser/device UI or real production album edit/delete was exercised. Detailed deployment evidence is under ignored codex-work/album-edit-deploy-20261022/.

## Published album management (2026-10-21)

Implemented manager edit/delete, shared creation/edit SortableJS photo grid, immediate edit uploads, confirmed discard/delete and final order publication. Vitest: 72 files / 460 passed; typecheck/build passed. Direct CUA/Edge drag/save/delete and desktop/390px checks used isolated synthetic APIs. No production acceptance or deployment.

## Full Production Deployment (2026-10-21)

Under explicit owner authorization, deployed the complete current backend and matching Web build to the existing server, started the previously stopped local backend, and restarted only snowlit-backend.service. Production now uses the configured Geoapify CDN origin with Open-Meteo unchanged. Both environments retain SQL_INIT_MODE=never. The owner separately approved creating the sole missing drafts table; production had no old drafts to convert. The original sixteen business tables' definitions and data matched the pre-deployment backup. Existing accounts, credentials and media were preserved.

The server jar matches the local packaged artifact SHA-256; all 129 HTTPS static files match the local Web build. Production public story reads pass (200), protected weather/drafts require login (401), and the retired album draft route returns 404. Fresh frontend checks: 451 tests, vue-tsc/build passed. The deployed gateway with live process provider configuration passed 8 location and 8 weather checks in an isolated context. The public login form rendered with no captured browser errors. Other service MainPIDs were unchanged. Root-only rollback material is retained on the server; ignored detailed evidence is under codex-work/geoapify-deploy-20261021/.

Authenticated production write/login/geolocation flows and mini-program simulator/device checks were not run; the owner will upload the mini program. Existing sessions need sign-in again. Changes remain uncommitted on codex/geoapify-configurable-endpoint, with no push; the owner's untracked specification is untouched.


## Unified Drafts (2026-10-20)

The album gateway/lifecycle uses the unified drafts API, explicit save only. Resumed private passwords are re-entered; missing dates default to local today and are editable. Saved pinned state survives recovery. The shared album cap is 50. Latest checks: 70 files / 450 Vitest tests, vue-tsc and production build passed; live browser/device checks were not run. Source changes are committed on `feature/drafts` (`2f17921 / b096289`); no push. Detailed command history and resolved failure outputs are in [the implementation report](../docs/drafts-implementation-report.md).


## Current State

2026-10-20: synchronized the weather consent text with original-coordinate provider queries. Relevant weather HTTP/refresh tests: 2 files, 11 passed. `npm run build` (vue-tsc and Vite) passed. No browser or live Web geolocation check; the mini-program/backend live check is recorded at the root.

2026-10-18: frontend architecture refactor complete and fast-forwarded into local main from `refactor/frontend-deepening` (not pushed). Commits, in order: weather contract tests read WeatherCondition.java; shared display helpers and trusted API types; behaviour tests instead of source-text tests; weather pipeline pruned to LazyLayers; one image-picking rule; session epoch and request guards; one motion module; Wishes board motion split from state; journal shell to src/shell and weather scheduling into the weather module.

## Verification in This Task

- After every commit: `npx vitest run` (final: 66 files, 431 tests passing, no unhandled errors), `npx vue-tsc -b` clean, `npm run build` passing. Test count fell from 501 because source-text assertions were removed.
- Live browser check against throwaway MySQL 8.4 / Redis 7.4 containers (seeded with SQL_INIT_MODE=always) and the packaged backend jar on port 18080 with local-disk uploads; Vite proxied through a git-ignored config in codex-work/. No AMap key; geolocation was declined, so no coordinates reached weather providers.
- Passed: login; update notice; location consent prompt, decline, settings dialog and re-prompt; Home hero, nav fusion, scroll reveal and count-up; Wishes board entry, create dialog submit and close, detail dialog, completion with image (stamp after the 200 response), lane move to done, image preview open and Escape close, reopen back to its lane; Story placeholder map, moment detail, editor open/cancel and image rejection; Album draft resume, PNG upload into the draft, desktop immersive gallery scroll; Diary timeline and editor image rejection; Messages bubbles and a post with an image; About; feedback dialog image rejection.
- Pre-existing issues found are listed under Current Limits in [findings](findings.md); none were changed.

## Follow-up Fixes (branch `fix/frontend-diary-location-mobile-gallery`)

- Diary no longer pre-fills the weather fallback's "unknown" location or its default weather label, and does not save a snapshot from the fallback alone; the shared helpers live in the weather module.
- The immersive album gallery uses the stacked list at 760px or narrower; the header scrolls away with the list.
- Checks: `npx vitest run` passed (67 files, 437 tests); the new diary and gallery tests fail against the old code. `npx vue-tsc -b` is clean and `npm run build` passes.
- Browser check at 375px against throwaway MySQL 8.4 (13306) and Redis 7.4 (16379), seeded with SQL_INIT_MODE=always, plus the packaged jar on 18080 with local-disk uploads. Passed: three photos stacked and visible with transform none; the gallery scrolls; photo preview opens and Escape closes it. Widening to 1280px switches live to the timeline, and scrolling it reveals photos. A new diary with the fallback active (top bar displaying localized location/weather-pending placeholders) had empty location and weather fields. Containers were removed afterwards.

## Second Pass (2026-10-18, branch `refactor/frontend-ideal`)

Commits: Story choreography out of StoryView into useStoryMotion, with useMotionSlots added to the motion module; the Story map canvas split into the canvas, useStoryMapCamera and useStoryMarkerMotion (1,294 → 817 lines); every remaining component on motion slots; the shell's styles moved to src/shell/journal-shell.css with journal-* class names and useHomeMotion deleted (all its flags were constant); album partial acceptance and smooth scroll on the shared reduced-motion listener; two misfiled style rules fixed.

- After every commit: strict check script (vitest exit code, no unhandled errors, `npx vue-tsc -b`, `npm run build`). Final: 69 files, 445 tests passing. New tests cover motion slots and close-once, Story camera wheel batching/unmount/fly-in, and album partial acceptance.
- Computed-style comparison against main: both builds served side by side (main from a temporary worktree) against throwaway MySQL 8.4 / Redis 7.4 and the packaged jar, each page settled, scrolled through and frozen, then ~35 computed properties hashed per element in document order. Home, Story, Wishes, Album, Diary, Messages, About and the logged-out login page matched element for element except for timing or randomness (hero autoplay, nav restore, JS idle floats, random diary card art, random login lamp hue). The comparison found two real differences, both fixed: the journal stage bottom padding on non-Home pages and the login `.eyebrow` style.
- Functional checks on the branch: Wishes create/close, completion (stamp after the 200 response, lane move, no ghost left), Story detail/editor/Escape and delete (confirm, fade, removal), Album draft upload with a mixed selection (good file uploaded, rule shown), dialog close, desktop immersive gallery scroll and Escape. Story save was not exercised: it needs a map location, which needs an AMap key.
- Note for future browser checks: the built-in browser pauses animation frames whenever its pane is hidden, which freezes GSAP, reveals and nav fusion; confirm `requestAnimationFrame` runs before trusting a result.

## Not Verified

Real maps (AMap) and Story save with a location, real geolocation and weather providers, mobile widths beyond the checks above, logout and switching members in the browser (covered by unit tests only), album publish, and the mini program.

## Consolidation into main (2026-10-22)

The owner requested all current code on main. Merged feature/warm-rebuild (standalone prototype plus evening-world shell/Home) with current backend/native work; there were no conflicts. Fresh merged-tree checks: npx --no-install vitest run, 71 files/442 passed; npm run typecheck and npm run build passed. This checkout initially lacked the locked lxgw-wenkai-webfont package; installed that one dependency offline from local npm cache, preserving package-lock.json, then rebuilt successfully. No Web implementation/assertions changed for integration. Previous browser checks remain historical; no new browser/device/production acceptance or push.
