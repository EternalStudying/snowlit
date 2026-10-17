# 开发指南

启动与小程序联调核实：2026-10-17；Node/npm、Java/Maven 清单与前端测试保留 10-12 快照。依赖清单以 package-lock.json、pom.xml 为准。

## 目录与环境

| 目录 | 职责 | 依赖入口 |
|---|---|---|
| `frontend/` | Vue 3 + Vite + TypeScript Web 应用 | [package.json](../frontend/package.json)、[package-lock.json](../frontend/package-lock.json) |
| `backend/` | Spring Boot + MyBatis 单体后端 | [pom.xml](../backend/pom.xml) |
| `miniprogram/` | 微信原生小程序，复用后端 | [技术规格](../miniprogram/technical-spec.md) |
| `codex-work/` | 本地检查脚本、截图、日志、构建暂存 | Git 忽略，不作为长期规格入口 |

以下命令以项目根目录为工作目录；路径按当前检出位置解析。

| 工具或服务 | 当前本机状态 |
|---|---|
| Node.js / npm | 24.16.0 / 11.13.0，前端完整依赖树可解析 |
| Java / Maven | Java 21.0.11 / Maven 3.9.16；后端编译目标 Java 17 |
| MySQL / Redis / MinIO | 10-17 Docker 容器运行，分别映射本机 3306/6379/9000；MinIO 控制台 9001 |
| Docker Desktop | 10-17 已运行；三项服务均绑定 127.0.0.1，使用持久化卷 |
| 微信开发者工具 | 10-17 已安装 2.02.2608080；页面/样式编译通过，已完成主要模拟器联调；真机仍需验收 |

## Web 前端

在项目根目录执行：

```sh
cd frontend
npm run dev
```

Vite 默认使用 5173；`/api` 代理到 `http://localhost:8080`。开发命令会自动打开浏览器。10-17 Web 验证后曾停止前后端；当前按用户新要求已重新启动后端 8080 供小程序调试，Web 5173 仍未启动。Docker 只提供基础服务，前后端仍需各自启动。

```sh
cd frontend
npm ls --all
npm test
npm run build
```

`build` 已包含 `vue-tsc -b`。需要只检查类型时运行 `./node_modules/.bin/vue-tsc -b`；没有 `npm run type-check` 脚本。

重新安装使用 `npm ci` 保持锁文件一致。如果 npm 用户缓存权限异常，可在 frontend 目录使用 `npm ci --cache ../codex-work/npm-cache`。

Web 地图使用 `VITE_AMAP_KEY`，可选 `VITE_AMAP_SECURITY_JS_CODE`。可以放在 `frontend/.env.local`；该文件被 Git 忽略。缺少地图配置时保留现有降级展示。

## 后端启动前的准备

1. 准备独立的 MySQL 测试库 `snowlit_dev`，配置有访问权限的数据库用户。
2. 启动 Redis；登录会话与私密相册访问令牌需要它。
3. 准备 MinIO 服务、bucket 和访问配置；相册、日记、点滴、清单、留言等图片操作需要对象存储。
4. 配置数据库/存储连接变量；微信凭据可保存在下述本地配置文件，然后运行 Maven。

10-17 Docker 已运行 mysql、redis、minio；snowlit_dev 已有 16 张表和 2 个用户。仓库没有 Compose 文件。本轮从现有容器配置读取凭据，仅注入后端子进程，不保存到项目文件；重启前需在终端配置对应 LOCAL_* 环境变量。

[application.yml](../backend/src/main/resources/application.yml) 默认选择 `dev`。配置来源见 [application-dev.yml](../backend/src/main/resources/application-dev.yml)。

