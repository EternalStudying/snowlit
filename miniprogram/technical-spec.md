# Snowlit Mini Program Technical Specification

This is the current technical baseline, paired with the [product specification](product-spec.md). Start with [AGENTS.md](../AGENTS.md) and the [root plan](../task_plan.md); read the backend/Web context files when those areas are involved. Startup and shared configuration are documented in the [development guide](../docs/development.md).

## Architecture and Configuration

Use native WXML/WXSS/JavaScript in `miniprogram/`, sharing the Spring Boot/MyBatis backend, MySQL, Redis, and object storage. The backend package is `xyz.snowlit` and its account table is `users`. Do not introduce cloud development or another business data source by default.

| Path | Responsibility |
| --- | --- |
| [app.json](app.json), [app.js](app.js), [app.wxss](app.wxss) | Page/component registration, lifecycle, theme, and fonts |
| [constants/config.js](constants/config.js), [constants/routes.js](constants/routes.js) | Environments, timeouts, and navigation; use `switchTab` for tabs and `redirectTo` for ordinary return routes |
| [services](services) | Ten business services wrapping APIs and upload protocols |
| [utils/request.js](utils/request.js), [utils/upload.js](utils/upload.js) | Authorization, failure mapping, business tokens, and single-file uploads |
| [utils/auth.js](utils/auth.js), [utils/storage.js](utils/storage.js), [utils/permission.js](utils/permission.js) | Sessions, necessary caches, and entry visibility |
| [utils/date.js](utils/date.js), [utils/diary-markdown.js](utils/diary-markdown.js) | Calendar dates and diary rendering |
| [pages](pages), [components](components), [custom-tab-bar](custom-tab-bar) | Seventeen pages, shared components, and five tabs; pure mapping/validation belongs in `*-presenter.js` |
| [tests](tests) | Node assertions and service/presenter/page behavior tests |

Add `services/<domain>.js` before page integration. Pages own interaction/state; uploads use the shared wrapper. Extract components when reused, without introducing a global store/event bus prematurely. Keep page files and registered routes consistent.

`CURRENT_ENV=dev` uses `http://localhost:8080` for APIs/uploads; prod is configured as `https://snowlit.xyz`. Request/upload timeouts are 15/30 seconds. `fontFace=null` disables remote font requests. Localhost refers to the requesting device; physical devices need a reachable address that meets platform requirements.
Import `miniprogram/` with `miniprogramRoot=./`. AppID must match the backend and WeChat settings. Public `project.config.json` enables `urlCheck`, but local private settings can override it; physical-device/release validation must not depend on disabled checks.

Keep `lazyCodeLoading=requiredComponents` and `ignoreUploadUnusedFiles=true`; exclude tests and both specifications from packaging. Project targets are 2MB per main/subpackage, 500KB per page, and 200KB per image/audio asset; check current platform limits before release. New business media uses remote HTTPS. Keep the inline font, generic placeholders, and [font license](assets/fonts/OFL.txt).

## Identity, Sessions, and Failures

`wx.login` is exchanged and verified on the backend, which looks up the existing binding and issues a business token. `WECHAT_ACCOUNT_NOT_BOUND` leads to binding with a fresh code plus existing credentials. Preserve binding-conflict errors; do not register automatically or expose raw WeChat identity responses.
Use `Authorization: Bearer <business token>`. The client does not store `openid`, `session_key`, AppSecret, or provider keys. Backend checks enforce manager/authorship rules; client flags and roles control visibility only. Current manager IDs are 1 and 2, and `GET /api/auth/me` does not guarantee management flags.
Diary roles come from `users.couple_role`; missing roles fail explicitly. Creation can conflict for the same role/date; strict multi-couple `couple-id` isolation is not implemented.

| Local key | Meaning |
| --- | --- |
| `snowlit_token`, `snowlit_user` | Business session and display cache; clear on ordinary 401/logout; cached data grants no permissions |
| `snowlit_login_redirect` | Intended login return path, removed after reading |
| `snowlit_album_private_token_<id>` | Per-album access token/expiry; clear on expiry, invalidation, or logout |
| `snowlit_weather_auto_consent_v1` | Local automatic-location consent boolean, containing no GPS/weather and independent of login state |

