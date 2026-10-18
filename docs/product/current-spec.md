# Current Cross-Client Specification

This file records current source-backed behavior, not release or infrastructure status. Read the area-specific context and mini-program specifications for implementation details. API DTOs, VOs, Mappers, and controllers remain authoritative.

## Product and Clients

Snowlit shares one Spring Boot backend, account model, and business dataset across a Vue Web client and a native WeChat mini program. It records home status, albums, diaries, public story moments, wishes, messages, notices, and feedback.

The Web client owns its existing immersive motion system. The mini program prioritizes native interaction, readable layouts, privacy authorization, and weak-network handling rather than reproducing Web animation or creating a second data source.

## Identity and Authorization

- Web login uses an existing account and password. WeChat code exchange and explicit binding reuse existing users; there is no automatic registration flow.
- Backend business tokens represent sessions stored through Redis. openid, session_key, and AppSecret are not client credentials.
- SiteManagerPolicy currently permits user IDs 1 and 2 for album management, story writes, and wish creation/editing/deletion. Wish complete/reopen currently requires authentication.
- Diaries use shared/private visibility; private reads and mutations check authorship. Roles come from users.couple_role, never names. The current system is not complete multi-couple tenant isolation.
- Messages require login and can be deleted only by their author. Client visibility is not authorization.
- Editable profile fields are displayName, mood, and bio. Avatar upload is not implemented.

## Home, Date, and Location

HomeVo contains couple, dailyNote, personStatuses, distance, latest, and stats. Couple dates use startedOn; diary summaries use entryDate. Actual location/weather fields are in personStatuses, not an invented current/partner response.

Countries and cities come from actual reverse-geocoding results. Missing values remain unknown. Location and weather resolve independently; an unresolved location cannot be saved as fabricated success. Home requires authentication.

Plain YYYY-MM-DD values preserve calendar dates across timezones. Default diary/album dates use client-local today; reopening a diary editor refreshes its date. Timestamps retain instant semantics.

## Albums

1. Web flow: find current draft, create if needed, upload photos, then publish. Drafts do not appear in the published catalog. Draft operations check creator ownership.
2. An album allows at most 300 photos and requires a successful upload before publication. Web uploads original and preview separately; originals are limited to 10MB. Previews are Canvas-produced WebP with longest side up to 2560px and quality 0.82.
3. The queue supports per-item progress, failure/retry, and submission guards. Server drafts can be recovered, but unuploaded local File objects cannot survive a reload.
4. Mini-program /photos/mobile accepts one file used for original and preview. Its lightweight creation flow handles conflicting drafts; it does not provide a persistent draft-management workspace.
5. X-Album-Access-Token carries private access qualification stored through Redis. Repeated incorrect passwords can temporarily lock access. Exact thresholds are defined by AlbumModule.
6. Likes toggle per user, album, and UTC day. Views deduplicate using the same calendar-day boundary and current access rules. Counts cannot become negative. Liking a private album does not unlock its photos.
7. Photo response fields are originalUrl and previewUrl. Media URL access and API authorization are separate boundaries that require deployment verification.

## Wishes

- Categories are want_go and want_do; completion enters the completed view and reopening returns to the original category.
- Creation is multipart payload plus an optional image; editing uses JSON. Completion requires one image, up to 10MB.
- Each board column has independent pagination. Mutations reset affected pagination; stale responses cannot append obsolete items. Prevent duplicate submissions and conflicting closes.
- Web creation supports optional images. Mini-program creation/editing has no image picker; completion supports a photo.
- Location, notes, and planned time use the actual request fields rather than fixed empty substitutions.

## Diaries

- Entries are grouped by month. Responses use entryDate; creation uses date. The date cannot change during editing.
- Each role/date allows one active diary. contentMarkdown contains body and image references; uploads return uploadId and url.
- A diary allows up to 20 images of up to 10MB each. The backend manages temporary uploads, references, and cleanup. Rendering and editing share Markdown interpretation and sanitization rules.

