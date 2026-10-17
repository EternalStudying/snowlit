# Snowlit 微信小程序技术规格

本文定义当前工作区的技术契约和后续开发约束。最近本机调试检查日期：2026-10-17；此前验证保留各自日期。
产品行为见 [产品规格](product-spec.md)；全项目上下文与执行规则见根目录 `AGENTS.md`、`task_plan.md`。
涉及后端接口、数据库、权限或生产域名时先读后端三件套；涉及 Web 联动时同时读前端三件套。
本地代码与测试不能证明当前线上版本、微信后台配置、审核结果或真机能力。

## 1. 架构与目录

使用微信原生 WXML/WXSS/JavaScript，代码固定在 `miniprogram/`，与 `frontend/`、`backend/` 并列。
复用当前 Spring Boot 后端、MySQL 业务数据、Redis 登录/私密访问状态和图片存储，不默认新增云开发。
后端当前 Java 根包为 `xyz.snowlit`，按业务域组织；用户表为 `users`，不恢复旧包或旧表兼容假设。

| 目录/入口 | 职责 |
| --- | --- |
| `app.js`、`app.json`、`app.wxss` | 应用生命周期、页面/全局组件注册、全局主题和字体 |
| `constants/config.js` | dev/prod 地址与请求/上传超时 |
| `constants/routes.js`、`theme.js` | 页面路径、tab 路由、稳定视觉 token |
| `utils/request.js`、`upload.js` | 请求、业务 token、错误语义和单文件上传 |
| `utils/auth.js`、`storage.js`、`permission.js` | 本地登录/私密 token、必要缓存、入口显隐 |
| `utils/dialog.js`、`notify.js`、`privacy.js` | 确认、提示、隐私授权及能力降级 |
| `utils/date.js`、`diary-markdown.js`、`tabbar.js` | 日期、日记正文解析、tab 选中状态 |
| `services/<domain>.js` | 业务 API 与参数/上传协议封装 |
| `pages/<page>/index.*` | 页面状态、交互和展示；`*-presenter.js` 负责纯映射/校验 |
| `components/`、`custom-tab-bar/` | 跨页面组件和 5 个 tab 的自定义导航 |
| `tests/*.test.js` | Node 断言、service/presenter/页面模拟测试 |

当前注册 17 页：index、login、diary、diary-detail、diary-edit、story、story-detail、story-edit、albums、album-detail、album-edit、wishes、wish-detail、wish-edit、profile、profile-edit、feedback。
每页均有 `index.js/json/wxml/wxss`；路由常量、页面文件和 `app.json` 必须一起维护。
tab 为 index、diary、albums、wishes、profile；tab 回跳用 `switchTab`，普通页回跳用 `redirectTo`。
当前无分包；主包接近 2MB 或引入低频重模块后再按业务域拆分，不能只为目录形式引入分包。

新增业务先写 service，再写页面；页面不得直接拼业务 API。上传统一调用 `utils/upload.js`。
仅在多页面复用时抽公共组件；跨域通用能力放 utils，不提前加入全局 store、event bus 或第二套后端。
保留真正的接口契约，避免用文件名或实现字符串测试取代可观察行为测试。

## 2. 本地与发布配置

| 配置项 | 当前工作区 | 发布要求 |
| --- | --- | --- |
| `CURRENT_ENV` | `dev` | 切换为 `prod` 并检查实际请求地址 |
| API/upload 地址 | `http://localhost:8080` | `https://snowlit.xyz` 或经确认的正式 HTTPS 域名 |
| 公共 `project.config.json` 的 `urlCheck` | `true` | 保持 `true` |
| 私有 `project.private.config.json` 的 `urlCheck` | `false` | 发布/真机验收时不能依赖关闭校验绕过问题 |
| `requestTimeout` / `uploadTimeout` | 15000 / 30000 ms | 可按真实弱网测量调整 |
| `fontFace` | `null` | 当前不触发网络字体加载 |
| 基础库配置 | 公共为 `latest`，本机私有为 `3.16.0` | 以实际编译与真机兼容结果为准 |

