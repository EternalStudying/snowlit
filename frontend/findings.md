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

## Motion System (GSAP, 2026-10-22)

- **One kit.** [motionKit.ts](src/motionKit.ts) registers every GSAP plugin once (ScrollTrigger, SplitText, Flip, DrawSVG, MorphSVG, CustomEase). Draggable and Inertia register on first use through `useThrowables()`, because Draggable reads the user agent when it registers. Pages import from the kit and never register plugins themselves.
- **Shared vocabulary.**
  - Eases: `EASE_SETTLE` for arrivals; `EASE_LIFT` for pick-up and release.
  - Helpers: `revealTitle` (per-character SplitText behind a mask), `settleOnScroll` (ScrollTrigger.batch), `drawStroke`.
  - Directives: `vTilt` (pointer tilt plus lamplight) and `vMagnetic`, in [pointer.ts](src/directives/pointer.ts).
  - Sparks: `sparkAt` / `sparkFrom` in [sparks.ts](src/sparks.ts) mark a save, publish, like or completion that succeeded.
- **Where it is used.**
  - Route changes: a GSAP hand-off in App.vue.
  - Hero: sinks as the page scrolls past it ([useHeroParallax](src/shell/useHeroParallax.ts)).
  - Home ([useHomeStory](src/modules/home/internal/useHomeStory.ts)):
    - On wide screens the "days" chapter is pinned, with odometer reels and a DrawSVG thread through four stops. Phones play it once, unpinned.
    - The recent cards form a fan that spreads toward the pointer.
    - The next-wish tick is drawn.
  - Album: per-character title, a scrubbed postmark, card lamplight and sparks.
  - Diary ([useDiaryMotion](src/modules/diary/internal/useDiaryMotion.ts)): per-character month titles, spine points that light up, month tabs dealt in, and a mood-face pop.
  - Wishes: the completion ring inks in (DrawSVG), the dash bends into a tick (MorphSVG), then sparks.
  - Messages: bubbles can be thrown (Draggable + Inertia), and a press without a drag still opens the message.
  - Login and About: the titles are written out.
- **Rules.**
  - Every helper returns early when `shouldSkipMotion()` (reduced motion or test instant mode), leaving the end state.
  - GSAP work lives in a `gsap.context` or `gsap.matchMedia` that is reverted on unmount.
  - A page's root element must not overflow sideways while things fly in: Home clips with `.journal-route-content > .home { overflow-x: clip }`, because the shell sets `overflow: visible` on route content.
- **Tests.** [tests/setup.ts](tests/setup.ts) imports the kit and calls `ScrollTrigger.disable()`. If ScrollTrigger stays on, its always-on requestAnimationFrame loop recurses under synchronous rAF stubs and eats fake-timer time; that was the cause of the earlier "flaky" topbar timeouts.

## Evening World: shell and Home rebuilt (2026-10-22, `feature/warm-rebuild`)

The owner asked for a from-scratch rebuild, one page at a time: warm and visually rich, with GSAP, Three.js and other open-source tools, and with every functional module kept. Home and the shell came first. The owner approved a standalone prototype before the real build.

- **Direction: an evening at the snow cottage.**
  - The pages continue the cover paintings' world instead of switching to flat UI.
  - Colours are sampled from the paintings: dusk violet to peach sky, lantern amber, cedar wood, sakura, camellia, and warm walnut ink.
  - Tokens are `--world-*` in [snow-shell.css](src/shell/snow-shell.css).
  - Type is LXGW WenKai (`lxgw-wenkai-webfont`), self-hosted and split by character range, so a page downloads only the glyphs it shows.
- **Shell** ([JournalRouteShell.vue](src/shell/JournalRouteShell.vue), [useEveningWorld](src/shell/world/useEveningWorld.ts)):
  - The painted cover crossfades between the two paintings.
  - The nav is a wooden plaque hanging on cords. It docks with `position: sticky`, and a lantern slides behind the current page.
  - The old nav measured layout and wrote nine CSS variables onto the shell root every scroll frame, which was the cause of the choppiness. Nothing measures on scroll now.
  - [ambientDrift](src/shell/world/ambientDrift.ts) is a Three.js layer of petals and light snow. `burstPetals(x, y)` scatters petals from a point. It is separate from the real-weather layer in `modules/weather`, which stays as is.
- **Evening opt-in.** Only Home is an evening page. The shell's `data-world` is `evening` there and `paper` elsewhere, because pages not yet rebuilt have dark text on a light ground. Rebuilt pages opt in.
- **Top bar.** The top bar is fixed and transparent over the cover, keeping all its functions. It is click-through except for its own controls.
  - The shell must not use `isolation`. The docked plaque (z 46) has to stack above the bar (z 45).
  - The sky sits at z 0, and the page content is lifted to z 1.
- **Home** ([HomeView](src/modules/home/HomeView.vue), [useHomeEvening](src/modules/home/internal/useHomeEvening.ts)):
  - A lantern string lights up as the day count climbs. Lantern positions are computed from the cord's curve, not measured.
  - Two lit windows show each person's city weather outside, with a lamp, curtains, a mug and a plant inside, and shoji screens that slide open. A knotted red thread joins them.
  - The daily note is a letter with a torn edge, a stamp, a postmark, a sprig and a seal.
  - Diary, message and photos are laid on a table.
  - The next wish is an ema plaque that swings, then opens Wishes.
- **Rules.**
  - Static end states live in CSS: screens open, lanterns lit. Motion animates from-to, so reduced motion and test instant mode show the finished page.
  - The global `figure` rule (paper background, border, hidden overflow) must be reset on decorative figures.
- **Tests.** [topbar-weather-summary](tests/topbar-weather-summary.test.ts) fakes only timeouts, intervals and Date. Faking animation frames made GSAP's always-on ticker replay about 21k frames during its 20-minute jump, which ran past the 5-second limit under parallel load. That was the real cause of the long-standing "flaky" top-bar failures.

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