## Public Story Moments

- Lists/details are public. Manager authorization controls create/update/delete/image upload. Records include user-supplied place, address, coordinates, times, category, and images.
- Up to three images per record, at most 10MB each. Categories: daily, date, travel, anniversary, surprise.
- Web supports year/category filters, map markers, same-place grouping, timeline, image viewer, and recent-memory entry points. SDK/camera/motion/dialog/transition work stays separate from remote data state.
- Immersive entry uses the existing transition and restores the previous route/scroll where possible. Reduced-motion and SDK/data fallbacks remain supported.
- Mini-program maps use native map/list behavior defined by its technical specification.

## Messages, Notices, and Feedback

- A message requires text, up to 500 characters, and optionally one jpg/png/webp image up to 10MB. The Web wall reads the latest 20 items; Home includes a text summary.
- Notices and daily mute requests distinguish client=web|miniprogram. Client-specific mute state is independent.
- Feedback uploads up to three screenshots first, then submits imageUrls. Each image is limited to 10MB. Feedback retains its local-storage fallback when object storage is unconfigured.

## Global Weather

- GET /api/weather/atmosphere/browser returns semantic weather fields; Web visual rendering parameters remain client-side.
- Geoapify provides location and Open-Meteo provides model weather. Both use backend-rounded WGS84 coordinates and independent fallback behavior.
- Initial disclosure/permission precedes automatic updates. Web visibility and the mini-program Home lifecycle control foreground refresh every 20 minutes; background refresh pauses. Refusal does not trigger repeated prompts.
- Unknown location is not saved. Weather-only success can still be displayed. Old sessions and late callbacks cannot overwrite the current account.
- Provider requests do not forward business identity or content. Providers can retain logs. Attribution UI is hidden by request; privacy disclosures still describe actual processing.

## Main API Families

| Prefix | Current operations |
|---|---|
| /api/auth | login, wechat-login, wechat-bind-login, logout, GET me, PATCH me/profile |
| /api/home | GET overview, POST location |
| /api/albums | GET catalog/details/current draft; POST create/unlock/like/view/photos/photos/mobile/publish; DELETE draft |
| /api/wishes | GET list/details/summary; POST create/complete/reopen; PUT edit; DELETE |
| /api/diary | GET months/month/details; POST entry/images; PUT edit; DELETE |
| /api/story/moments | GET list/details; POST create/images; PUT edit; DELETE |
| /api/messages | GET list; POST multipart message; DELETE author's message |
| /api/update-notice | GET current notice; POST mute-today with client |
| /api/feedback | POST screenshots; POST feedback |
| /api/weather | GET atmosphere/browser |

ApplicationFailure is mapped by the HTTP adapter to status/code/message. Field names come from current DTOs/VOs rather than retired specifications.

## Maintenance and User Decisions

- [schema.sql](../../backend/src/main/resources/schema.sql) and current Mappers define data structure. Retained databases must not be initialized again; schema changes require a deliberate migration/recovery plan.
- Backend domains are under xyz.snowlit; Web modules expose index.ts. Shared ObjectStore retains real external adapters; do not recreate old compatibility layers.
- New platform capabilities require reviewing privacy, legal domains, permissions/categories, and refusal behavior. Local code does not establish WeChat approval or production readiness.
- New seed data uses demo_a/demo_b, generic partner names, blank locations, and sample password 123456. Existing accounts and bindings remain intact.
- Keep SiteRecordLink and its current ICP number. Ordinary pages/login display it; immersive routes do not. The code does not establish external registration ownership or validity.
- Context documents use English. The user's privacy criterion does not require removing Chinese language, holidays, fonts, maps, or npm mirrors when they do not directly establish personal physical location.
- Public location fields and unstripped upload metadata are current boundaries, not newly authorized product changes. Preserve licenses, required assets, and runtime fallback behavior.