dev 是当前联调配置，不能据公共 `urlCheck:true` 就认为实际开发环境已开启域名校验。
localhost 仅指执行请求的设备；手机真机不能通过它访问电脑后端，真机联调需另设可访问且符合平台要求的地址。
本机已安装微信开发者工具 2.02.2608080（`/Applications/wechatwebdevtools.app`）；MySQL/Redis/MinIO 与后端 8080 已运行。用户已启用开发者工具服务端口并要求保持开启；真实模拟器绑定、退出/再次微信登录与主要页面读取已通过，真机仍待验收。
导入工程时选择 `miniprogram/`，工程根 `miniprogramRoot` 为 `./`；实际 AppID 应与后端和微信后台一致。

包与资源约束：

- `app.json` 保持 `lazyCodeLoading: "requiredComponents"`，上传过滤 `ignoreUploadUnusedFiles:true`。
- `packOptions.ignore` 排除 tests 和长期规格文件；删除的 V1 计划不再作为文档入口。
- 项目体积目标：主包/单分包控制在 2MB 内，单页面文件不超过 500KB，运行图片/音频单文件不超过 200KB；这些沿用项目目标，不代替发布时核实平台最新包限制。
- 新增业务图片走远程 HTTPS；现有 UI 图标、占位图和内联字体属于当前工程资源，设计大图不得放入运行包。
- `assets/fonts/snowlit-sans.wxss` 内联 `Snowlit Sans` UI 字形子集，覆盖 100–900 字重；缺字回退系统字体。
- 字体许可证保留在 [assets/fonts/OFL.txt](assets/fonts/OFL.txt)，随内联字体一起维护；未被使用的 Web 完整字体副本已清理。

## 3. 鉴权、存储和错误

请求使用 `Authorization: Bearer <业务 token>`。身份、管理权限和作者权限由后端校验，不信任客户端缓存/传参。
登录流程：`wx.login` → 后端兑换微信身份 → 查询 `users` 绑定 → 签发业务 token 与 Redis session。
未绑定返回 `WECHAT_ACCOUNT_NOT_BOUND`；绑定登录使用新 code + Web 账号密码，不自动注册。
绑定冲突保留 `WECHAT_ACCOUNT_ALREADY_BOUND`、`WECHAT_OPENID_ALREADY_BOUND` 等业务错误，不返回微信原始响应。
后端 AppID/AppSecret 和 dev 专用首次绑定开关只在后端配置；不把开关带入生产身份流程。

本地键：

| 键 | 内容/清理规则 |
| --- | --- |
| `snowlit_token` | 业务 token；401 或退出清理 |
| `snowlit_user` | 展示用户缓存；读取当前用户/编辑资料后刷新；不能作为授权来源 |
| `snowlit_login_redirect` | 登录后回跳路径，读取后清理 |
| `snowlit_weather_auto_consent_v1` | 本机自动定位说明同意布尔值，不含 token、GPS 或天气；与业务会话分离 |
| `snowlit_album_private_token_<id>` | 相册访问 token 与到期时间；过期、无效或退出时清理 |

`utils/permission.js` 根据现有 ID 策略和缓存派生管理入口状态，仅用于界面显隐。
当前 `GET /api/auth/me` 的资料字段为 id、username、displayName、coupleRole、avatarUrl、bio、mood、updatedAt；不假设它直接返回 `canManage`。
私密相册详情/浏览请求携带 `X-Album-Access-Token`；过期/无效错误只清理该相册 token，不注销业务登录。

请求层对所有 2xx 判成功，主动检查 `wx.request` success 中的 HTTP 状态；上传返回文本先解析 JSON。
401 清理登录态，合并并发提示，用户确认后 `reLaunch` 登录并清空旧栈；登录接口与私密相册 token 401 保留各自语义。
403 显示“当前账号没有操作权限”，404 显示内容不存在，5xx 提示服务繁忙；网络失败保留数据并允许重试。
页面必须有 loading、空态、错误态与成功态；不能无限重试 403，也不能把接口拒绝改成本地成功。
`notify`/`dialog` 优先使用 Snowlit 组件，缺失时降级原生 toast/modal；确认敏感操作后才执行。

## 4. 当前 API 契约

