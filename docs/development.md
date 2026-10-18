# Development Guide

This guide describes reproducible commands and configuration. Current observations and previous verification results are separated in [root progress](../progress.md); a documentation refresh does not establish fresh end-to-end acceptance.

## Directories and Prerequisites

| Directory | Responsibility | Dependency definition |
|---|---|---|
| frontend | Vue Web application | [package.json](../frontend/package.json), [package-lock.json](../frontend/package-lock.json) |
| backend | Spring Boot service | [pom.xml](../backend/pom.xml) |
| miniprogram | Native WeChat client | [technical specification](../miniprogram/technical-spec.md) |
| codex-work | Ignored temporary scripts, screenshots, logs, and reports | Not a permanent specification or a guaranteed checkout artifact |

The backend targets Java 17 and uses Maven. The Web client uses Node/npm. Current locally observed tool versions are recorded in root progress rather than treated as permanent requirements.

MySQL and Redis must be configured separately; MinIO is optional in development (uploads fall back to local disk when it is not fully configured). The repository does not contain a Compose definition. Conventional local ports are 3306, 6379, and 9000; a MinIO console may use 9001. A listening application port does not prove dependency health.

## Web Client

From the project root:

```sh
cd frontend
npm ci
npm run dev
```

Vite defaults to port 5173 and proxies /api to http://localhost:8080. The dev command opens a browser. Infrastructure containers do not start the Web client or backend automatically.

```sh
cd frontend
npm ls --all
npm test
npm run build
```

The build runs vue-tsc -b and Vite. There is no type-check npm script; use ./node_modules/.bin/vue-tsc -b when a separate type check is useful. npm ci preserves the lockfile. If the user cache is inaccessible, a project-local alternative is npm ci --cache ../codex-work/npm-cache.

Web story maps use VITE_AMAP_KEY and optionally VITE_AMAP_SECURITY_JS_CODE in ignored frontend/.env.local. Missing map configuration preserves the SDK fallback.

## Backend Configuration

Configure a suitable MySQL database, Redis, and object storage before starting the application. Dev imports local properties; production uses its deployment environment.

| Variable | Purpose or dev default |
|---|---|
| LOCAL_DB_URL | MySQL URL for 127.0.0.1:3306/snowlit_dev; JDBC defaults to UTC |
| LOCAL_DB_USERNAME / LOCAL_DB_PASSWORD | Database credentials; defaults root / empty |
| LOCAL_REDIS_HOST / LOCAL_REDIS_PORT | Defaults 127.0.0.1 / 6379 |
| LOCAL_REDIS_PASSWORD / LOCAL_REDIS_DATABASE | Redis authentication and logical database |
| LOCAL_MINIO_ENDPOINT | Default http://127.0.0.1:9000 |
| LOCAL_MINIO_ACCESS_KEY / LOCAL_MINIO_SECRET_KEY | Object-store credentials |
| LOCAL_MINIO_BUCKET / LOCAL_MINIO_PUBLIC_BASE_URL | Bucket and browser-readable media base URL |
| storage.local.directory / storage.local.public-path | Used when any MinIO setting is blank: files go to `target/local-uploads` and are served at `/uploads/**` |
| WECHAT_MINIPROGRAM_APP_ID / WECHAT_MINIPROGRAM_APP_SECRET | Server-side WeChat login credentials |
| WECHAT_MINIPROGRAM_DEV_BIND_USER_ID | Optional explicit dev-only automatic binding target |
| GEOAPIFY_KEY | Global reverse-geocoding credential; missing key leaves location unknown |
| OPEN_METEO_API_KEY | Optional commercial weather credential |
| SQL_INIT_MODE | Dev defaults always; explicitly use never with retained data |

Use [application-dev.yml](../backend/src/main/resources/application-dev.yml) and [application-prod.yml](../backend/src/main/resources/application-prod.yml) as the authoritative configuration. Production uses DB_*, REDIS_*, and MINIO_* variables; SQL initialization defaults to never.