Private albums use `X-Album-Access-Token`. Its invalidation clears only that album's token, not the business session. Check all HTTP statuses; 2xx succeeds, and upload responses require JSON parsing. Ordinary 401 clears the session and merges login prompts; login and private-album 401 retain separate semantics. Handle 403/404/5xx/network failures explicitly, without false success or unlimited retries.
Prefer Snowlit dialogs/toasts with native fallbacks. Pages need loading/empty/error/success states. Home/Wishes refresh in `onShow`; session changes clear private displays and reject stale responses.

## API and Data Contracts

These operations are consumed by `services/`; current source defines dynamic IDs, query details, and final backend permissions.

| Domain | HTTP operations | Key contract |
| --- | --- | --- |
| Login/binding | `POST /api/auth/wechat-login`; `POST /api/auth/wechat-bind-login` | `{code}` / `{code,username,password}` to `{token,user}` |
| Account/logout/profile | `GET /api/auth/me`; `POST /api/auth/logout`; `PATCH /api/auth/me/profile` | Update displayName/mood/bio; username/avatar remain read-only |
| Home/location | `GET /api/home`; `POST /api/home/location` | couple.startedOn, personStatuses, latest.diary.entryDate, latest.photo.previewUrl/takenAt |
| Weather | `GET /api/weather/atmosphere/browser` | latitude/longitude query; current 14-field response, independently degrading location/weather |
| Diary reads | `GET /api/diary/months`; `GET /api/diary`; `GET /api/diary/{id}` | Optional year, month as YYYY-MM; response entryDate |
| Diary writes/images | `POST /api/diary`; `PUT /api/diary/{id}`; `DELETE /api/diary/{id}`; `POST /api/diary/images` | Creation includes date; updates do not. contentMarkdown/moodKey/visibility; file upload returns uploadId/url |
| Moment reads | `GET /api/story/moments`; `GET /api/story/moments/{id}` | category/year filters; createdByUserId |
| Moment writes/images | `POST /api/story/moments`; `PUT /api/story/moments/{id}`; `DELETE /api/story/moments/{id}`; `POST /api/story/moments/images` | title/content/eventTime/endTime/locationName/address/longitude/latitude/category/images; file upload field |
| Album reads/access | `GET /api/albums`; `GET /api/albums/{id}`; `POST /api/albums/{id}/unlock`; `POST /api/albums/{id}/like`; `POST /api/albums/{id}/view` | Pagination/previewLimit; optional originalUrl and previewUrl; UTC activity day |
| Album publishing | `POST /api/albums`; `GET /api/albums/drafts/current`; `POST /api/albums/{id}/photos/mobile`; `POST /api/albums/{id}/publish`; `DELETE /api/albums/{id}/draft` | Mobile file + metadata JSON; cleanup is best-effort |
| Wish reads | `GET /api/wishes`; `GET /api/wishes/{id}`; `GET /api/wishes/summary` | category/completed/page/size; lastOperatedByUserId |
| Wish writes | `POST /api/wishes`; `PUT /api/wishes/{id}`; `DELETE /api/wishes/{id}` | Creation uses multipart payload without an image; updates use JSON |
| Wish state | `POST /api/wishes/{id}/complete`; `POST /api/wishes/{id}/reopen` | Completion requires image; reopening has no image; backend requires authentication |
| Notices/feedback | `GET /api/update-notice?client=miniprogram`; `POST /api/update-notice/mute-today?client=miniprogram`; `POST /api/feedback/screenshots`; `POST /api/feedback` | Client isolation; screenshot file; submission imageUrls |

Wish categories are want_go/want_do. Completed queries use completed=true; pending queries use category plus completed=false. Write fields are title/category/description/locationName/expectedCompletedAt/note, preserving actual input.
Album UI-local `url` maps from previewUrl. Mobile uploads do not produce WebP original/preview pairs; the Web protocol remains separate. Diary titles are level-one Markdown headings; images upload before insertion. Incomplete/failed images block saving, and the backend validates references from Markdown rather than a separate image array.

## Location, Maps, and Dates

Initial automatic location follows this sequence: disclose foreground frequency/third-party processing, obtain consent, check privacy permission, check native location permission, call `wx.getLocation({type:'wgs84'})`, then request weather.

