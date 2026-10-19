# Web Progress Baseline

## Current State

2026-10-18: frontend architecture refactor complete and fast-forwarded into local main from `refactor/frontend-deepening` (not pushed). Commits, in order: weather contract tests read WeatherCondition.java; shared display helpers and trusted API types; behaviour tests instead of source-text tests; weather pipeline pruned to LazyLayers; one image-picking rule; session epoch and request guards; one motion module; Wishes board motion split from state; journal shell to src/shell and weather scheduling into the weather module.

## Verification in This Task

- After every commit: `npx vitest run` (final: 66 files, 431 tests passing, no unhandled errors), `npx vue-tsc -b` clean, `npm run build` passing. Test count fell from 501 because source-text assertions were removed.
- Live browser check against throwaway MySQL 8.4 / Redis 7.4 containers (seeded with SQL_INIT_MODE=always) and the packaged backend jar on port 18080 with local-disk uploads; Vite proxied through a git-ignored config in codex-work/. No AMap key; geolocation was declined, so no coordinates reached weather providers.
- Passed: login; update notice; location consent prompt, decline, settings dialog and re-prompt; Home hero, nav fusion, scroll reveal and count-up; Wishes board entry, create dialog submit and close, detail dialog, completion with image (stamp after the 200 response), lane move to done, image preview open and Escape close, reopen back to its lane; Story placeholder map, moment detail, editor open/cancel and image rejection; Album draft resume, PNG upload into the draft, desktop immersive gallery scroll; Diary timeline and editor image rejection; Messages bubbles and a post with an image; About; feedback dialog image rejection.
- Pre-existing issues found are listed under Current Limits in [findings](findings.md); none were changed.

## Not Verified

Real maps (AMap), real geolocation and weather providers, mobile widths beyond the checks above, logout and switching members in the browser (covered by unit tests only), album publish, and the mini program.
