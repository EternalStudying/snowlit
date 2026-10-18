# Web Current Findings

## Stack and Modules

Vue 3, Vite, TypeScript, Vue Router, and Naive UI form the application stack. GSAP, Lenis, motion-v, and Three support existing visual behavior. Dependencies and commands are defined by [package.json](package.json).

Ten modules live under src/modules: home, album, wishes, diary, story, messages, support, login, weather, and about. Each owns its model, Gateway, lifecycle, components, styles, assets, and tests. index.ts is the public entry point; do not restore compatibility exports for removed paths.

## Shared and Visual Boundaries

- [SessionRequest](src/http/sessionRequest.ts) handles tokens, JSON/FormData/204, errors, and session expiry. Private-album business failures must not accidentally clear the login session.
- [auth](src/auth.ts) manages business sessions. [router](src/router.ts) uses public module loaders and routeScrollPolicy for navigation restoration.
- [JournalRouteShell](src/modules/home/JournalRouteShell.vue) hosts regular routes. /story and /about are immersive; /story is public.
- Remote state is separate from GSAP, DOM observers, maps, camera movement, dialogs, and transitions. Listeners, timers, and visual resources need disposal paths.
- [SiteRecordLink](src/components/SiteRecordLink.vue) remains shared and preserved by user request. Do not import runtime assets from docs. Keep third-party licenses.

## Data and Interaction Contracts

- Home names and regions come from backend data. Unknown location remains unavailable. Stories without coordinates do not produce markers; an empty global map does not imply a user position at 0/0.
- Web maps use AMap. Missing VITE_AMAP_KEY keeps the fallback; do not fabricate coordinates.
- Weather requires initial disclosure/permission, then updates every 20 minutes in the foreground. Hiding pauses updates; refusal suppresses repeated automatic prompts; manual recovery remains available.
- Late responses cannot cross sessions. Location and weather fail independently; unresolved location must not overwrite stored position. Attribution UI is hidden, while privacy disclosure remains accurate.
- [calendarDate](src/calendarDate.ts) generates local calendar dates. Reopening a diary editor refreshes its default date. Timestamps retain instant semantics.
- Upload queues preserve retries and submission guards. Album original/preview uploads and the mini-program single-file protocol remain separate contracts.
- Chinese language, holidays, fonts, and platform choices may remain; they do not establish the user's physical location.

## Current Limits

The 390px home-page overflow remains unresolved. External maps and complete write/permission acceptance are not established. See [current specification](../docs/product/current-spec.md) for business contracts and progress.md for the recorded verification baseline.
