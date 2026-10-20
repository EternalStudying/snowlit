# Web Progress Baseline

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
