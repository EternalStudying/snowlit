# Snowlit Mini Program Product Specification

This is the current product baseline. See the [technical specification](technical-spec.md) for interfaces, architecture, configuration, and validation, and [AGENTS.md](../AGENTS.md) for project rules. Local implementation does not establish acceptance on physical devices, in production, or by WeChat review.

## Scope

The native WeChat Mini Program is a lightweight companion to the couple's shared record space. It reuses the Web application's Spring Boot backend, accounts, permissions, and media storage. Its main tasks are browsing updates, diaries, moments, albums, and wishes, plus lightweight editing and feedback. Do not introduce a second business data source or cloud development by default.

Implemented features include WeChat login and existing-account binding, the home dashboard, diaries, a public moments map and list, manager editing, lightweight album creation, wish state changes, profile editing, notices, and feedback.
Not currently provided: albums above 50 photos or resumable binary uploads, map-based location picking, images when creating/editing wishes, feedback history, notice history, subscription messages, or payments. These are scope boundaries, not scheduled requirements.

## Identity and Permissions

| Identity | Available features | Final authorization |
| --- | --- | --- |
| Guest | Home introduction and public moments list/details | No private home, album, wish, or notice requests |
| Signed-in user | Home, albums, wishes, profile, feedback, and permitted diaries | Private diaries are author-only; diary updates/deletion require authorship |
| Manager | Create/edit/delete moments and wishes; create albums | Current backend manager IDs are 1 and 2; client visibility cannot grant permission |

WeChat login connects existing Snowlit accounts; it does not register new accounts. Users must actively accept the service agreement and privacy policy before login. A bound account signs in directly; an unbound identity uses a fresh WeChat code plus existing account credentials. Binding conflicts remain explicit errors on the login page.
The client stores only the business session and necessary display/access caches, never WeChat identity secrets. Logout clears session-related caches. Expired sessions prompt login and return to the intended page afterward.

Wish completion/reopening requires authentication on the backend; creation/editing/deletion requires management permission. The list allows signed-in users to complete/reopen wishes, while the detail action area currently appears only for managers. Do not describe both entry points as an authorship rule.

## Pages and Navigation

There are 17 registered pages and no business subpackages. Five tabs are Home, Diary, Albums, Wishes, and Profile; Moments is entered from Home.

| Page directory | Purpose and access |
| --- | --- |
| `pages/index` | Guest-accessible home; private sections load after login |
| `pages/login` | WeChat login and existing-account binding |
| `pages/diary`, `pages/diary-detail`, `pages/diary-edit` | Signed-in diary browsing/editing, subject to backend visibility and authorship |
| `pages/story`, `pages/story-detail`, `pages/story-edit` | Public map/details; editing requires management permission |
| `pages/albums`, `pages/album-detail`, `pages/album-edit` | Signed-in listing, unlocking/previewing, and lightweight creation; creation requires management permission |
| `pages/wishes`, `pages/wish-detail`, `pages/wish-edit` | Signed-in wishes/details; editing requires management permission |
| `pages/profile`, `pages/profile-edit`, `pages/feedback` | Current account, notices, profile editing, and feedback |

## Feature Behavior

### Home and Weather

- Guests load public moments only. Signed-in users see the couple summary, daily copy, saved weather/location, the first two albums, aggregated wish statistics, and Mini Program notices. Render a notice when `notice` exists; `shouldShow` controls proactive prompting only.
- Home and Wishes refresh when their tabs return. Login, logout, or account switching clears private display state; responses from an old session cannot populate a new session.
- Opening Home or completing login starts an automatic weather/location update. First explain the purpose, third-party processing, and frequency, obtain consent, then request native location permission. Refresh every 20 minutes while Home is visible; stop timers when hidden, backgrounded, or unloaded. Refresh on return only when 20 minutes have elapsed since the last attempt. Keep manual refresh; do not continuously locate in the background.
- Persist only a local consent boolean. Cancellation or denial suppresses repeated automatic prompts for the current run. Manual refresh can retry; opening system settings requires an explicit user action.
- Display actual resolved places, with an unknown-location placeholder when unavailable; never assume a country or city. A resolved place can be saved without weather. Weather alone updates the current page without saving a false place. If both fail, retain the previous display.
- Do not persist GPS or weather in local storage. The technical specification describes the actual location and third-party data flow.

