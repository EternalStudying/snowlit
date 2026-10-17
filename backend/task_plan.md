# 后端计划

## 当前状态

2026-10-17：Geoapify + Open-Meteo 全球地点与天气接入完成，相册日界线改 UTC；259 项后端回归通过，真实服务与模拟器定位通过。8080 保留数据重启，SQL_INIT_MODE=never，本机凭据及微信绑定保留。

## 开发顺序

1. 阅读根 AGENTS.md、task_plan.md 与本目录 findings.md/progress.md。
2. 核对 API、数据、权限、图片和跨端调用范围，查阅当前 DTO/VO、控制器与 Mapper。
3. 在对应业务包实现改动；HTTP 身份/失败映射保留在 web，真实外部适配保留在 infrastructure。
4. 对数据库变更明确备份、迁移、恢复步骤；不复用旧需求删除生产数据的授权。
5. 运行相关行为/HTTP/结构契约测试，涉及打包时验证 package，记录当前结论。

## 当前后续事项

- MySQL/Redis 与 Web/微信登录、主要读取已实连，小程序五类真实上传/读取及主要业务删除已验收；全球城市/天气及模拟器当前坐标链路通过，微信真机仍待验收。
- 跨端自然日、权限策略变化需同时核对客户端实现；当前相关差异见产品规格和开发指南。

## 验证入口

- `mvn test`；已有完整缓存可加 `-o`。
- `mvn -Dtest=<TestName> test` 用于相关测试。
- `mvn -DskipTests package` 用于打包。
- Codex 沙箱 JVM attachment 限制与操作方法见 [开发指南](../docs/development.md)。