| 变量 | 用途或默认值 |
|---|---|
| `LOCAL_DB_URL` | 默认连接 `127.0.0.1:3306/snowlit_dev` |
| `LOCAL_DB_USERNAME` / `LOCAL_DB_PASSWORD` | 默认 root / 空密码；自行配置本机账号 |
| `LOCAL_REDIS_HOST` / `LOCAL_REDIS_PORT` | 默认 127.0.0.1 / 6379 |
| `LOCAL_REDIS_PASSWORD` / `LOCAL_REDIS_DATABASE` | Redis 认证与逻辑库 |
| `LOCAL_MINIO_ENDPOINT` | 默认 http://127.0.0.1:9000 |
| `LOCAL_MINIO_ACCESS_KEY` / `LOCAL_MINIO_SECRET_KEY` | 对象存储访问凭据 |
| `LOCAL_MINIO_BUCKET` / `LOCAL_MINIO_PUBLIC_BASE_URL` | 默认 snowlit-dev 与对应本机展示 URL |
| `GEOAPIFY_KEY` | 全球城市/国家逆地理解析，缺失保留未知 |
| `OPEN_METEO_API_KEY` | 可选商业天气 Key；个人非商业免费接口无需 Key |
| `WECHAT_MINIPROGRAM_APP_ID` / `WECHAT_MINIPROGRAM_APP_SECRET` | 小程序微信登录的服务端配置 |
| `WECHAT_MINIPROGRAM_DEV_BIND_USER_ID` | 仅 dev 的临时自动绑定入口，按需配置 |
| `SQL_INIT_MODE` | dev 默认 always；初始化模式 |

`schema.sql` 会删除并重建表，`data.sql` 会重新填入样例数据。首次初始化只连接可重置测试库；保留已有数据时设置 `SQL_INIT_MODE=never`，并另行安排结构迁移。`never` 不会替你创建数据库或缺失的表。

### 本机微信与天气配置