下表列出 10 个 service 使用的 44 个操作；实现以 `services/` 和当前后端控制器为准。
动态 ID 不改变端点语义；读写字段按当前 VO/DTO，禁止恢复旧字段别名。

| 业务 | HTTP 操作 | 请求或响应要点 |
| --- | --- | --- |
| 登录 | `POST /api/auth/wechat-login` | JSON `{code}`，返回 `{token,user}` |
| 绑定 | `POST /api/auth/wechat-bind-login` | JSON `{code,username,password}` |
| 当前用户/退出 | `GET /api/auth/me`；`POST /api/auth/logout` | 资料刷新/后端 session 清理 |
| 资料更新 | `PATCH /api/auth/me/profile` | displayName、mood、bio；账号/头像不更新 |
| 首页 | `GET /api/home`；`POST /api/home/location` | 摘要；定位后保存天气/位置 |
| 天气 | `GET /api/weather/atmosphere/browser` | query latitude、longitude |
| 日记读取 | `GET /api/diary/months`；`GET /api/diary`；`GET /api/diary/{id}` | year 可选；month 为 YYYY-MM；日期读 entryDate |
| 日记写入 | `POST /api/diary`；`PUT /api/diary/{id}`；`DELETE /api/diary/{id}` | 创建有 date；更新没有 date；正文 contentMarkdown |
| 日记图片 | `POST /api/diary/images` | 单文件 file；返回 uploadId + url |
| 点滴读取 | `GET /api/story/moments`；`GET /api/story/moments/{id}` | category/year 筛选；作者字段 createdByUserId |
| 点滴写入 | `POST /api/story/moments`；`PUT /api/story/moments/{id}`；`DELETE /api/story/moments/{id}` | 管理用户；JSON 与现有字段一致 |
| 点滴图片 | `POST /api/story/moments/images` | 单文件 file，返回业务图片 URL |
| 相册读取 | `GET /api/albums`；`GET /api/albums/{albumId}` | page/size/previewLimit；照片 previewUrl/originalUrl |
| 相册解锁/喜欢/浏览 | `POST /api/albums/{albumId}/unlock`、`/like`、`/view` | 密码；每日 toggle 返回 likeCount/likedToday；静默浏览记录 |
| 相册临时创建/查询 | `POST /api/albums`；`GET /api/albums/drafts/current` | 创建后上传；查询用于旧草稿冲突处理，不是恢复入口 |
| 相册照片 | `POST /api/albums/{albumId}/photos/mobile` | 单文件 file + formData.metadata JSON |
| 相册发布/取消 | `POST /api/albums/{albumId}/publish`；`DELETE /api/albums/{albumId}/draft` | 完整上传后发布；失败尽量清理 |
| 清单读取/统计 | `GET /api/wishes`；`GET /api/wishes/{id}`；`GET /api/wishes/summary` | category/completed/page/size；lastOperatedByUserId |
| 清单创建 | `POST /api/wishes` | service 手动构造 multipart payload，无图片 |
| 清单更新/删除 | `PUT /api/wishes/{id}`；`DELETE /api/wishes/{id}` | 更新 JSON；管理用户 |
| 清单完成/恢复 | `POST /api/wishes/{id}/complete`；`POST /api/wishes/{id}/reopen` | 完成必填单文件 image；恢复无图 |
| 公告/今日静默 | `GET /api/update-notice?client=miniprogram`；`POST /api/update-notice/mute-today?client=miniprogram` | 客户端隔离；notice 与 shouldShow 分开解释 |
| 反馈上传/提交 | `POST /api/feedback/screenshots`；`POST /api/feedback` | 单文件 file；提交 JSON imageUrls |

关键跨端字段与权限：

