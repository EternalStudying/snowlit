# Album editing, deletion and photo ordering

Status: agreed with the product owner on 2026-10-21 (decision log at the end). To be implemented by another agent and reviewed afterwards against this document.

## 1. Problem

Once published, an album can't be changed by anyone. No layer supports it: the backend only has list, detail, unlock, like and view, the web only deletes draft images, and the mini program only creates albums. A wrong title, a missed photo, a photo that shouldn't be there or a mistaken private password can only be fixed in the database. Photos also can't be reordered, even while an album is being created, so the cover is whatever was uploaded first.

## 2. Solution in one paragraph

Managers can edit and delete any published album, on the web and in the mini program. Editing reuses the creation screens in an edit mode. The title, description, date, location, visibility (with the private password) and pinned can all change. Photos can be added, removed and reordered, and the first photo is always the cover. New photos upload as soon as they are picked, into an **edit draft**: a row in the existing `drafts` table, under an internal kind, that is never offered for resuming. One 保存 applies everything in one transaction, after which removed photos' files are deleted from storage. Deleting an album removes its rows and then its files. Reordering is drag-and-drop on both clients: SortableJS on the web, and a new shared WXS component in the mini program. The same reordering also works while creating an album. There is no schema change.

## 3. Before you start

- Read the root `AGENTS.md`, `task_plan.md`, `GLOSSARY.md`, then `backend/findings.md`, `frontend/findings.md`, `miniprogram/product-spec.md`, `miniprogram/technical-spec.md`, and the drafts spec `docs/specs/2026-10-20-drafts.md`. Its draft module is what this builds on.
- Start from a clean `main`. If `git status` shows uncommitted work, ask the owner before starting.
- Constraints that always apply:
  - Never push.
  - Verify against throwaway MySQL/Redis/MinIO containers, never the developer's own `mysql`, `redis` or `minio` containers.
  - Use `SQL_INIT_MODE=never` with retained data.
  - Do not copy real secrets or coordinates into code, tests or docs.
  - Temporary scripts and screenshots go under `codex-work/`.
  - Do not install `@playwright/cli`.
  - Never use `sed -i` on mini-program files while WeChat DevTools is open: its temporary file breaks the WXSS compile.
- **No database change.** Do not add tables or columns, and do not run anything against the developer's or production databases. The only `schema.sql` edit allowed is the comment on `drafts.kind` (§5).
- Work on a branch `feature/album-edit`. Commit in reviewable steps (backend, web, mini program, docs), with tests passing at each step.

## 4. Vocabulary

Add to `GLOSSARY.md`, under **Draft**:

> **Edit draft**:
> The photos a manager has uploaded while editing a published album, held on the server until they save or cancel; at most one per member, never offered for resuming. Saving moves the used photos into the album.
> _Avoid_: staging area, edit session, temp upload

> **Album cover**:
> The album's first photo. Choosing a cover moves that photo to the front; there is no separate cover setting.

Use `editDraft` / `EditDraft` in code. Use `photoId` for a published photo and `draftImageId` for an uploaded, unsaved one.

## 5. Data model

There are no new tables or columns.

- **The edit draft** is a `drafts` row with `kind = 'album_edit'`, `fields_json = {"albumId": <id>}`, and `images_json` in exactly the format album draft images use (`DraftImage`, including `original`). The unique key `(user_id, kind)` already enforces one per member. Update the column comment in `schema.sql` to `'草稿类型：album、diary、moment 或 album_edit（编辑相册时的新照片，不对外开放）'`. Do not `ALTER` anything; a comment-only difference on an existing database is acceptable.
- **The album cover** stays `albums.cover_photo_url`. Every write that changes the photo list or its order sets it to the first photo's `preview_url`.
- **Photo order** stays `photos.sort_order`, rewritten as 1…n on every save.
- **Pinned** keeps the existing pair: `pinned = true` with `sort_order = 10`, `pinned = false` with `sort_order = 100`.
- **Private access revocation**: tokens in Redis are random keys, so they can't be found by album. Tie each token to the password instead (§6.5).

## 6. Backend

### 6.1 Modules and authorization