### Local WeChat and Weather Credentials

On a new checkout, copy backend/config/local.properties.example to backend/config/local.properties and fill the required values. Do not overwrite an existing credential file during context or documentation initialization.

```properties
WECHAT_MINIPROGRAM_APP_ID=
WECHAT_MINIPROGRAM_APP_SECRET=
GEOAPIFY_KEY=
OPEN_METEO_API_KEY=
```

The real file is ignored by Git, mode 600, and outside Maven resources. Dev supports project-root or backend working directories; environment variables take precedence. Prod does not import the local file. Database/Redis/MinIO connection configuration is still required separately.

Geoapify credentials can be created through [MyProjects](https://myprojects.geoapify.com/). Weather and reverse geocoding are independent. Licensing and provider-account terms must be checked for the intended deployment; local code does not establish subscription or commercial-use eligibility. The Web map key is independent of backend weather credentials.

### Safe Startup and Initialization

For an existing database, from the project root:

```sh
cd backend
SQL_INIT_MODE=never mvn spring-boot:run
```

The default application port is 8080. schema.sql recreates tables and data.sql repopulates samples. First initialization is only for a deliberately disposable database; never use it as a migration for retained data. never does not create missing databases or tables.

The root start-services.bat and start-services.ps1 scripts are Windows entry points using cmd.exe; they are not a macOS launcher.

## Verification

```sh
cd backend
mvn -o test
mvn -o -DskipTests package
```

Offline mode requires cached dependencies; omit -o when provisioning a new environment. Mockito/Byte Buddy attachment may be restricted by a sandbox. Distinguish an explicit attachment failure from an application assertion failure, and use an approved normal execution environment when required.

Mini-program Node tests, developer-tool import, and native template checks are documented in its technical specification. Use existing local tool capabilities rather than installing a temporary Playwright CLI.

## Runtime and Privacy Contracts

- Existing accounts and WeChat bindings are retained. New seed data uses demo_a/demo_b, generic partner labels, blank positions, and an initial sample password of 123456.
- Album likes/views deduplicate by user, album, and UTC date. Existing activity dates are not migrated. Calendar dates and timestamps have distinct client semantics.
- After initial disclosure and platform permission, location/weather update every 20 minutes while visible and pause in the background. Refusal suppresses repeated automatic prompts; manual recovery remains available.
- Weather uses WGS84. Story-map GCJ-02 behavior is a separate contract. Geoapify and Open-Meteo receive rounded two-decimal coordinates, not business tokens or content. Provider requests originate from the backend; this does not mean anonymous or unlogged processing.
- Location and weather fail independently. Unresolved locations remain unknown and do not overwrite stored position. Cache expiry uses Instant: 20 minutes for complete results, 2 minutes for partial/failure results, with bounded grid entries and request coalescing.
- Weather attribution UI remains hidden by user request. Actual privacy disclosures and platform permission requirements remain applicable.
- Public stories expose record-supplied location fields. Uploads currently preserve supplied image bytes without centralized GPS/EXIF removal. These facts are not automatic requests to change the product.
- Preserve the ICP display. Chinese language, holidays, fonts, maps, and npm mirror choices may remain; they do not directly establish the user's physical location.

## Working Conventions and Acceptance Limits

Follow [AGENTS.md](../AGENTS.md) and the relevant planning files. Maintain context in English; reply to the user in English. Do not commit unless explicitly requested. Never copy real secrets or personal coordinates into context, reports, screenshots, or command output.

Browser artifacts belong in codex-work. Use the application-bundled rg path required by AGENTS.md; if unavailable, use Python rather than PATH rg. Use available browser capabilities and state the verification limit when a preferred tool is unavailable.

Known unscheduled items: 390px Web home overflow, external-map and complete Web write/permission acceptance, real devices/system image selection, production domains/TLS, WeChat privacy settings, and release approval. Local tests and configured URLs do not establish those external states.