- 首页读取 `couple.startedOn`、`latest.diary.entryDate`、`latest.photo.previewUrl/takenAt` 等现行字段；不是旧数据表映射。
- 日记创建为 contentMarkdown/date/moodKey/visibility，更新只有 contentMarkdown/moodKey/visibility；shared/private 由后端校验。
- 日记私密内容仅作者可读，更新/删除校验 authorUserId；客户端现有入口按 coupleRole 显示，不能代替后端作者校验。
- 后端日记角色从 users.couple_role 读取，缺失时报角色未配置，不再按用户名/昵称推断；同角色同日期新增会冲突，当前没有严格 couple-id 空间校验，不将理想身份隔离写成已实现事实。
- 点滴 payload 为 title/content/eventTime/endTime/locationName/address/longitude/latitude/category/images；管理写入仍要求 ID 1、2。
- 清单 payload 为 title/category/description/locationName/expectedCompletedAt/note；地点与备注提交实际输入，不再固定为空。
- 清单类别 want_go/want_do；已完成列表用 completed=true，未完成用类别 + completed=false；完成/恢复仅要求认证。
- 相册照片使用 previewUrl 和可空 originalUrl；service 的 UI 临时 url 是本地映射，不能据此要求后端新增兼容字段。
- mobile 相册上传当前把压缩图保存为 original/preview，不生成 WebP 双资产；Web 原图 + preview 上传协议独立保留。
- 相册喜欢按后端 UTC 自然日 toggle；前端按接口响应更新，不自行累加或推定日期。

## 5. 页面数据与媒体流程

首页并行区各自降级：游客只加载公开点滴；登录后相册只读前 2 本，清单统计用聚合接口。
首页和清单在 onShow 刷新，onLoad 不重复发起首屏读取；会话变化清除旧私有展示/管理状态，旧 token 发起的读取响应不回填新会话，避免游客缓存或上一账号内容残留。
天气默认随首页打开或登录后自动更新。首次顺序为说明前台每 20 分钟定位、第三方模糊坐标请求/日志并确认 → 隐私检查 → 查询原生位置授权（已拒绝则暂停）→ `wx.getLocation({type:'wgs84'})` → 既有天气接口。首页天气定位使用 WGS84，点滴原生地图既有 GCJ02 坐标流程不改，不能混用。

- 首页可见且已登录时，按上次请求时间安排 20 分钟定时器；隐藏/卸载清理，返回前台或首页距上次请求不足 20 分钟不重复定位，超时则刷新。首次登录/切换账号立即尝试，不在后台持续定位，不持久化 GPS 或天气。
- 首次说明与隐私同意后仅持久保存 `snowlit_weather_auto_consent_v1=true`；拒绝/取消后当前运行抑制自动重复提示。系统授权为 false 或原生授权拒绝时停掉自动循环，手动入口可明确确认后进入 `wx.openSetting` 恢复；不自动打开设置。
- 同时保护权限弹窗、GPS 回调和 HTTP 旧响应：隐藏后不再保存本次晚到结果，切换账号不发送旧定位或写回旧天气；重复点击或定时任务不并发开启授权/定位。自动更新成功和普通失败不反复 toast，手动更新保留明确结果提示。

- 国家、城市、地区只取 Geoapify 真实结果，不默认任何国家或具体城市；未知展示“位置待更新”。有实际地点时调用首页位置保存并刷新摘要；无天气仍可保存真实位置，提示“位置已更新，天气暂不可用”。
- 无解析地点但 Open-Meteo 天气有效时只更新当前页天气，提示“天气已更新，位置暂不可用”，不调用 `/api/home/location`，不立即重载首页覆盖天气。内存暂存仅属当前业务会话；摘要刷新或旧响应不覆盖这份天气，会话变化清理。
- 两项全失败、用户拒绝或定位失败时保留已有天气/位置；不写假地点、不提示更新成功。空温度显示 --°，真实 0℃ 显示 0°；第一人没有有效天气时可展示第二人的有效状态。
- 小程序把 WGS84 坐标发给 Snowlit 后端；外部服务请求由后端取小数点后 2 位并缓存。Geoapify Key 仅后端配置；缺 Key 时可独立返回天气。14 字段天气契约及客户端业务域名不变，前端不直接请求第三方、不得传 API Key。

日记统一使用 `utils/diary-markdown.js` 解析正文与预览；标题以一级标题写入正文，图片先上传再插入 Markdown。
保存不得有上传中/失败图片；后端从 Markdown 解析并验证图片引用，不单独提交图片数组。

