# Drafts Implementation Report — 2026-10-20

Branch: `feature/drafts`, created from local `main`. No push, retained-container access, service restart, database initialization or retained-data migration was performed. The source specification `docs/specs/2026-10-20-drafts.md` remains untracked and is excluded from every implementation commit.

## Commit Receipts

| Commit | Change |
|---|---|
| `a77d8e8` | Backend draft table/module/API, publication seams and old album endpoint removal; 299 tests passed |
| `2f17921` | Web album gateway, explicit draft lifecycle and recovery; 449 tests/typecheck/build passed |
| `9af661f` | Explicit legacy unpublished-album detail/like/view rejection test; backend 300 tests passed |
| `b096289` | Owner-confirmed 50-photo limit, Web date completion and preservation of the saved pinned flag; backend 301/Web 450 tests passed |
| `f8f15bd` | Native draft service/shared autosave, three creation pages, immediate uploads and exact diary image removal; four timezones each 176 tests and 133 JS syntax checks passed |
| `6363c89` | Diary deletion/unload regression fix, immediate flush and final cleaned snapshot; four timezones each 180 tests passed |

The final documentation commit contains this report, glossary and updated context; its hash is included in the final task receipt.

## Clarifications and Differences From the Original Specification

All four points were raised with the owner instead of silently choosing a product rule:

1. **TEXT is byte-limited:** keep the specified diary limit of 60,000 characters and unchanged existing table structure; additionally reject text values or complete serialized fields_json above 65,535 UTF-8 bytes with DRAFT_FIELDS_INVALID. JSON escaping counts toward that serialized limit.
2. **Missing photo dates:** takenAt may remain absent in a draft. At publish, use the album eventDate to satisfy the unchanged non-null photos.taken_at column.
3. **Different client caps:** the original specification used backend/Web 300 and mini program 9. The owner replaced this with **50 photos everywhere**. Native picking remains at most nine each call across batches. Older over-cap drafts retain all images, refuse additions and allow removal; publication rejects them until reduced to the new cap. Published historical albums are not rewritten.
4. **Web drafts without an album date:** Web recovery defaults a missing eventDate to the client-local calendar date and exposes an editable date input, as selected by the owner.

No other product-scope deviation is intended. HTML image removal, serialized save/publish ordering, token-change handling and preserving hidden pinned state are implementation repairs needed by the specified behavior. No dependency was added. The decision log/source specification was not edited or committed.

## Status by Specification Section

| Section | Status | Evidence or boundary |
|---|---|---|
| 1. Problem | Done | Server recovery replaces loss of creation state |
| 2. Solution | Done | One member/kind draft, native autosave and Web album sharing |
| 3. Before starting | Done | Required context read, initial tree clean except source spec, branch from main, prior media changes preserved |
| 4. Vocabulary | Done | Draft and Draft image replace Draft album in GLOSSARY.md |
| 5. Data model | Done with approved clarifications | New drafts table after moments; all 16 existing table definitions unchanged; strict fields and server-owned image JSON |
| 6. Backend | Done with approved cap/date/byte rules | Actor/kind ownership, row-locked image mutations, fields-only replacement, transactional publication, post-commit cleanup and removal of old album endpoints |
| 7. Web | Done with approved date/cap rules | New paths/payloads; explicit save, recovery, retry, image removal, publish/password and discard; no Web autosave |
| 8. Mini program | Done with approved cap | One service/helper; all three new-entry pages; EXIF/place preserved; edit APIs unchanged; product/technical docs updated |
| 9. Existing-database rollout | Not done, explicitly out of scope | Reviewer must obtain approval, back up, create table once and convert legacy album drafts |
| 10. Tests | Partly done | Backend/Web/native required automated checks pass; simulator block explicitly skipped |
| 11. Scope boundaries | Done | No wish/profile/feedback drafts, editing drafts, expiry, multiple drafts, Web diary/moment drafts or migration tool |
| 12. Review checks | Done for implementation handoff | Source/test/context audit and this traceability record; independent reviewer acceptance is not claimed |

## Exact Final Verification Commands

Commands use existing local dependencies. Backend tests run on the host so Mockito can attach to the JVM; all business collaborators are mocks/fakes, with no external database/cache/object store. Temporary logs/scripts are in ignored `codex-work/drafts/`.

| Directory | Command | Final result |
|---|---|---|
| backend/ | `mvn -o test` | 301 passed; 0 failures/errors/skips |
| frontend/ | `npx vitest run` | 70 files, 450 passed; 0 failed |
| frontend/ | `npx vue-tsc -b` | Exit 0, no diagnostics |
| frontend/ | `npm run build` | Exit 0; existing large-chunk warning remains |
| repository root | `node --test miniprogram/tests/*.test.js` | 180 passed; 0 failed/cancelled/skipped |
| repository root | `TZ=America/Los_Angeles node --test miniprogram/tests/*.test.js` | 180 passed; 0 failed/cancelled/skipped |
| repository root | `TZ=Asia/Singapore node --test miniprogram/tests/*.test.js` | 180 passed; 0 failed/cancelled/skipped |
| repository root | `TZ=UTC node --test miniprogram/tests/*.test.js` | 180 passed; 0 failed/cancelled/skipped |
| repository root | `python3 codex-work/drafts/check-mini-js.py` | Runs `node --check <path>` on every mini-program JS: 133 passed, 0 failed |
| repository root | `git diff --check` | No whitespace errors |

