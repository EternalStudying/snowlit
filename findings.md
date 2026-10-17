# 项目事实与开发边界

## 当前维护入口

- Web、后端和微信原生小程序分别位于 frontend、backend、miniprogram；不混放代码。
- 开发命令与配置见 [开发指南](docs/development.md)，业务权限与接口见 [当前规格](docs/product/current-spec.md)。
- 相册和清单术语见 [CONTEXT.md](CONTEXT.md)；小程序读取两份长期规格。
- Git 已按用户授权重新初始化为 main 分支和新的初始提交；使用通用作者身份，不保留旧历史。之后开发以当前检出内容为基线。

## 架构与数据

- Web：Vue 3、Vite、TypeScript、Vue Router、Naive UI、GSAP；十个模块统一在 frontend/src/modules，以 index.ts 暴露公共入口。
- SessionRequest 统一授权、错误解析和会话失效；JournalRouteShell 属于首页模块，远程状态与视觉生命周期分离。
- 后端：Spring Boot + MyBatis + MySQL，Java 根包 xyz.snowlit；十个垂直业务域，web/failure/storage/infrastructure 分别承载边界。
- 微信小程序复用同一个后端；只保存业务 token，权限由后端校验。实际账号及用户确认的微信绑定保留。
- 相册喜欢/浏览按 UTC 自然日计算，不依赖服务器所在地；既有历史活动记录不改写日期。其他日历日期按原有跨端日期契约处理。
- 初始化为 demo_a/demo_b、通用伴侣名和空坐标；国家/城市取实际解析结果，缺失保持未知。

## 隐私与配置

- 用户要求保留 ICP 展示组件与号码；不将备案推断为用户物理位置。
- 旧昵称测试样例、个人目录、含详细地点/坐标的旧设计图和本机调试残留在本轮清理；维护文档不保留旧身份资料。
- 天气用 Geoapify + Open-Meteo，后端将 WGS84 坐标取两位后外发，按模糊网格缓存；地点与天气独立降级。
- 首次说明/系统授权后自动定位，前台每 20 分钟更新、后台暂停；拒绝不反复自动弹窗，保留手动恢复。
- 本机密钥只保存在 Git 忽略、权限 600 的 backend/config/local.properties，资源目录之外，不进入 JAR；环境变量优先，prod 不读取此文件。
- Web 地图与微信地图能力是应用平台选择，不能据此推断个人所在地。天气来源 UI 已按用户要求移除，授权说明仍如实描述数据处理。

## 持续约束

- 现有库必须用 SQL_INIT_MODE=never；schema.sql/data.sql 会重建/填充测试数据，禁止对现有库重跑。
- 用户表是 users；照片用 originalUrl/previewUrl，日记响应 entryDate。API 变化同步核对三端调用方。
- 不为旧删除路径加兼容中转；保留运行降级、许可证和实际所需资产。
- 纯日期按本地年月日解析，新日记重新打开时刷新默认日期；时间戳保留时间点语义。
- 默认不 stage/commit，除非用户明确要求；本轮 Git 重新初始化为明确例外。
- 临时检查材料统一在 codex-work；日志应将项目/用户目录脱敏，完成后移除无维护价值的文件。
- 不将一次服务器/业务删除授权扩展到新的无关操作。

## 验证边界

本机此前已验证真实微信登录/绑定/退出、主要页面读取、五类上传和全球地点天气联调。当前回归与运行状态以 progress.md 为准；历史通过不代表真机、线上域名/TLS、微信后台隐私指引或平台审核已完成。

待处理：Web 390px 首页横向溢出，Web 外部地图/完整写入权限流程，微信真机及线上发布验收。
