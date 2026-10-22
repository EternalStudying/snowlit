# Web Current Findings

## Stack and Modules

Vue 3, Vite, TypeScript, Vue Router, and Naive UI form the application stack. GSAP, Lenis, motion-v, and Three support existing visual behavior. Dependencies and commands are defined by [package.json](package.json).

Ten modules live under src/modules: home, album, wishes, diary, story, messages, support, login, weather, and about. Each owns its model, Gateway, lifecycle, components, styles, assets, and tests. index.ts is the public entry point; do not restore compatibility exports for removed paths.

[src/shell](src/shell) holds the journal route shell: the hero carousel, scroll reveal, nav fusion and their styles ([journal-shell.css](src/shell/journal-shell.css)) that wrap every regular route. Its classes are `journal-*` (journal-shell, journal-stage, journal-nav, journal-hero-*); other pages' stylesheets may target them. It reads Home data only through the home module's entry. Home's stylesheets hold only Home's rules and load with HomeView; shared label styles (`.eyebrow`) live in the global base styles.

## Visual System (code-first, 2026-10-22)

The Web UI is drawn in code, not bitmaps. The direction, chosen by the owner, is "snow and lamplight": a snow-white ground, night-blue ink, lamplight amber, camellia red for love and primary actions, and pine green for labels and done states. The paper/journal mood stays, but every surface is HTML, CSS or inline SVG.

- **Tokens** live in [00-tokens.css](src/styles/00-tokens.css):
  - palette (`--snow`, `--sheet`, `--ink`, `--ink-soft`, `--frost`, `--camellia`, `--lamp`, `--pine`, `--night`, plus `-wash`, `-deep` and `-rgb` variants);
  - type roles: `--font-display` (Ma Shan Zheng, falling back to Kaiti) for page titles, `--font-heading` (Kaiti) for card and dialog titles, `--font-body` (Noto Serif SC, falling back to Songti) for reading text, `--font-ui` (system sans) for dates, counts and chips;
  - a 1.25 type scale, spacing, radius, shadow, and the inline `--grain` noise and `--ruled` lines.
- **Legacy tokens.** Older names (`--coral`, `--paper`, `--line`, `--muted` and so on) point at the palette. Write new styles against the new names, and never add literal colours: use a token or `rgba(var(--x-rgb), a)`.
- **Shared pieces.**
  - Classes in [04-paper.css](src/styles/04-paper.css): `.paper-sheet` (+`--ruled`), `.washi` tape (+`--camellia`/`--pine`/`--top`), `.paper-tab`, `.paper-chip`, `.ui-text`.
  - Components in [src/components/paper](src/components/paper): `StickerButton` (the one "add" control, used by Album, Diary, Wishes and Story), `PostmarkStamp`, `HeartMark`.
  - Diary moods are one SVG component, [MoodFace](src/modules/diary/components/MoodFace.vue).
- **Naive UI.** [naive-theme.ts](src/styles/naive-theme.ts) mirrors the palette with literal values, because Naive needs real colours. Animations must not clear the whole inline `style` of Naive components (`clearProps: 'all'`), because Naive keeps its theme variables there; clear only the animated properties.
- **Story** uses night glass over the map (`--story-glass*` in [story-night.css](src/modules/story/story-night.css), scoped to `.story-map-page` and the teleported `.moment-editor`) and a paper card for moment details.
- **Images.**
  - The remaining bitmaps are content or function only: the two hero storybook paintings, the couple avatars, and four WebGL cloud and fog textures.
  - Before: 72 files, 7,477,660 bytes. After: 8 files, 1,903,544 bytes.
  - Do not add decorative bitmaps. Titles, buttons and icons must be real elements, never painted into an image behind a transparent hit area.
- **Dialogs** (album create/edit, wish create, moment editor) are content-sized sheets: a fixed header and action bar, with a scrolling body.
- **Copy and data fixes made during the redesign.**
  - Home's latest-diary card links to /diary.
  - Message avatars follow the author.
  - The next-wish strip shows the wish's own note, not the anniversary date.
  - A wish with no photo shows a placeholder instead of the hero banner.
  - Diary card tint and tape position come from the entry id, not randomness.

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

## Album Drafts

The album gateway uses `/api/drafts/album`: GET reads `{draft}`, PUT replaces `{fields}`, multipart POST `/images` sends original + WebP preview + metadata, DELETE `/images/{opaqueId}` removes a photo, POST `/publish` sends latest fields plus the separate password, and DELETE the root discards. Drafts use `{kind, fields, images, createdAt, updatedAt}`; published album detail responses keep their existing shape.

The Web flow remains explicit save/upload, resume, retry, publish and discard; it has no autosave and no diary/moment drafts. Untitled drafts have an explicit label and editable title. Resumed private drafts start with an empty required password. A missing resumed eventDate defaults to local today and has a date input (owner decision); the saved pinned flag survives Web edits. The shared album limit is 50 including already uploaded draft images. Older over-cap drafts stay visible for removal; stale upload batches cannot attach to a replacement draft. Unuploaded local File objects still cannot survive a reload.

## Album Editing and Ordering

Album editing/deletion is implemented on feature/album-edit. `AlbumImmersiveGallery` emits manager-only edit/delete actions from detail.canManage; catalog rows have no actions. The creation dialog also handles editing, with an empty password and hasPassword placeholder. New photos use the existing preview/upload queue and edit API; save submits photoId/draftImageId in grid order, refreshes gallery/catalog, and clears private access on visibility/password changes. Discard cancels the edit draft; beforeunload uses keepalive. Edit mode does not read or change creation drafts and has no autosave. Delete uses an NModal naming the title/photo count, and a 404 also removes the catalog item.

`sortablejs` and `@types/sortablejs` are the only added packages (MIT); SortableJS supports mouse/touch ordering in AlbumPhotoGrid and is destroyed with the dialog. The first thumbnail is the cover; 设为封面 moves it first. Creation reorders persist through the order endpoint, and publish sends imageOrder. The existing vue-tsc command is exposed as npm run typecheck. Final validation: 72 files / 460 tests, typecheck/build passed; CUA/Edge exercised drag/save/delete with synthetic APIs at desktop and 390px. No retained service or production verification was performed.

## Current Limits

Resolved by the 2026-10-22 redesign: the 375px Home and Diary overflow (Diary has a phone layout; no page overflows at 1440, 1280, 1024, 820 or 375); the new-wish dialog's baked-in background text (there is no background art); the sideways-scrolling phone nav. Still present: closing the new-wish dialog logs two Naive UI slot warnings. Its content is v-if'd off while the modal's leave transition still renders it; v-show removes the warnings but flashes the dialog for ~300ms, so it stays. Weather cloud sprites drift above dialogs. External maps and complete write/permission acceptance are not established. See [current specification](../docs/product/current-spec.md) for business contracts and progress.md for the recorded verification baseline.

## Production Deployment Snapshot (2026-10-21)

The full current frontend and matching backend were deployed under explicit authorization. All 129 HTTPS static files match the local production build. The login form rendered without captured browser console errors; authenticated production interactions were not tested. Previous release files remain available for rollback. No Web source or dependencies changed during deployment.

Album dialog layout (code-first redesign, 2026-10-22): the create/edit dialog is a content-sized paper sheet with a fixed header and action bar. Its body scrolls, and the photo grid scrolls on its own (max 360px). It has two columns above 860px and stacks below that. Once the grid has photos, the dashed drop zone collapses to a compact add strip. The earlier fixed-ratio, stamp-avoiding layout is gone.
