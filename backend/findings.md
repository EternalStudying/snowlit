# Backend Current Findings

## Architecture

Spring Boot, MyBatis, and MySQL form a monolith. The Maven compilation target is Java 17. The root Java package and Maven group are xyz.snowlit.

Ten vertical domains are album, auth, diary, feedback, home, messages, notices, story, weather, and wishes. web owns actor/authentication/HTTP concerns, failure defines ApplicationFailure, storage defines ObjectStore, and infrastructure implements external adapters. Do not restore retired packages or single-implementation service/Impl layers.

Modules with multiple constructors need an explicit Spring injection entry point. AlbumModule must remain transaction-proxy compatible; SpringModuleWiringTests covers application wiring.

## Authorization and Data Contracts

- [SiteManagerPolicy](src/main/java/xyz/snowlit/auth/SiteManagerPolicy.java) currently grants management to user IDs 1 and 2. Complete multi-couple tenant isolation is not implemented.
- Private diaries are author-readable; updates/deletes check authorship. Roles come from users.couple_role, not names. Messages can be deleted only by their author.
- Album draft operations check ownership. Wish complete/reopen currently requires authentication. Client visibility cannot replace backend authorization.
- WeChat login/binding reuses users, JWT, and Redis. Business tokens are returned; openid, session_key, and AppSecret are not returned to clients.
- Current fields include originalUrl/previewUrl, diary entryDate with date on creation, and feedback imageUrls. Contract changes require checking both clients.
- Story lists/details are public and include record-supplied address/coordinates. Home is authenticated. Image storage currently preserves uploaded bytes without centralized EXIF removal.

## Configuration and Runtime

- Dev defaults: port 8080, MySQL 127.0.0.1:3306/snowlit_dev, Redis 6379, and MinIO 9000. Actual configuration and environment variables remain authoritative.
- Dev SQL initialization defaults to always and can recreate/reseed tables. Prod defaults to never. Explicitly use never for retained data and perform migrations separately.
- The [local configuration example](config/local.properties.example) corresponds to ignored local.properties: mode 600, outside resources, imported only by dev from root/backend working directories. Environment variables take precedence.
- Database, Redis, and storage credentials use LOCAL_* or production variables. Never copy real keys into source, documentation, reports, or client bundles.
- Album likes/views use UTC calendar days; dev JDBC defaults to UTC. Existing activity dates are not recalculated. Other time fields retain their contracts.

## Global Location and Weather

Geoapify and Open-Meteo receive WGS84 coordinates only after WeatherGateway.Coordinates rounds them to two decimal places. Location is requested at city level. Missing country/city stays unknown; location and weather fail independently.

Complete results cache for 20 minutes, partial/failure results for 2 minutes, with about 2048 grid entries and same-grid request coalescing. Expiry uses Instant. Geoapify credentials remain backend-only; an Open-Meteo commercial key is optional.

HomeVo contains couple, dailyNote, personStatuses, distance, latest, and stats. Seed accounts are demo_a/demo_b with blank location; existing accounts, bindings, and actual content remain preserved.

## Verification Limits

Recorded results are in progress.md. Local code does not establish real-device behavior, production state, registration ownership, WeChat backend settings, or metadata in existing uploaded photos.
