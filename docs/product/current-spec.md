# Current Cross-Client Specification

This file records current source-backed behavior, not release or infrastructure status. Read the area-specific context and mini-program specifications for implementation details. API DTOs, VOs, Mappers, and controllers remain authoritative.

## Product and Clients

Snowlit shares one Spring Boot backend, account model, and business dataset across a Vue Web client and a native WeChat mini program. It records home status, albums, diaries, public story moments, wishes, messages, notices, and feedback.

The Web client owns its existing immersive motion system. The mini program prioritizes native interaction, readable layouts, privacy authorization, and weak-network handling rather than reproducing Web animation or creating a second data source.

## Identity and Authorization

- Web login uses an existing account and password. WeChat code exchange and explicit binding reuse existing users; there is no automatic registration flow.
- Backend business tokens are opaque random strings for sessions stored in Redis for one hour; clients must not parse them. openid, session_key, and AppSecret are not client credentials.
- An endpoint requires login exactly when its handler declares a required actor. Every 401 uses `{status, code: "UNAUTHORIZED", message}`; a missing or unreadable request body answers 400 `REQUEST_BODY_INVALID`. Logout is idempotent for a presented token.
- Managers are currently user IDs 1 and 2 (decided once per request on the backend) for album management, story writes, and wish creation/editing/deletion. Wish complete/reopen currently requires authentication.
- Diaries use shared/private visibility; private reads and mutations check authorship. Roles come from users.couple_role, never names. The current system is not complete multi-couple tenant isolation.
- Messages require login and can be deleted only by their author. Client visibility is not authorization.
- Editable profile fields are displayName, mood, and bio. Avatar upload is not implemented.

## Home, Date, and Location

HomeVo contains couple, dailyNote, personStatuses, distance, latest, and stats. Couple dates use startedOn; diary summaries use entryDate. Actual location/weather fields are in personStatuses, not an invented current/partner response.

Countries and cities come from actual reverse-geocoding results. Missing values remain unknown. Location and weather resolve independently; an unresolved location cannot be saved as fabricated success. Home requires authentication.

Plain YYYY-MM-DD values preserve calendar dates across timezones. Default diary/album dates use client-local today; reopening a diary editor refreshes its date. Timestamps retain instant semantics.

## Albums

1. Web albums use an explicit server draft: read/resume or save fields, upload images, then publish or discard. The native mini program autosaves new albums, diaries and moments; existing-entry edits do not use drafts.
2. The shared album maximum is 50 photos across backend/Web/mini program (owner decision superseding the original 300/9 split). Native picking uses up to nine each call. All images in an older over-cap draft remain visible and owned until removed/discarded; publish requires reducing it to the current cap.
3. Web uploads originals and Canvas WebP previews (longest side 2560px, quality 0.82), each up to 10MB. Native album uploads one compressed file using the existing original/preview storage rule. Progress/retry and publish guards remain. Unuploaded local files cannot survive reload; already uploaded images recover from the server without re-upload.
4. A resumed untitled draft can be named before publishing. Resumed private drafts need a new password, never stored in fields. Web resumes a missing album date with local today and allows editing it (owner clarification). Missing photo dates fall back to album eventDate only at publish; unknown places remain empty.
5. X-Album-Access-Token carries private access qualification stored through Redis. Repeated incorrect passwords can temporarily lock access. Exact thresholds are defined by AlbumPrivateAccess.
6. Likes toggle per user, album, and UTC day. Views deduplicate using the same calendar-day boundary and current access rules. Counts cannot become negative. Liking a private album does not unlock its photos. Catalog, detail, activity and public highlights exclude unpublished rows.
7. Published photos retain originalUrl/previewUrl; draft images use id/url with optional originalUrl and metadata. Media access and API authorization remain separate deployment boundaries.

## Drafts

The drafts table has a unique `(user_id, kind)` key. GET/PUT/DELETE `/api/drafts/{kind}` read, replace fields or discard; POST `/images`, DELETE `/images/{imageId}` and POST `/publish` own media/publication. Managers own album/moment drafts; diary drafts require the acting member's couple role. There is no client-selectable member or draft id. Image ids are opaque; object names are stored only server-side.

