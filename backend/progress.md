# Backend Progress Baseline

## Current State

2026-10-18: backend architecture refactor complete on branch `refactor/backend-deepening` (not merged, not pushed). See [findings](findings.md) for the resulting structure.

| Commit | Change |
|---|---|
| a728af7 | Removed defensive guards; shared `Text` helper; `REQUEST_BODY_INVALID`; diary writes transactional |
| 49423a7 | Couple role carried on the authenticated actor |
| a060336 | `ImageIntake` + `ImagePolicy` replace six image storage classes; local-disk object store adapter |
| deb0d52 | `AuthSessions` with opaque Redis tokens replaces JWT and RequestIdentity |
| 9d87159 | Required `@CurrentActor` is the only login rule; interceptor removed |
| 0c2245a | Atomic album like toggle and view counting |
| d50b52e | `@Autowired` on `ImageIntake`; wiring test covers it |

## Verification Run in This Task

- `mvn -o test`: 269 tests, 0 failures.
- New album activity SQL executed against a throwaway MySQL 8.4 container: like toggles on/off/on with correct `liked_at`; view insert/mark row counts return 1 only for the first view.
- Smoke run of the packaged jar against throwaway MySQL 8.4 (seeded with `SQL_INIT_MODE=always`) and Redis 7.4 containers, MinIO unset so the local-disk store was used. Passed: anonymous 401 bodies, login with an opaque 43-character token, home, extensionless PNG screenshot upload served from `/uploads`, GIF message upload and file removal on delete, diary image + private diary create/delete with file cleanup, `REQUEST_BODY_INVALID`, type rejection, like ×3, view ×2, logout (204, idempotent, 401 without token), public story list.
- The developer's own MySQL, Redis, and MinIO containers and retained data were not touched.

## Not Verified

- MinIO adapter against a real MinIO server (constructor and configuration selection are unit-tested only).
- Web and mini-program clients against the refactored backend; no client changes were required (neither decodes tokens nor depends on image error codes or 413 handling), but live flows were not rerun.
- Real devices, production domains/TLS, WeChat privacy settings, and production runtime state.

## Deployment Notes

- Deploying ends all existing sessions (old JWT tokens are not recognised); members sign in again.
- `JWT_SECRET` and `minio.*-prefix` settings are no longer read. Existing databases must use `SQL_INIT_MODE=never`; no schema change was made.