### Diaries and Moments

Diaries use real month metadata and support all, mine, partner, and private filters. Store the title as a Markdown level-one heading and render text, images, quotes, lists, code, and tables in order. Creation submits a date; editing keeps it read-only. Allow up to 20 images, uploading before inserting them into Markdown; incomplete/failed uploads block saving. Authors confirm deletion. New entries recover server drafts; editing existing entries does not use drafts.

Guests can browse moments, filter by category/year, and adjust the native map/list layout. The map displays recorded coordinates without requesting the viewer's location. A single marker selects its item; a list item opens details. Nearby markers cluster and can be expanded. Empty maps use a world view; records without coordinates remain in the list. Managers enter place/address/coordinates manually and attach up to three images.

### Albums

Signed-in users browse published albums with pagination, private locks, pinning, and photo/view/like statistics. Private access tokens expire and require unlocking again. Prefer preview images while retaining an optional original URL. There is no dedicated original-download or save-image flow. Likes and views use the backend's UTC calendar day.

Managers create albums through server drafts, with a shared 50-photo limit on both clients and the backend (owner decision). Native picking selects up to nine photos each time and supports multiple batches. A shared draft with more than nine photos restores all images without re-upload; older over-cap drafts are never truncated and can be reduced before publishing.

When photos carry shooting dates or GPS, untouched album date/place fields fill from the earliest shot and the first resolved GPS photo, retaining the existing settled-field rules. Every photo keeps its own available date/place. Metadata reading and place lookup finish before its upload. Missing details stay unknown in the draft; publication requires an album date and uses it for a photo without a shooting date, as confirmed by the owner. Missing places stay empty. Removed-photo callbacks cannot fill the form. Existing albums are not rewritten.

### Creation Drafts

Albums, diary entries and moments each have one server draft per member. On returning to a new-entry page, the form stays locked until the member chooses to continue the saved fields/images or discard the draft. The dialog shows its last save time. Discard deletes the draft and its owned images; failures keep the draft available for retry.

The first field edit or photo pick starts a draft. Fields autosave after 1.5 seconds without typing and immediately when the page hides or unloads. Picked images upload immediately; a quiet footer reports saving, last save time or retryable failure. There are no autosave toasts. Publishing waits for uploads and field saves, submits the newest form, creates the real record and removes the draft. A validation/date conflict retains the latest fields and images. Private album passwords are never autosaved and must be entered again after recovery. Changing account stops autosave and clears the former member's page state. Editing existing diaries/moments retains its original APIs and has no drafts.


### Wishes, Profile, and Feedback

Wishes have separate paginated Want to Go, Want to Do, and Completed sections, with counts, empty states, and errors. Creation/editing supports title, category, expected date/place, description, and notes. Completion requires one uploaded image; reopening needs none. Prevent duplicate operations, refresh after success, and confirm deletion.

Profile refreshes current account data and notices. Users can edit display name, mood, and bio; username and avatar are read-only. Logout clears local sessions even if its backend call fails. Feedback includes category, title, content, contact information, up to three screenshots, and a limited device summary. Upload screenshots before submission and preserve input on failure. Notices and daily muting are isolated by Mini Program client.

## Experience and Privacy Boundaries

Use restrained black/white/gray styling, whitespace, short feedback, and shared Snowlit sheets/fonts. Support iPhone SE through iPad, with loading, empty, error, and success states. Check long text, keyboard coverage, weak networks, and image preview.

Request permissions in their relevant flow. Location refusal does not block browsing; media refusal stops picking/uploading. Privacy disclosures cover login, profile, location and third-party queries, media, feedback, device information, and necessary caches. Source declarations do not replace WeChat backend configuration.

Privacy concerns actual personal identity and location data. Language, festivals, fonts, and map providers are product/technical choices, not evidence of the user's location. Public moments display recorded addresses/coordinates, and uploads do not currently have a universal EXIF-removal step. These are existing data boundaries, not new feature-change requests.

Physical devices, native photo/camera selection, production domains/TLS, WeChat privacy settings, and review/release require actual acceptance. Node and simulator results do not substitute for external confirmation. Update this document for product or permission changes and the technical specification for interface, architecture, or platform changes.