Every form field may be absent during drafting. Wrong types, unknown keys, bad enums/dates and length overflow return DRAFT_FIELDS_INVALID. Diary Markdown keeps a 60,000-character limit with the owner's additional 65,535-byte UTF-8 limit for text and complete serialized fields_json. Image limits are album 50, diary 20, moment 3. Field saves use last-save-wins without replacing images_json; image mutations lock their row. Passwords are album-publish-only.

Publication saves latest fields first, creates through the target module and removes the draft in one transaction. Expected validation/date conflicts keep the newly saved fields and images. Cleanup happens best effort after commit. Draft diary images are outside diary_uploads until publication; only referenced images become permanent uploads/references, and unused images are deleted. Drafts do not expire. Native pages autosave after 1.5 seconds and on hide/unload, upload on pick, offer continue/discard and clear former-member state on token change. Web has no autosave and no diary/moment drafts.

Retained databases with SQL_INIT_MODE=never need a separate backed-up, owner-approved reviewer rollout: create the new table once and convert legacy album drafts while preserving object references. This implementation does not perform that rollout or touch retained services/data.

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

- A message requires text, up to 500 characters, and optionally one jpg/png/webp/gif image up to 10MB. The Web wall reads the latest 20 items; Home includes a text summary.
- Notices and daily mute requests distinguish client=web|miniprogram. Client-specific mute state is independent.
- Feedback uploads up to three screenshots first, then submits imageUrls. Each image is limited to 10MB; an oversized screenshot answers 413.

## Uploaded Images

- Every upload flow accepts JPEG, PNG, WebP, and GIF up to 10MB, recognised from file content rather than the client MIME type or extension (album previews must be WebP). Oversized images answer 413; wrong types answer 400 with the flow's existing code.
- When object storage is not configured, every flow stores files on local disk and the backend serves them under `/uploads/`.

## Global Weather

- GET /api/weather/atmosphere/browser returns semantic weather fields; Web visual rendering parameters remain client-side.
- Geoapify provides location and Open-Meteo provides model weather. Both use original validated WGS84 coordinates and independent fallback behavior; the backend does not round them.
- Initial disclosure/permission precedes automatic updates. Web visibility and the mini-program Home lifecycle control foreground refresh every 20 minutes; background refresh pauses. Refusal does not trigger repeated prompts.
- Unknown location is not saved. Weather-only success can still be displayed. Old sessions and late callbacks cannot overwrite the current account.
- Provider requests do not forward business identity or content. Providers can retain logs. Attribution UI is hidden by request; privacy disclosures still describe actual processing.

## Main API Families

| Prefix | Current operations |
|---|---|
| /api/auth | login, wechat-login, wechat-bind-login, logout, GET me, PATCH me/profile |
| /api/home | GET overview, POST location |
| /api/albums | GET published catalog/details; POST unlock/like/view |
| /api/drafts/{kind} | GET/PUT/DELETE fields/draft; POST images/publish; DELETE images/{imageId} |
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
- Backend domains are under xyz.snowlit; Web modules expose index.ts. Uploads enter through one image intake over the ObjectStore seam (MinIO or local disk); do not recreate per-domain storage classes or old compatibility layers.
- New platform capabilities require reviewing privacy, legal domains, permissions/categories, and refusal behavior. Local code does not establish WeChat approval or production readiness.
- New seed data uses demo_a/demo_b, generic partner names, blank locations, and sample password 123456. Existing accounts and bindings remain intact.
- Keep SiteRecordLink and its current ICP number. Ordinary pages/login display it; immersive routes do not. The code does not establish external registration ownership or validity.
- Context documents use English. The user's privacy criterion does not require removing Chinese language, holidays, fonts, maps, or npm mirrors when they do not directly establish personal physical location.
- Public location fields and unstripped upload metadata are current boundaries, not newly authorized product changes. Preserve licenses, required assets, and runtime fallback behavior.