- **`DraftKind`**:
  - Add `ALBUM_EDIT`, stored as `album_edit`.
  - `fromPath` must not resolve it: `/api/drafts/album_edit` and `/api/drafts/album-edit` return 404 `DRAFT_KIND_INVALID`.
  - The existing `upload`, `limit` and `cleanup` code in `DraftModule` is reused, not copied. Factor the album branch of `upload` into a method both paths call.
- **New `AlbumEditor`** (`xyz.snowlit.album`) owns:
  - the edit flow (start, upload, remove, cancel and save);
  - album deletion.
  - It calls `DraftModule` for edit-draft rows and images, and `AlbumMapper` for album writes. `AlbumPublisher` stays creation-only.
  - If a dependency cycle appears (`DraftModule` already depends on `AlbumModule`), break it by moving the edit-draft operations into a small `EditDrafts` class in the draft package that both can use. Do not use `@Lazy`.
- **Authorization:** every endpoint below calls `actor.requireManager("ALBUM_FORBIDDEN", "只有站点主人可以管理相册")` first. Any manager can edit or delete any album, whoever created it.
- **Private albums:** a manager does not need a private access token to edit or delete them. They can already change the password, so a token would protect nothing.
- **Published only:** only `status = 'published'` albums can be edited or deleted. For any other album, return 404 `ALBUM_NOT_FOUND`.

### 6.2 API

All endpoints sit under `/api/albums/{albumId}` in `AlbumController`. Object names never appear in any response.

| Method & path | Does | Response |
| --- | --- | --- |
| `POST /edit` | Starts editing. If the member already has an edit draft, for this album or another, it is deleted and its images are cleaned up after commit. Then a new edit draft is created for this album. | `AlbumEditVo` (below) |
| `POST /edit/photos` | Uploads one new photo into the member's edit draft. The multipart shape is exactly the album draft upload's: `file` (mobile) **or** `original` + `preview` (web), plus `metadata` JSON (`caption`, `takenAt`, `location`, `width`, `height`). | `DraftImageVo` |
| `DELETE /edit/photos/{draftImageId}` | Removes an unsaved photo, with storage cleaned up after commit. | 204 |
| `DELETE /edit` | Cancels: deletes the member's edit draft and its images. Succeeds with 204 even if the album was deleted meanwhile or no edit draft exists. | 204 |
| `PUT /` | Saves (§6.3). | `AlbumDetailVo` with `canManage = true` |
| `DELETE /` | Deletes the album (§6.4). | 204 |

**`AlbumEditVo`:**
```json
{
  "album": { "id": 1, "title": "…", "description": "…", "eventDate": "2026-05-02", "location": "…",
             "visibility": "private", "hasPassword": true, "pinned": false },
  "photos": [ { "id": 11, "previewUrl": "…", "originalUrl": "…", "caption": "…", "takenAt": "2026-05-02",
                "location": "…", "width": 4000, "height": 3000, "sortOrder": 1 } ]
}
```
`photos` uses the existing `AlbumPhotoVo`, in order. The password and its hash are never returned. The `hasPassword` flag only lets the client say "留空则保持原密码".

**Upload rules:**
- The edit draft must exist and its `albumId` must equal the path's `albumId`. Otherwise return 409 `ALBUM_EDIT_EXPIRED` "编辑已失效，请重新打开相册编辑". This covers the member starting an edit elsewhere meanwhile.
- The album must still exist, or the request returns 404 `ALBUM_NOT_FOUND`.
- The 50-photo limit counts the album's current photos plus the edit draft's images, and returns `ALBUM_PHOTO_LIMIT_EXCEEDED`. This is a fast early check; saving checks again.

**Add `canManage` to `AlbumDetailVo`** (`actor.manager()`). `GET /api/albums/{albumId}` returns it, so the clients can show the edit and delete actions. The web and mini-program models gain the field.

### 6.3 Save: `PUT /api/albums/{albumId}`

**Request:**
```json
{
  "title": "…", "description": "…", "eventDate": "2026-05-02", "location": "…",
  "visibility": "public | private", "privatePassword": "optional", "pinned": true,
  "photos": [ { "photoId": 11 }, { "draftImageId": "uuid" }, { "photoId": 12 } ]
}
```