日期显示统一经过 `utils/date.js`：纯 `YYYY-MM-DD` 按年月日构造本地日历日期，不先解析为 UTC；日记、相册及默认月份保持输入的自然日。
纯日期校验真实月份天数和闰年，无效值返回 null/空文本；日记默认月份在缺失或无效输入时回退当前本地月份。
带 `Z` 或时区偏移的时间戳仍表示时间点，沿用设备本地日期/时间显示；无时区的日期时间字符串沿用现有本地时间解析。
禁止通过全局固定时区或直接截取时间戳日期掩盖边界问题；新调用点复用工具，测试同时覆盖日历日期和时间点。

相册保存按 create → upload → publish；`ALBUM_DRAFT_EXISTS` 时查询旧记录，用户确认后删除再创建。
失败清理是 best-effort，不能宣称后端临时对象必然已删除；保留当前输入并重置上传状态供重试。

| 场景 | 小程序数量上限 | 上传字段/行为 |
| --- | --- | --- |
| 点滴 | 3 张 | file，逐张上传成功后提交图片 URL |
| 日记 | 20 张 | file；后端单张 10MB，支持 jpg/png/webp/gif |
| 新增相册 | 9 张 | file + metadata；caption/takenAt/location/width/height/sortOrder |
| 清单完成 | 1 张必填 | image；没有选择不调用接口 |
| 反馈 | 3 张 | file；全部成功后使用 imageUrls 提交 |

选择图片使用 `wx.chooseMedia` 的图片/压缩配置，先调用隐私授权；非取消失败明确提示，主动取消不提示。保存或上传期间禁止增删上传列表，隐私/选图回调返回时再次检查提交状态；日记图片按批串行处理，防止索引错位、漏传或晚到结果回填。日记上限仍为 20 张；当前调试基础库 3.16.0，不能将旧基础库的单次 9 张限制套用到当前配置。
后端日记/mobile 相册上传兼容无扩展名或 application/octet-stream 的微信临时文件，仍通过图片头校验；不能取消真实类型/大小校验。
列表分页，避免全量数据进入视图；单次 setData 不超过 256KB，进度等高频更新仅更新必要路径。
复杂页面测量/地图生命周期留在页面，纯映射/校验留在 presenter；取消页面后不得残留定时器/旧响应覆盖。

地图默认 fullMap；无有效坐标时使用全球中性视野（0/0、scale 3），该中心只用于显示、不代表用户位置；无坐标样例保留在列表、跳过 marker，单 marker 选择对应条目，聚合点放大；仅点击条目进入详情。
marker 随用户缩放聚合；加载列表后 includePoints 只做一次视野适配，拖动、吸附和程序更新不能反复重置缩放。
地图浏览不定位用户；点滴编辑当前手填位置，不调用 chooseLocation；新增选点需单独补平台规格。

## 6. 平台、隐私与降级

发布前必须确认微信后台 request/uploadFile/downloadFile 合法域名、有效 HTTPS/TLS 证书链和 `/api/`、`/media/` 可达。
生产不能使用公网 IP、localhost 或 HTTP。当前 prod 候选地址是 `https://snowlit.xyz`，本轮未验证线上可达性。

| 能力 | 触发时机与说明 | 配置与降级 |
| --- | --- | --- |
| 微信登录/绑定 | 主动同意协议后登录；说明账号识别和绑定用途 | 后端兑换，前端不存微信标识；错误留在登录页 |
| 位置 | 首次说明并同意后：首页打开/登录、前台每 20 分钟或用户手动更新天气/城市/距离，说明后端向 Geoapify/Open-Meteo 发送模糊坐标及可能的日志留存 | app.json 声明 scope.userLocation 和 requiredPrivateInfos:getLocation；拒绝保留展示；微信后台隐私指引待同步核对 |
| 图片选择/拍摄/上传 | 用户主动选图，说明对应内容或反馈用途 | 隐私授权后调用；拒绝不继续选图，失败保留表单 |
| 反馈设备信息 | 提交时读取设备/微信/基础库摘要用于复现 | 使用 getDeviceInfo/getAppBaseInfo；隐私指引覆盖用途 |
| 图片预览/私密访问 | 已允许访问的业务内容 | HTTPS 媒体域名；私密 token 无效重新解锁 |
| 字体 | app.wxss 内联 UI 字形子集 | 无网络字体请求；缺字回退系统字体 |