后端使用 Geoapify 解析城市/国家、Open-Meteo 获取全球模型天气。本机 `GEOAPIFY_KEY` 填写后重启生效；可在 [Geoapify MyProjects](https://myprojects.geoapify.com/) 创建项目并进入 API Keys。Open-Meteo 个人非商业接口无需 Key；商业部署需核对其许可和客户 API Key。Web 点滴地图的 `VITE_AMAP_KEY` 保持独立。

开发环境会自动读取 `backend/config/local.properties`。本机微信及 Geoapify 凭据已配置；新检出可复制 `backend/config/local.properties.example`，填写后重启后端：

```properties
WECHAT_MINIPROGRAM_APP_ID=填写小程序AppID
WECHAT_MINIPROGRAM_APP_SECRET=填写对应AppSecret
```

该文件被 Git 忽略，放在 Maven 资源目录之外，不会打进应用 JAR；本机文件权限为 600。示例文件不包含凭据，可提交。相同名称的环境变量仍优先，生产 profile 不会加载此本地文件。

支持从项目根目录或 `backend/` 作为工作目录启动（Maven/IDE 均适用）；IDE 使用其他工作目录时，改为这两者之一。其他数据库/Redis/MinIO 配置仍按前述 `LOCAL_*` 变量设置。本机文件保存微信与天气服务配置，不会自动读取项目根目录 `.env.local`。

根目录 `start-services.bat` 和 `start-services.ps1` 是 Windows 入口，调用 `cmd.exe`，不能作为 macOS 一键启动方式。

```sh
cd backend
SQL_INIT_MODE=never mvn spring-boot:run
```

后端默认端口 8080。生产环境使用 [application-prod.yml](../backend/src/main/resources/application-prod.yml) 的 `DB_*`、`REDIS_*`、`MINIO_*` 等变量；生产 SQL 初始化默认 never。密钥和密码不写进源码、规格或提交内容。

## 测试与打包

```sh
cd backend
mvn -o test
mvn -o -DskipTests package
```

`-o` 使用本机 Maven 缓存；新环境下载依赖时去掉 `-o`。本机 Maven 已有项目所需依赖。

Codex 执行沙箱可能阻止 Mockito/Byte Buddy 附加到 JVM。遇到明确的 agent attachment 错误，使用相同测试命令在正常终端或获准的沙箱外执行，不能把它误判为业务断言失败。

小程序测试、开发者工具导入和发布配置见 [小程序技术规格](../miniprogram/technical-spec.md)。

## 最近核实结果与待处理问题

本机已具备 Node/npm、Java/Maven 和前端依赖。Docker 提供 MySQL/Redis/MinIO，后端与 Web 各自启动。最新回归与服务状态见 [根进度](../progress.md)，不以旧测试数字代替当前验证。

此前真实微信登录/绑定/退出、主要页面读取、五类图片上传与全球天气定位已在模拟器验证；系统选图、微信真机和线上配置仍需验收。Web 移动首页存在横向溢出，外部地图与完整写入/权限流程另行验收。

相册喜欢与浏览按 UTC 自然日计算，同一用户/相册/UTC 日期去重。切换后的查询/新增采用 UTC，既有历史活动日期不迁移；这与用户位置无关。开发 JDBC 默认 serverTimezone=UTC，外部指定 DB URL 时由部署者保持一致。

本轮不核实线上部署、TLS 续期、微信后台合法域名或审核状态；生产 URL 只表示配置目标。

## 工作约定

- 新线程按 AGENTS.md 阅读对应计划和长期规格；完成需求后仅更新有维护价值的信息。
- 默认不 stage/commit，除非用户要求。
- 浏览器临时脚本、截图、trace 和报告放 `codex-work/`；使用现有浏览器自动化能力。
- rg 必须使用 AGENTS.md 指定的应用内路径；不可用时用 Python 搜索。
- 本机没有 Chrome DevTools MCP 可调用入口时，按可用工具完成等效检查，并说明验证范围。

### 个人信息与位置默认值

初始化使用 demo_a/demo_b（初始密码 123456）、通用伴侣名和空坐标样例；现有账号/微信绑定继续沿用。国家与城市只取 Geoapify 实际返回；解析不到时保持未知，不根据坐标或天气猜测国家。旧调试截图及个人位置备份不进入仓库；本机清理结果只保留脱敏摘要。


### 全球位置与天气运行规则

- Web 与小程序首次显示第三方说明并取得系统定位授权；之后打开页面自动更新。前台每 20 分钟刷新，后台暂停；超时返回前台会更新。小程序仅首页可见时执行。权限拒绝/取消不循环弹窗，保留手动重试；Web 可在“天气”暂停自动更新。
- 天气定位为 WGS84；点滴地图的 GCJ-02 能力单独处理。第三方网关只能接收经纬度四舍五入到 2 位的小网格坐标，不转发账号、业务内容、客户端 IP 或鉴权头。并非匿名或零留存：服务商仍可能保留请求日志。
- 固定 HTTPS 端点：Geoapify `/v1/geocode/reverse`（`type=city`，不请求街道/门牌）与 Open-Meteo `/v1/forecast`。地址与天气独立降级；未知位置不写假首页位置，天气成功仍可展示。
- 后端内存缓存按模糊网格合并；完整结果 20 分钟、部分/失败结果 2 分钟，最多约 2048 项。天气接口继续使用现有 14 个语义字段，WMO 天气码转换为现有状态；昼夜优先使用服务商 `is_day`。Open-Meteo 当前天气为模型估算，天气页面来源署名和来源说明入口已按用户要求移除。
- `backend/config/local.properties` 在资源目录外，Git 忽略、600 权限；环境变量优先。真实 Key 不进入客户端、构建产物或调试报告。旧本机高德 Key 不再用于天气。
- 微信隐私保护指引后台需与代码中的前台自动定位、第三方服务及用途保持一致；小程序仅访问自家后端，无需添加两个服务商为客户端合法域名。生产后端的 HTTPS 合法域名、真机和微信平台审核需另行验收。
