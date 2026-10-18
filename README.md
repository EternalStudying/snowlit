# Snowlit

A shared memory application with a Vue Web client, a Spring Boot backend, and a native WeChat mini program.

## Development Context

1. Read [AGENTS.md](AGENTS.md) and the [root plan](task_plan.md).
2. Use [findings](findings.md), [progress](progress.md), and [domain vocabulary](CONTEXT.md) for the current baseline.
3. Follow the area-specific entry points in the root plan. Mini-program scope and platform contracts live in its [product](miniprogram/product-spec.md) and [technical](miniprogram/technical-spec.md) specifications.
4. Use the [development guide](docs/development.md) for commands and configuration, and the [current specification](docs/product/current-spec.md) for cross-client contracts.

Context documents are maintained in English. Replies to the user are in English. Historical task journals are not the current development plan.

## Local Development

The backend requires MySQL, Redis, and MinIO. Local WeChat/weather credentials belong in the ignored backend/config/local.properties file, created from its example on a new checkout.

```sh
cd frontend
npm ci
npm run dev
```

In another terminal, configure the backend connections and run:

```sh
cd backend
SQL_INIT_MODE=never mvn spring-boot:run
```

Use never with retained data. Initialize only a disposable development database: initialization scripts recreate/reseed tables. See the development guide before first startup.