隐私保护指引还需覆盖账号资料、反馈联系方式、必要本地缓存和服务端图片保存，以及 Geoapify/Open-Meteo 查询模糊坐标的目的、数据项与第三方日志留存。本地登录隐私文本、定位确认框和 app.json 用途已覆盖自动频率、前后台边界和第三方查询；微信后台隐私保护指引尚未在本次操作中更新，发布前必须同步。Geoapify 成功请求日志通常不超过 24 小时，Open-Meteo 请求日志可保留 90 天；模糊坐标仍包含大致区域，并非匿名或零留痕。服务商条款/留存可能变化，发布前重新核对。
`authorizePrivacy` 优先使用页面 snowlit-privacy；基础库不支持检查或无需授权时继续原操作，明确拒绝时停止。
当前检查失败也沿用无需授权分支；这是现有降级行为，真机验收需核实平台是否接受，不能据此宣称隐私配置完成。
新增定位、保存图片、订阅消息、客服等能力前同步确认类目、接口权限、用途、合法域名与降级，不以代码声明替代后台配置。
不启动时一次索取权限，不诱导分享或关注；本轮未核实最新平台规则，发布时使用微信官方文档和后台结果确认。

## 7. 开发验证与发布边界

小程序无独立 npm 清单，测试使用 Node 内建模块。在项目根执行：

```bash
node --test miniprogram/tests/*.test.js
TZ=America/Los_Angeles node --test miniprogram/tests/*.test.js
TZ=Asia/Singapore node --test miniprogram/tests/*.test.js
TZ=UTC node --test miniprogram/tests/*.test.js
```

`tests/date.test.js` 在三个独立时区子进程验证月/年边界、闰日、无效值、带 Z/偏移的时间戳及日记/相册/点滴 presenter。Singapore 代表 UTC+08 场景；时区仅用于测试进程，不改变应用运行配置。
地名和地址样例使用境外地点或通用名称，关联地图坐标和断言同步；聚合和缩放使用合成示例坐标，不代表用户位置。
默认缩略图复用咖啡、暮色和绿叶等通用图片；图片缺失不回填固定地标或个人地点。

当前验证基线：Node 80/80，112 个 JS 语法、32 个 WXML 和 35 个 WXSS 编译通过。自动刷新用虚拟时钟验证前台 20 分钟、隐藏/卸载、取消抑制、原生权限拒绝、手动恢复、会话切换和晚到响应保护。

已完成的本机模拟器验证包括微信绑定/再次登录、主要页面读取和业务读写；五类图片上传经后端与对象存储回读，原生可解码。系统选图使用样例结果注入，不能据此确认原生系统相册/相机与真机传输；相册发布从独立测试草稿开始，原有草稿保留。
全球地点/天气实际接口与模拟器链路已通过，首页写入与可见温度一致；加速到期分支继续排下一轮，切离首页停止，未到期返回续排。业务会话到期时清理登录并停止自动更新，重登录可恢复。上述记录不包含真实坐标、账号昵称或本机个人路径。

每次变更按范围验证 service 请求、presenter、页面 loading/空态/错误态/成功态、并发提交与后端权限拒绝。上传回归等待实际完成状态，覆盖选择/提交并发、重叠批次、晚到结果和失败恢复。
必要的真实验收覆盖 iOS/Android、iPhone SE/iPad、长文本、键盘、弱网/断网、图像预览/上传与返回栈。登录检查 code 兑换、绑定冲突和 session；图片/定位检查隐私授权与合法域名；跨端新增数据需要 Web 回读。
微信后台隐私指引、线上域名/TLS、真机和审核发布仍需实际确认。本地测试与模拟器结果不能证明这些外部状态；后端连接现有库须保持 SQL_INIT_MODE=never，不能用初始化脚本替代数据迁移。

产品范围变化更新 product-spec.md；接口、架构、平台或隐私影响更新本文，并同步涉及的后端/Web 上下文。