**In one transaction, in this order:**
1. **Lock the album:** `select … for update` on `albums`. A missing or unpublished album returns 404 `ALBUM_NOT_FOUND`; the clients show "相册已被删除".
2. **Validate the fields** with the same rules and error codes as `AlbumPublisher.create`: title required (at most 120), description (at most 500), eventDate required, location (at most 120), visibility in public or private. Pull the shared checks into one method both use; don't duplicate them.
3. **Password:**
   - `private` with a non-blank password: store a new hash.
   - `private`, blank, album already private: keep the hash.
   - `private`, blank, album currently public: 400 `ALBUM_PRIVATE_PASSWORD_REQUIRED`.
   - `public`: set the hash to null and ignore any password sent.
   - **Whenever the hash changes or is cleared**, also delete the album's `album_locks` rows, so failure counters start fresh against the new password.
4. **Photos:**
   - The list must not be empty: 400 `ALBUM_PHOTO_REQUIRED` "相册至少保留 1 张照片".
   - At most 50: `ALBUM_PHOTO_LIMIT_EXCEEDED`.
   - Exactly one of `photoId` or `draftImageId` per entry, no duplicates: 400 `ALBUM_PHOTOS_INVALID` "照片列表不正确".
   - Every `photoId` must belong to this album; otherwise `ALBUM_PHOTOS_INVALID`.
   - If any `draftImageId` is sent, lock the member's edit draft. It must exist for this album (else 409 `ALBUM_EDIT_EXPIRED`), and every id must be among its images (else `ALBUM_PHOTOS_INVALID`).
5. **Write:**
   - Update the album's title, description, date, location, visibility, password hash, pinned and the matching `sort_order`.
   - Delete the album's photos that are missing from the list.
   - Insert each used draft image as a photo, built the way `DraftModule.albumPhoto` builds one. Use the same defaults as creation: `takenAt` falls back to the album's eventDate, an empty caption becomes "未命名照片", and the description is empty.
   - Set every photo's `sort_order` to its 1-based position in the list.
   - Set `cover_photo_url` to the first photo's `preview_url`.
   - Leave `created_at`, `published_at`, `author_name`, `created_by_user_id`, `view_count` and `like_count` unchanged.
6. **Delete the edit draft row** if one was used. If none was used, delete any edit draft this member holds for this album.
7. **After commit, clean up storage:**
   - delete the original and preview objects of every removed photo, skipping null object names (older seed photos);
   - delete the objects of every edit-draft image that was not used.
   - Use the same best-effort deletion as drafts.

The last save wins: there is no version check. Any failure in steps 1–5 rolls back everything, leaving the album, the edit draft and storage untouched.

### 6.4 Delete: `DELETE /api/albums/{albumId}`

