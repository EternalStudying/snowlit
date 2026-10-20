# Web Current Findings

## Stack and Modules

Vue 3, Vite, TypeScript, Vue Router, and Naive UI form the application stack. GSAP, Lenis, motion-v, and Three support existing visual behavior. Dependencies and commands are defined by [package.json](package.json).

Ten modules live under src/modules: home, album, wishes, diary, story, messages, support, login, weather, and about. Each owns its model, Gateway, lifecycle, components, styles, assets, and tests. index.ts is the public entry point; do not restore compatibility exports for removed paths.

[src/shell](src/shell) holds the journal route shell: the hero carousel, scroll reveal, nav fusion and their styles ([journal-shell.css](src/shell/journal-shell.css)) that wrap every regular route. Its classes are `journal-*` (journal-shell, journal-stage, journal-nav, journal-hero-*); other pages' stylesheets may target them. It reads Home data only through the home module's entry. Home's stylesheets hold only Home's rules and load with HomeView; shared label styles (`.eyebrow`) live in the global base styles.

## Shared and Visual Boundaries

- [SessionRequest](src/http/sessionRequest.ts) handles tokens, JSON/FormData/204, errors, and session expiry. Private-album business failures must not accidentally clear the login session.
- [auth](src/auth.ts) manages business sessions. [router](src/router.ts) uses public module loaders and routeScrollPolicy for navigation restoration.
- [JournalRouteShell](src/shell/JournalRouteShell.vue) hosts regular routes. /story and /about are immersive; /story is public.
- Remote state is separate from GSAP, DOM observers, maps, camera movement, dialogs, and transitions. Listeners, timers, and visual resources need disposal paths. Choreography animates changes the lifecycle already made (e.g. [useWishBoardMotion](src/modules/wishes/internal/useWishBoardMotion.ts): the completion stamp plays only after the server confirms).
- [motion](src/motion.ts) owns the reduced-motion preference (one-shot and reactive), the test-only instant mode (turned on by tests/setup.ts), the close-once gate for dialogs, and `useMotionSlots`: every component holds its running timelines, tweens, contexts and media scopes in named slots, a new one replaces the old, and all stop on unmount (contexts revert, timelines are killed). Production code never checks whether it runs under the test runner, and no component writes its own animation cleanup.
- Story: [useStoryMotion](src/modules/story/internal/useStoryMotion.ts) owns the preloader exit, the one-time map entry and select/save/delete feedback; the map canvas renders markers and routes map events, with the camera (entry fly-in, smooth wheel zoom) in [useStoryMapCamera](src/modules/story/internal/useStoryMapCamera.ts) and marker choreography in [useStoryMarkerMotion](src/modules/story/internal/useStoryMarkerMotion.ts).
- [auth](src/auth.ts) has a session epoch that changes with every token change; [requestGuards](src/requestGuards.ts) (`createLatestRequest`, `createSharedRequests`) drop responses from an older request or session, and feature state resets on session change.
- [imageFiles](src/imageFiles.ts) is the one image-picking rule: JPEG/PNG/WebP/GIF by type or extension, at most 10MB, one accept list and one message. Every picker, the album included, keeps the acceptable files of a mixed selection and shows the rule for the rest; the album WebP preview keeps its own rule.
- [display](src/display.ts) holds shared presentation helpers (`errorMessage`, `formatDottedDate`). DTO types are trusted as declared; nullable backend fields are typed nullable instead of being cleaned defensively.
- Weather systems load layers through [LazyLayers](src/modules/weather/systems/LazyLayers.ts); the legacy CSS weather and per-scene classes are gone. [useAutomaticWeather](src/modules/weather/internal/useAutomaticWeather.ts) owns consent, the 20-minute schedule and the session check; AppTopBar only displays.
- The weather module owns reading place and condition: `weatherLocationName`, `weatherConditionLabel` and `knownWeatherPlace` return '' for the local fallback's 'unknown' sentinel. The top bar adds its placeholders on top. The diary uses the same helpers, so the fallback pre-fills nothing and saves no weather snapshot.
- The immersive album gallery has two layouts (`data-layout`): `timeline` (the 3D scroll timeline) and `stacked` (a plain scrolling list). Reduced motion or a width of 760px or less (the album's mobile breakpoint) selects `stacked`, and the layout changes live as the media query changes.
- Tests assert behaviour, not source text. Exceptions: tests/architecture.test.ts seam checks, the Naive UI migration audit, and contract checks that read backend sources.
- [SiteRecordLink](src/components/SiteRecordLink.vue) remains shared and preserved by user request. Do not import runtime assets from docs. Keep third-party licenses.

## Data and Interaction Contracts

- Home names and regions come from backend data. Unknown location remains unavailable. Stories without coordinates do not produce markers; an empty global map does not imply a user position at 0/0.
- Web maps use AMap. Missing VITE_AMAP_KEY keeps the fallback; do not fabricate coordinates.
- Weather forwards original WGS84 coordinates through the backend to Geoapify/Open-Meteo (user decision, 2026-10-20); the top-bar disclosure describes that precision. Weather requires initial disclosure/permission, then updates every 20 minutes in the foreground. Hiding pauses updates; refusal suppresses repeated automatic prompts; manual recovery remains available.
- Late responses cannot cross sessions. Location and weather fail independently; unresolved location must not overwrite stored position. Attribution UI is hidden, while privacy disclosure remains accurate.
- [calendarDate](src/calendarDate.ts) generates local calendar dates. Reopening a diary editor refreshes its default date. Timestamps retain instant semantics.
- Upload queues preserve retries and submission guards. Album original/preview uploads and the mini-program single-file protocol remain separate contracts.
- Chinese language, holidays, fonts, and platform choices may remain; they do not establish the user's physical location.

## Current Limits

The 390px home-page overflow remains unresolved. Found during the 2026-10-18 browser checks and present before the refactor: closing the new-wish dialog logs two Naive UI slot warnings (its content is v-if'd off while the modal's leave transition still renders it; v-show removes the warnings but flashes the dialog for ~300ms, so it stays); the new-wish dialog's background art shows its baked-in text at narrow widths. At 375px the Diary page is 537px wide, which pushes the write-diary button off-screen. External maps and complete write/permission acceptance are not established. See [current specification](../docs/product/current-spec.md) for business contracts and progress.md for the recorded verification baseline.