Additional earlier command: `mvn -o -DskipTests compile` in backend/ passed. Static schema audit compared complete table definitions against main: 16/16 unchanged; only drafts added. Production Java contains no retired AlbumDrafts/AlbumDraftVo/AlbumCurrentDraftVo/findLatestDraftByUserId/ALBUM_DRAFT_EXISTS symbols.

Final logs: [backend](../codex-work/drafts/backend-cap-tests.log), [Web tests](../codex-work/drafts/web-cap-vitest.log), [Web build](../codex-work/drafts/web-cap-build.log), [native default](../codex-work/drafts/mini-default.log), [Los Angeles](../codex-work/drafts/mini-los-angeles.log), [Singapore](../codex-work/drafts/mini-singapore.log), [UTC](../codex-work/drafts/mini-utc.log), [JS syntax](../codex-work/drafts/mini-js-check.log). These are local ignored evidence, not committed artifacts.

## Failed Runs and Repairs

Failures are recorded rather than represented as successful checks. Endpoint/shape/timing expectations were migrated only where the specification changed the contract; state-preservation and EXIF/race assertions remain covered.

### Backend

- First two `mvn -o test` attempts stopped before running tests: stale AlbumCurrentDraftVo import and incorrect DiarySummaryVo accessor. Corrected test references to the removed/new contract.
- Next full run: **299 total, 297 passed, 1 failure, 1 error**. The failure output was:

```text
Wanted but not invoked:
diaryMapper.insertImageReferences(...)
```

The Mockito mapper intercepted its default replaceImageReferences method. Enabled the real default method; retained the insertion/reference assertion.

```text
No qualifying bean of type 'org.springframework.transaction.PlatformTransactionManager'
expected single matching bean but found 2
```

The generic wiring fixture registered a second transaction manager alongside its existing bean. Reused that existing bean. Following runs passed 299, then 300 after negative album-access coverage, then 301 after the approved cap edge test. See [the failing output](../codex-work/drafts/backend-tests-3.log).

### Web

Full `npx vitest run` iterations: **433 passed/12 failed**, then **442/5**, then **444/3**, then two complete **449/0** runs and the final **450/0** run after owner clarifications.

Representative output:

```text
AssertionError: expected false to be true // Object.is equality
ReferenceError: init is not defined
```

Old endpoint/response fixtures caused upload and publish expectations to fail. Updated them to the specified API; an obsolete disabled-title assertion now checks that untitled drafts can be edited. Fixed the test-adapter variable typo. Gateway and lifecycle tests assert the new exact payloads, password exclusion/re-entry and image ids. The obsolete album-id-bound upload test now prevents an old batch from attaching to a replacement kind-scoped draft. Full outputs: [first](../codex-work/drafts/web-vitest-1.log), [second](../codex-work/drafts/web-vitest-2.log), [third](../codex-work/drafts/web-vitest-3.log).

`npx vue-tsc -b` first passed, then failed with `error TS2304: Cannot find name 'init'`, then passed after the same test-adapter fix. Final typecheck and builds also passed.

### Mini program