1. In a transaction, lock and load the album (404 `ALBUM_NOT_FOUND` if it's missing or unpublished), read its photos' object names, then delete the album row. Its `photos`, `album_activity` and `album_locks` rows cascade.
2. After commit, delete every photo's original and preview objects, skipping null names.
3. Another manager's edit draft for this album is left alone. Their next upload or save returns 404 `ALBUM_NOT_FOUND`. Their cancel still succeeds, and their next `POST /edit` cleans the draft up.

Delete only takes a confirmed click from the clients. The server has no extra confirmation step.

### 6.5 Private access revocation

Changing or clearing the password ends every existing unlock for that album.

- **Change `AlbumPrivateAccessTokenStore`:** `create(albumId, userId, passwordStamp, ttl, expiresAt)` stores the stamp in the Redis value, and `validate(token, albumId, userId, passwordStamp)` returns `INVALID` when the stamp differs.
- **The stamp:** the first 16 hex characters of SHA-256 over the album's current `private_password_hash`. Each new hash has a fresh salt, so every password change, even back to the same password, gives a new stamp.
- **Wiring:** `AlbumPrivateAccess` computes the stamp from the album it already loads, in both `unlock` and `require`.
- **Existing tokens:** tokens issued before this change have no stamp, so they become `INVALID`. Members unlock once more, and their next request shows the existing "请重新输入密码" message. Record this in the rollout notes; it's accepted.
- **Public albums** never check tokens, so switching to public needs no extra step.

### 6.6 Creation: ordering draft photos

- **Reorder endpoint:** add `PUT /api/drafts/album/images/order` with body `{"ids": ["uuid", …]}`.
  - Under the draft row lock, the listed images go first in the given order and any images not listed keep their relative order after them. That way a photo uploaded at the same moment is never lost.
  - Unknown ids are ignored.
  - It returns the full `DraftVo`.
  - It works only for `album`; other kinds return 404 `DRAFT_KIND_INVALID`.
- **Publish:** `POST /api/drafts/album/publish` accepts an optional `imageOrder` (the same ids array) and applies the same rule inside its transaction before creating the album. The client sends its final order there, so a reorder made just before publishing can't be lost.
- `AlbumPublisher.create` already uses list order for `sort_order` and the cover. Don't change it.

### 6.7 Errors

| Code | HTTP | Message | When |
| --- | --- | --- | --- |
| `ALBUM_FORBIDDEN` | 403 | 只有站点主人可以管理相册 | Not a manager |
| `ALBUM_NOT_FOUND` | 404 | 相册不存在 | Album missing, unpublished or deleted |
| `ALBUM_EDIT_EXPIRED` | 409 | 编辑已失效，请重新打开相册编辑 | No edit draft for this album |
| `ALBUM_PHOTOS_INVALID` | 400 | 照片列表不正确 | Bad, foreign or duplicate photo entries |
| `ALBUM_PHOTO_REQUIRED` | 400 | 相册至少保留 1 张照片 | Empty photo list on save |
| `ALBUM_PHOTO_LIMIT_EXCEEDED` | 400 | 每本相册最多 50 张照片 | More than 50 |
| Existing field codes | 400 | (unchanged) | Title, date, visibility or password |

## 7. Web client (`frontend/src/modules/album/`)

- **Dependency:** add `sortablejs` and `@types/sortablejs`. It solves drag-to-reorder for both mouse and touch, which the browser's built-in drag-and-drop doesn't do on phones. Use it only in the album dialog's photo list, and destroy the instance when the dialog closes.
- **Gateway and ports:**
  - Add `startEdit(albumId)`, `uploadEditPhoto(albumId, original, preview, metadata)`, `removeEditPhoto(albumId, draftImageId)`, `cancelEdit(albumId)`, `saveAlbum(albumId, payload)`, `deleteAlbum(albumId)` and `reorderDraftPhotos(ids)`.
  - `publishDraft` gains `imageOrder`.
  - Models gain `canManage` on the detail and `hasPassword` on the edit album.
- **Photo list (creation and editing):**
  - Replace the caption-only `album-upload-list` with a thumbnail grid in display order.
  - Drag a thumbnail to reorder; the first one carries a "封面" badge.
  - Each thumbnail has 设为封面 (moves it to the front; hidden on the first) and 移除.
  - In creation, every reorder calls `reorderDraftPhotos` straight away, and publish sends `imageOrder`.
  - In editing, the order lives only in the page until 保存.
- **Entry points:**
  - `AlbumImmersiveGallery` shows 编辑 and 删除 buttons in its header when the detail's `canManage` is true. It emits `edit` and `delete`; it doesn't own the logic.
  - There are no actions in the catalog list.
- **Edit mode of the create dialog:**
  - **Opening:** the title reads "编辑相册" and the dialog calls `startEdit`, then fills the form and the photo grid.
  - **Password field:** empty, with the placeholder "留空则保持原密码" when `hasPassword` is true.
  - **Pickers:** pick and drop work as in creation, but go to `uploadEditPhoto`, through the same upload queue and WebP preview path.
  - **保存:**
    - waits for uploads;
    - sends `saveAlbum` with the photo list built from the grid (`photoId` for existing photos, `draftImageId` for new ones);
    - on success, closes the dialog, refreshes the open gallery and the catalog from the response, and clears the stored private access token for this album if the visibility or password changed.
  - **Closing with changes:** asks "放弃修改？". On confirm, calls `cancelEdit` and closes. Closing without changes also calls `cancelEdit`.
  - **Leaving the page:** `beforeunload` fires a best-effort `cancelEdit` with `keepalive`.
  - **No drafts and no autosave in edit mode.** The creation draft is not touched while editing.
- **Delete:**
  - A confirm (`NModal`, following existing modal usage) shows "删除「{title}」？其中 {n} 张照片会一起删除，无法恢复。".
  - On confirm it calls `deleteAlbum`, closes the gallery, and removes the album from the catalog.
  - A 404 shows "相册已被删除" and also removes the album from the catalog.
- **Errors** show through the existing notice/alert patterns; `ALBUM_EDIT_EXPIRED` asks the member to reopen editing.

## 8. Mini program (`miniprogram/`)

### 8.1 Services

- **`services/album.js`** adds `startAlbumEdit`, `uploadAlbumEditPhoto` (through the shared upload wrapper, field `file`), `removeAlbumEditPhoto`, `cancelAlbumEdit`, `saveAlbum` and `deleteAlbum`.
- **`services/draft.js`** adds `reorderDraftImages(kind, ids)`, and `publishDraft` passes `imageOrder` through `extra`.
- Pages never build the URLs themselves.

### 8.2 `components/snowlit-sortable-grid` (new, shared)

A reusable photo grid with long-press drag reordering.

- **Properties:**
  - `items`: an array of `{ key, src, badge, message, progress }`;
  - `columns` (default 3);
  - `disabled`.
- **Events:**
  - `reorder` with `{ from, to }`, emitted once on drop when the position changed;
  - `itemtap` with `{ index }`.
- **Gesture:**
  - A long-press of about 350 ms lifts the item: slight scale and shadow.
  - It follows the finger while the other items slide into their new slots.
  - Release drops it.
  - A move before the long-press fires is a normal page scroll.
  - Implement the touch tracking in WXS (`.wxs` module with `touchmove` bound through WXS) so it doesn't round-trip through `setData` on each move. The JS side only learns the final `from`/`to`.
- **Auto-scroll:** while dragging within about 80 rpx of the visible top or bottom edge, scroll the page with `wx.pageScrollTo` in small steps, and stop at the ends.
- **Layout:** measure item positions with `createSelectorQuery` when the drag starts. The grid must not jump when an item lifts: it keeps its slot as a placeholder.
- **Order logic:** put the index arithmetic (target slot from coordinates, moving an item in an array) in plain functions in `components/snowlit-sortable-grid/sortable-order.js`, so it can be unit-tested.
- Only album creation and editing use it in this change. The moment and diary pages stay as they are.

### 8.3 `pages/album-edit`

- **Both modes:**
  - The photo section uses `snowlit-sortable-grid`; the first item shows a "封面" badge.
  - Tapping a photo opens a `snowlit-option-sheet` with 预览, 设为封面 (hidden for the first) and 删除. 预览 keeps the existing photo preview that the tap used to open.
  - The separate × remove button goes.
- **Creation mode** (no `albumId` option):
  - Unchanged draft flow.
  - After each reorder, call `reorderDraftImages('album', uploadedIdsInOrder)`.
  - `publishDraft` sends `imageOrder`. Photos still uploading keep their place in the grid and are included once uploaded.
- **Edit mode** (`?albumId=…`, from album detail):
  - **Load:**
    - Don't call `loadDraft` and don't start autosave.
    - Call `startAlbumEdit`, fill the form, and mark the date and location as already settled, so photo EXIF never changes them.
    - Existing photos enter the grid as uploaded items holding `photoId`.
    - The page title is "编辑相册" and the button is "保存".
  - **Password field:** shows when the visibility is private, with the placeholder "留空则保持原密码" when `hasPassword` is true. It's required only when switching from public to private.
  - **New photos:** go through the same pick → EXIF → compress → upload pipeline into `uploadAlbumEditPhoto`, and each one keeps its own `takenAt` and location.
  - **Removing photos:**
    - removing an existing photo only takes it off the grid;
    - removing a new photo also calls `removeAlbumEditPhoto`;
    - the last photo can't be removed: show "相册至少保留 1 张照片".
  - **保存:**
    - waits for uploads;
    - sends `saveAlbum` with the grid order;
    - on success, refreshes the album detail, album list and Home pages that are open (extend `refreshAlbumPages`), then goes back.
    - `ALBUM_NOT_FOUND` shows "相册已被删除" and goes back to the albums list.
    - `ALBUM_EDIT_EXPIRED` shows its message and stays.
  - **Leaving:**
    - Once anything changes, call `wx.enableAlertBeforeUnload({ message: '放弃修改？' })`, and `wx.disableAlertBeforeUnload` after saving.
    - `onUnload` without a save calls `cancelAlbumEdit`, best-effort, and lets queued uploads finish first.
  - **Account change:** a session change clears the page, the same way creation does.
- Move the mode differences into `album-edit-presenter.js` functions where they are pure: building the photo list and the save payload, and the password rule. Keep the page thin.

### 8.4 `pages/album-detail`

- When `album.canManage` is true, add an action area at the end with "编辑相册" and "删除", matching the diary detail's `detail-actions`.
- **编辑相册** opens `album-edit?albumId=…`. On returning, `onShow` reloads the detail if the edit page marked it changed.
- **删除** uses `showConfirm`: title "删除相册", content "确定删除「{title}」吗？其中 {n} 张照片会一起删除，无法恢复。", confirm text "删除".
  - While deleting, the label reads "删除中…" and taps are ignored.
  - On success, refresh the album list and Home, then go back.
  - A 404 is treated as already deleted.
- A detail load that returns 404 shows "相册不存在" with a back action.

### 8.5 Docs to update

- `miniprogram/product-spec.md`:
  - **Identity table:** managers can now edit and delete albums.
  - **Albums section:** add editing, deletion, drag reordering and the first-photo cover.
  - **Creation Drafts:** note that edit mode has no drafts.
- `miniprogram/technical-spec.md`: the new services, the sortable grid component (WXS), and `enableAlertBeforeUnload`.
- `backend/findings.md`: the new endpoints, the edit draft kind and the token stamp.
- `frontend/findings.md`: the SortableJS dependency and the edit mode.
- Add a short entry to `task_plan.md`.

## 9. Rolling out (not your task; for context)

The reviewer handles rollout with the owner's go-ahead. There is no schema change. Deploying the backend makes existing private access tokens invalid once (§6.5), so members re-enter private album passwords. The production mini program needs a new package upload for the client changes.

## 10. Tests you must add

Each must fail on the old code where that applies.

**Backend** (`AlbumEditorTests`, plus additions to `DraftModuleTests`, `AlbumPrivateAccessTests`, and MVC tests for authorization and routing):
- non-managers get 403 on every new endpoint; a manager who didn't create the album can edit and delete it;
- a private album can be started and saved without a token;
- `POST /edit` replaces an earlier edit draft, for the same or another album, and cleans up that draft's objects after commit;
- uploads to an edit draft for another album return `ALBUM_EDIT_EXPIRED`;
- the 50-photo limit counts existing plus new photos, on upload and on save;
- save:
  - the fields update;
  - pinned toggles `sort_order` between 10 and 100;
  - removed photos' rows go and their objects are deleted only after commit, with null names skipped;
  - new photos are inserted in order;
  - `sort_order` runs 1…n;
  - the cover equals the first preview;
  - counts and timestamps are unchanged;
- a save that fails validation changes nothing: album, photos, edit draft and storage all intact;
- an empty list, a foreign photo id, a duplicate or an unknown `draftImageId` is rejected with the right code;
- password: a blank password keeps the hash; private→public clears it; public→private without a password fails; changing it deletes `album_locks` rows;
- after a password change, an old access token is `INVALID`; a new unlock works;
- delete: the row and its cascades go, objects are deleted after commit, and a second delete returns 404;
- saving after another manager deleted the album returns 404, and that member's cancel returns 204;
- `/api/drafts/album_edit` returns 404 `DRAFT_KIND_INVALID`;
- draft order: listed images first, unlisted ones keep their order after them, unknown ids are ignored; `imageOrder` on publish decides photo order and the cover;
- `AlbumDetailVo.canManage` is true for managers and false otherwise.

**Real MySQL smoke** (extend `codex-work/drafts/smoke-drafts-api.py` or add a new script under `codex-work/`, against throwaway containers):
- edit, upload, reorder, save; then check the database order and the cover;
- concurrent saves from both managers leave one consistent album;
- delete removes the MinIO objects;
- object names never appear in any response.

**Web** (Vitest):
- the gateway paths and bodies for every new call;
- edit mode fills the form and sends `photoId`/`draftImageId` in grid order;
- a blank password is omitted;
- discarding changes calls `cancelEdit`;
- the delete confirm, then removal from the catalog;
- 设为封面 moves a photo to the front;
- creation reorder calls `reorderDraftPhotos`, and publish sends `imageOrder`;
- the gallery shows 编辑 and 删除 only when `canManage` is true.

**Mini program** (`node --test`, in all four timezones as today):
- `sortable-order.js`: slot from coordinates, moving an item in an array, and edge cases (first, last, same slot, one column);
- the presenter: save payload, password rule and last-photo rule;
- the edit page:
  - starts editing and doesn't touch drafts;
  - EXIF never overwrites the date or place;
  - saving sends the grid order;
  - `ALBUM_NOT_FOUND` goes back to the list;
  - unloading without a save cancels;
- creation reorder calls `reorderDraftImages`, and publish sends `imageOrder`;
- album detail shows its actions only for `canManage`, and deleting refreshes and goes back;
- `fonts.test.js` still passes. Rerun `tools/miniprogram-fonts/build_fonts.py` if a new `snowlit-kai` heading is added.
- Check the grid gesture in WeChat DevTools: long-press, drag across rows, auto-scroll with 30 or more photos, and a quick scroll that doesn't lift. Put screenshots in `codex-work/album-edit/`. Say plainly that real devices were not checked.

## 11. Out of scope

- Editing each photo's caption, date or place.
- A trash or undo for deleted albums.
- Edit or delete in the album lists.
- Conflict warnings when two managers edit at once.
- Resuming an interrupted edit.
- Drag reordering for moment or diary images.
- Changing who counts as a manager.
- Any schema change.

## 12. How the review will check this

The reviewer will diff the branch against `main` and check:
- every section above, in particular:
  - all-or-nothing saves (§6.3);
  - storage deleted only after commit (§6.3, §6.4);
  - manager-only access and the private-album bypass (§6.1);
  - token revocation (§6.5);
  - unlisted draft images surviving a reorder (§6.6);
  - no `album_edit` access through the drafts API;
- that the tests in §10 exist, fail without the change where applicable, and pass;
- that the docs in §8.5 are updated;
- that no defensive code was added for states that can't happen.

Report what you could not verify (devices, production) instead of implying it was checked.

## Decision log (2026-10-21, from the requirements interview)

1. Either manager can edit and delete any album.
2. Deleting is permanent, after a confirmation that names the photo count.
3. Stored photo files are deleted after the database delete succeeds; photos with no recorded storage path are skipped.
4. Editable fields: title, description, event date, location, visibility (with password) and pinned.
5. Photos can be added, removed and reordered, and the cover chosen. Editing each photo's caption, date or place is out of scope.
6. Password: switching to private needs one; blank keeps the current one; a new one replaces it; switching to public clears it; any change ends existing unlocks.
7. Managers get 编辑 and 删除 on the mini-program album detail page and in the web album view, not in lists.
8. Concurrent edits: the last save wins; a save to an album deleted meanwhile shows "相册已被删除".
9. Editing reuses the creation screens in an edit mode, with no drafts.
10. One 保存 applies everything at once; leaving with changes asks "放弃修改？".
11. New photos upload when picked into an edit draft; saving moves them into the album, cancelling deletes them, and leftovers are cleared at the next edit start.
12. Removed photos' files are deleted only after the save succeeds.
13. At most 50 photos counting new ones; at least one must remain.
14. The cover is always the first photo; "设为封面" moves a photo to the front.
15. Reordering is drag-and-drop on both clients. In the mini program, tapping a photo opens 设为封面 and 删除 (plus 预览, which keeps the existing preview).
16. Added photos keep their own EXIF date and place; the album's date and place never change automatically while editing.
17. Editing keeps the creation and publish times, author, counts and existing photos' files.
18. After deleting, go back to the list and refresh Home; a deleted album shows "相册不存在".
19. Process: this spec, then GPT-6.1 SOL implements it on a branch, then a review.
20. The web uses SortableJS, the only new dependency.
21. The mini-program drag grid is a shared component, `snowlit-sortable-grid`.
22. Album creation gets the same reordering and first-photo cover on both clients.
23. The edit draft reuses the `drafts` table under the internal kind `album_edit`; no schema change.