- Signed-in Home attempts an update on opening/login and every 20 foreground minutes. Hidden/unloaded pages stop timers and discard late results; return refreshes only when due. Cancellation/denial suppresses automatic prompts for the current run; manual retry can explicitly open `wx.openSetting`. No continuous background location.
- Use actual country/city results. Save a resolved location even without weather. Weather alone stays in current-session page memory without calling home/location or being overwritten by stale summaries. Complete failure retains previous values. Unknown fields use placeholders; missing temperature stays -- degrees and real zero stays zero.
- Raw WGS84 coordinates go to the Snowlit backend. Only the backend calls Geoapify/Open-Meteo, rounding outbound coordinates to two decimal places and caching them. Provider keys never enter the client. Missing Geoapify configuration can still allow weather alone. The location flow does not persist GPS/weather locally.
- The moments map uses existing GCJ02 business coordinates separately from Home's WGS84 flow. An empty map uses 0/0 at scale 3 solely as its viewport center. Records without coordinates stay in lists and skip markers. Clustering follows zoom; initial includePoints fits once, without resetting after dragging/layout changes. Editing uses manual coordinates, not chooseLocation.

`utils/date.js` parses plain `YYYY-MM-DD` as local calendar components, validating month lengths/leap years; invalid default months fall back to the current device month. Z/offset timestamps remain instants displayed in device local time. Do not conceal date bugs with a global fixed timezone. Album UTC activity days and ordinary calendar dates are separate contracts.

## Media, Privacy, and Platform Boundaries

| Flow | Limit | Protocol |
| --- | --- | --- |
| Diary | 20 images | file; backend 10MB per image, jpg/png/webp/gif |
| Moments | 3 images | file; submit business URLs after upload |
| Lightweight album | 9 images | file + metadata: caption/takenAt/location/width/height/sortOrder |
| Wish completion | 1 required image | image |
| Feedback | 3 images | file; submit imageUrls after all uploads succeed |

Check privacy before `wx.chooseMedia`, using image/compressed options. Cancellation is quiet; other failures are visible. Lock image lists and duplicate operations during selection/upload/submission, and recheck state when callbacks return. Diary batches run serially to prevent late insertion/index errors. Preserve compatibility with extensionless/generic-MIME WeChat files and backend content-header/size validation.
Albums use create, upload, publish. On `ALBUM_DRAFT_EXISTS`, fetch the old draft and confirm discard before recreation; this is not recovery. Cleanup is best-effort; failures retain input and retry state.
Paginate lists, keep a single setData under 256KB, and update only necessary paths frequently. Page exit clears timers/stale responses. Support iPhone SE through iPad.

`app.json` declares scope.userLocation and requiredPrivateInfos:getLocation. Disclosures for permissions, third-party location queries, accounts, media, feedback, devices, and caches must match WeChat backend privacy settings. `authorizePrivacy` prefers the page component and stops on explicit denial. Unsupported/failed platform checks currently may continue through the no-authorization-needed branch; this does not establish backend compliance.
Physical-device/release acceptance requires valid HTTPS/TLS and request/uploadFile/downloadFile domains, with reachable API/media paths. New platform capabilities require category, permission, and fallback checks; code is not proof of backend approval.

Privacy concerns actual identity/location data. Chinese UI, festivals, fonts, map providers, and package registries do not prove personal location. Preserve the project's existing public ICP filing information. Public moments can return recorded addresses/raw coordinates, and uploads have no universal GPS/EXIF-removal step. Generic built-in images do not establish that future uploads lack location metadata. These are factual boundaries, not authorization to change visibility, upload protocols, or regional design.

## Development Commands and Validation Baseline

Run from the project root:

```bash
node --test miniprogram/tests/*.test.js
TZ=America/Los_Angeles node --test miniprogram/tests/*.test.js
TZ=Asia/Singapore node --test miniprogram/tests/*.test.js
TZ=UTC node --test miniprogram/tests/*.test.js
```

`tests/date.test.js` launches three timezone subprocesses covering calendar boundaries, leap years, date-only values, and instants. Singapore represents UTC+08; tests do not alter runtime configuration. Geographic fixtures use overseas/generic places and synthetic clustering coordinates.

Previous validation baseline: Node **80/80**, **112 JS** syntax checks, and **32 WXML/35 WXSS** compilations passed. **This documentation initialization did not rerun them.** Previous simulator coverage included WeChat login, main read/write flows, five upload flows, and global location/weather. Injected picker results do not establish native photo/camera or physical-device behavior. Simulator album publication used a prepared test draft, so it does not establish an end-to-end creation run.

Unverified external boundaries are iOS/Android devices, native picking, production domains/TLS, WeChat backend privacy settings, and review/release. Local/simulator success does not establish those states. Existing backend databases require `SQL_INIT_MODE=never`; do not rerun initialization SQL.
Update the product specification for scope changes and this document for interfaces, architecture, platform capabilities, or privacy contracts, synchronizing the affected backend/Web context.