- First full run: **127 total, 114 passed, 13 failed**. Old album API/save-time-upload expectations and old response fixtures were incompatible with the new draft flow. Representative exact output: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: actual: 0, expected: 1`. Updated endpoint/timing fixtures while retaining manual-field, per-photo metadata, removed-photo and publish-wait semantics. Next run passed 127/127; additional coverage passed 153/153, 159/159, 162/162 and 165/165.
- Deletion iteration: **172 total, 169 passed, 3 failed**. Two retained EXIF race tests exposed delayed local-only removal after the new serialization flag; fixed local removal to remain synchronous. Example output: `actual: [], expected: [ 'wxfile://plain.jpg' ]`. The third new fixture expected an upstream 502 message, but the pre-existing request policy intentionally returns generic 5xx copy; corrected that fixture to the unchanged policy while retaining all text/image preservation assertions. Follow-up passed 172/172.
- Focused HTML-removal regressions first ran **4 total, 1 passed, 3 failed**. Exact example:

```text
actual: `Before<img src="https://media.example.com/draft/photo[1]+.jpg?size=small&v=2" alt="First" />middle<IMG class='photo' SRC='https://media.example.com/draft/photo[1]+.jpg?size=small&v=2'>After`
expected: 'BeforemiddleAfter'
```

Extended the presenter helper to remove exact matching Markdown and quoted HTML image references, preserving other URLs/text and rejecting data-src/srcset as src. The four assertions then passed unchanged. Exact focused commands from the repository root:

```sh
node --test miniprogram/tests/diary-draft-images.test.js > codex-work/drafts/mini-html-removal-red.log 2>&1
node --test miniprogram/tests/diary-draft-images.test.js > codex-work/drafts/mini-html-removal-green.log 2>&1
```

`git diff --check -- miniprogram` also passed. At that point full suites passed 176/176 in all four timezones; the exit regressions below extend the final suite to 180 tests.

The final diary exit review first reproduced one failure out of three controlled tests: a successful deferred DELETE after onUnload left saved content referencing the deleted image. Exact assertion output:

```text
AssertionError [ERR_ASSERTION]: a resumed draft must not reference the removed object
true !== false
```

The repair preserves a plain unloaded-only field snapshot and never writes unloaded UI. A strengthened immediate-flush assertion then exposed one failure out of four tests (`dirty fields flush immediately, before deletion finishes`, `0 !== 1`). The final implementation starts the field flush immediately, waits for pending deletion and the earlier save, then flushes the cleaned snapshot before stopping. Failed deletion preserves references; token changes prevent any new-member writes. All four assertions passed after the code repair, unchanged.

Exact focused command from repository root:

```sh
node --test --test-name-pattern='^diary exit:' miniprogram/tests/draft-pages.test.js
```

The final four complete timezone runs each passed 180/180, with 133/133 syntax checks. Exit evidence: [original red](../codex-work/drafts/mini-diary-exit-red.log), [immediate-flush red](../codex-work/drafts/mini-immediate-exit-red.log), [final green](../codex-work/drafts/mini-diary-exit-green.log).

Failure outputs: [initial native run](../codex-work/drafts/mini-first-test.log), [removal regression](../codex-work/drafts/mini-removal-test.log), [HTML red](../codex-work/drafts/mini-html-removal-red.log), [HTML green](../codex-work/drafts/mini-html-removal-green.log).

## Documentation Checks

All 14 changed/new context documents are English. A relative-link audit found 99 links and no missing targets; git diff --check and the planning completion check passed. The first language audit detected two historical quoted UI labels, which were replaced with descriptive English without changing their recorded meaning; its rerun passed.

## Not Verified or Performed

- Simulator acceptance was **skipped under the task's explicit option**. No disposable backend/containers were provisioned, and no simulator was connected to retained services.
- WXML/WXSS compilation, live browser acceptance, native photo/camera picking, physical devices, real MySQL transactions/concurrency, Redis/MinIO integration and production were not run for this feature. Unit/mocked checks do not establish those results.
- No retained database was inspected, initialized or given a drafts table. The reviewer rollout remains required before deploying this code against retained data. Never run the destructive whole schema.sql on a retained database.
- No production domain/TLS, WeChat permission/privacy-backend settings or release/review approval was verified. No new native permission API was introduced; the existing media disclosure identifies active image selection and upload.

## Review (2026-10-21)

Independent review of the branch against the specification. All reported numbers reproduced: backend 301, Web 450 plus typecheck and build, mini program 180 in four timezones, 133 syntax checks. The backend design (row-locked image changes, server-only object names, post-commit deletion, publish failures that keep the newest fields because every target validates before writing) matches the spec.

Fixed on this branch by the reviewer:

- **Queued uploads stopped when the page closed** (`75df8e4`). Photos still waiting in the queue were dropped on exit, the case drafts exist for. Only a member change stops uploads now. The album waits on a plain counter, not page data, so an upload queued behind photo reading cannot loop after unload. A diary upload that finishes after unload is written into the saved text before the final save. Handlers drop closed-page guards that could not fire. Four new tests fail on the previous page code.
- **Pinned albums sorted after older pinned ones** (`f461b82`). Publishing wrote sort order 100; pinned albums get 10 again. New test fails without the fix.
- **The Web sent an empty `eventDate`** when the date input was cleared, which the server rejects (`f461b82`). It now leaves the date out, as the mini program does.
- Album draft images always carry an original, so publishing drops the fallback for a missing one.

Verified against real MySQL 8.4 and Redis 7.4 (throwaway containers, `SQL_INIT_MODE=always`, local-disk storage, packaged jar on port 18080, started outside the repository so `config/local.properties` could not load): 34/34 HTTP checks in `codex-work/drafts/smoke-drafts-api.py`, including:
- concurrent first saves leaving one row;
- five parallel uploads all landing;
- object names absent from responses;
- member isolation;
- a failed publish keeping the newest fields;
- album, diary and moment publish;
- diary image promotion, and the same-date conflict keeping the draft;
- discard;
- the removed old endpoints;
- the unknown-kind error.

Stored files matched the database after image removal, diary publish and discard. Containers were stopped afterwards; the developer's own services were not touched.

After the fixes: backend 302, Web 451 plus typecheck and build, mini program 184 in four timezones.

Still not verified: simulator and devices (native picking, WXML/WXSS compilation), MinIO for draft objects, and the rollout on the retained database (table creation and conversion of old album drafts), which needs the owner's go-ahead and a backup.

