# 当前产品与接口规格

核实日期：2026-10-12。本文保留已实现的跨端行为和开发约束；字段与错误细节以当前后端 DTO/VO、控制器和测试为准。

## 产品范围

| 模块 | Web | 小程序 | 后端入口 |
|---|---|---|---|
| 登录与资料 | 灯光登录场景、资料展示 | 微信登录、未绑定账号的绑定、资料编辑 | [AuthController](../../backend/src/main/java/xyz/snowlit/auth/AuthController.java) |
| 首页 | 手账叙事、摘要、位置与天气联动 | 原生 tab 首页和摘要 | [HomeController](../../backend/src/main/java/xyz/snowlit/home/HomeController.java) |
| 相册 | 浏览、私密访问、草稿、批量上传、发布、每日喜欢 | 浏览、详情、临时创建与移动上传、发布 | [AlbumController](../../backend/src/main/java/xyz/snowlit/album/AlbumController.java) |
| 清单 | 想去 / 想做 / 已完成三栏，详情与写入 | 列表、详情、新增编辑、完成照片 | [WishController](../../backend/src/main/java/xyz/snowlit/wishes/WishController.java) |
| 日记 | 月份归档、Markdown 编辑、详情和图片 | 月份归档、详情、新增编辑与图片 | [DiaryController](../../backend/src/main/java/xyz/snowlit/diary/DiaryController.java) |
| 点滴 | 公开沉浸地图、筛选、时间线、图像查看与编辑 | 微信原生地图与列表联动、详情与编辑 | [StoryController](../../backend/src/main/java/xyz/snowlit/story/StoryController.java) |
| 留言 | 登录后的浮动图文留言墙 | 当前未接入 | [MessageController](../../backend/src/main/java/xyz/snowlit/messages/MessageController.java) |
| 公告与反馈 | 公告弹窗、今日静音、反馈表单 | 公告和反馈页面 | [NoticeController](../../backend/src/main/java/xyz/snowlit/notices/NoticeController.java)、[FeedbackController](../../backend/src/main/java/xyz/snowlit/feedback/FeedbackController.java) |
| 天气 | 模块化视觉系统与浏览器位置天气 | 首页摘要等原生展示 | [WeatherController](../../backend/src/main/java/xyz/snowlit/weather/WeatherController.java) |

Web 路由为 `/`、`/album`、`/wishes`、`/diary`、`/messages`、`/story`、`/about`。`/story` 是公开沉浸路由；`/about` 是沉浸路由，导航入口当前仍锁定。普通页面由 `JournalRouteShell` 承载，登录场景由 Login 模块管理。

## 登录与权限

- Web 使用账号密码登录；后端签发业务 token，并使用 Redis 维护会话。
- 小程序通过 `wx.login` 得到 code，再调用 `/api/auth/wechat-login`。未绑定时重新获取 code，用已有 Web 账号调用 `/api/auth/wechat-bind-login`；不自动注册账号。
- 微信身份字段维护在 `users` 表。小程序只保存业务 token，不保存 openid、session_key、AppSecret，也不由客户端声明最终权限。
- 管理用户策略由 [SiteManagerPolicy](../../backend/src/main/java/xyz/snowlit/auth/SiteManagerPolicy.java) 定义，目前是用户 ID 1 或 2；相册草稿管理、点滴写入、清单创建/编辑/删除使用该策略。
- 清单完成/重开当前后端仅要求登录，前端操作入口另有权限门控；修改权限时要同时核对 UI 与后端，不能仅根据按钮是否可见推断接口权限。
- 日记 shared 可读、private 仅作者可读，修改/删除要求作者本人。角色仅按 users.couple_role 处理，缺失需配置，不再按姓名推断；当前实现不是独立的多情侣租户隔离系统。
- 留言列表/发布要求登录，删除仅限作者；不应将“管理用户”误解为可以删除他人的留言。
- 用户资料可更新 displayName、mood、bio；当前没有头像上传接口。

## 相册

1. Web 管理流程为当前草稿查询 → 创建草稿 → 逐张上传 → 发布；草稿不出现在已发布相册列表。
2. 每个相册最多 300 张，至少一张上传成功才可发布；草稿上传、发布和取消必须属于当前管理用户。
3. Web 上传分别提交 original 和 preview；原图上限 10MB，预览由 Canvas 编成 WebP，长边不超过 2560px、质量 0.82。队列保留单项进度、失败重试和发布状态。
4. 刷新可恢复后端草稿，但浏览器未上传的本地 File 需要重新选择。
5. 小程序用 `/photos/mobile` 的单文件接口；当前 mobile 实现用压缩图作为 original/preview。小程序不提供长期草稿入口，但会查询和清理冲突草稿。
6. 私密解锁令牌通过 `X-Album-Access-Token` 传递；Redis 存储其资格。解锁失败达到阈值会暂时锁定；具体阈值以 AlbumModule 为准。
7. 喜欢按 UTC 自然日 toggle：同一用户、相册、日期最多贡献一个喜欢，再点取消。响应保留 `likeCount`、`likedToday`，计数不能低于零。
8. 喜欢不要求先解锁私密相册，也不授予私密照片访问资格。浏览计数仍按访问资格和自然日规则处理。
9. 图片契约使用 `originalUrl`、`previewUrl`；不要恢复旧字段兼容读取。对象展示 URL 与相册 API 权限是不同层面，上线时核对存储/媒体代理的访问策略。

## 清单

- 分类为 want_go、want_do；完成后进入 completed 泳道，重开后回到原分类。
- 新增用 multipart `payload` 和可选的一张 `image`；编辑为 JSON；完成必须上传一张图片。单张图片上限 10MB。
- 状态 mutation 后旧分页响应不能追加到新状态；受影响泳道从第一页重新同步。并发加载共享请求，提交与关闭状态阻止重复操作。
- Web 保留新增可选配图；小程序新增/编辑目前不提供配图选择，完成照片单独支持。
- 位置、备注、计划时间按当前 DTO 与页面字段提交，不用旧文档的固定空字符串替代用户输入。

## 日记

- 按月归档，日期响应使用 `entryDate`，创建请求字段仍为 `date`；编辑日期不可变。
- 同一角色同一天只允许一篇有效日记；可见性为 shared/private。
- 正文采用 `contentMarkdown`，图片通过正文引用；图片上传返回 `uploadId` 和 `url`。
- 后端管理临时图片、正文引用和清理；单篇最多 20 张，每张上限 10MB。编辑与展示共用 Markdown 标题、正文和清洗规则。
- 自然日 `YYYY-MM-DD` 保持日历日期语义；小程序日期/月归档不随设备时区偏移，Web 新增日记和相册默认取本地当天日期。时间戳仍按实际时间点处理。

## 点滴地图

- 列表与详情公开可读；新增、编辑、删除、图片上传由管理用户操作，前后端均有对应边界。
- 单条最多 3 张图片，每张上限 10MB；类型为 daily/date/travel/anniversary/surprise。
- Web 支持类型/年份筛选、地图点位、时间线、同地点聚合、图片查看器和今日/最近回忆入口。
- Web 地图 SDK、marker 分组、相机/缩放、GSAP、弹窗和转场归属视觉层，不放进远程数据生命周期。
- 从普通页面进入使用黑场沉浸转场；退出尽可能恢复进入前路由与滚动位置。保留 reduced-motion 和 SDK/数据不可用时的运行降级。
- 小程序采用原生 map 和列表吸附布局，具体 marker/手势规则以小程序长期规格为准，不能直接套 Web 动效。

## 留言、公告、反馈与天气

- 留言正文必填、最多 500 字；可选一张 jpg/png/webp 图片，上限 10MB。Web 浮动墙显示最近 20 条；首页只展示最新留言文本摘要。
- 公告接口使用 `client=web|miniprogram` 区分客户端，今日静音记录互相隔离。
- 反馈先上传最多 3 张截图，再提交 `imageUrls`；每张上限 10MB。保留现有未配置 MinIO 时的反馈本地存储适配。
- 浏览器天气入口为 `GET /api/weather/atmosphere/browser`；返回天气语义数据，渲染参数在 Web Weather 模块处理。
- 普通页面与登录页使用共享 `SiteRecordLink` 展示当前配置的 ICP 链接，沉浸路由不展示。号码与链接以组件为准，本文件不证明外部备案状态。

## 主要 API 族

| 前缀 | 操作 |
|---|---|
| `/api/auth` | login、wechat-login、wechat-bind-login、logout、GET me、PATCH me/profile |
| `/api/home` | GET 首页摘要、POST location |
| `/api/albums` | GET 列表/详情/当前草稿；POST 创建、unlock、like、view、photos、photos/mobile、publish；DELETE draft |
| `/api/wishes` | GET 列表/详情/summary；POST 创建、complete、reopen；PUT 编辑；DELETE |
| `/api/diary` | GET months、月份列表、详情；POST 创建/images；PUT 编辑；DELETE |
| `/api/story/moments` | GET 列表/详情；POST 创建/images；PUT 编辑；DELETE |
| `/api/messages` | GET 列表；POST multipart 创建；DELETE 作者自己的留言 |
| `/api/update-notice` | GET 当前公告；POST mute-today，带 client |
| `/api/feedback` | POST screenshots；POST 反馈 |
| `/api/weather` | GET atmosphere/browser |

错误在业务层使用 `ApplicationFailure`，由 Web 适配器映射为 HTTP `status/code/message`。响应字段以各域 DTO/VO 为准；home anniversary 使用 `startedOn`、用户位置天气属于 current/partner，反馈图片使用 `imageUrls`。

## 数据与维护约束

- 数据结构以 [schema.sql](../../backend/src/main/resources/schema.sql) 和当前 Mapper 为准，用户表为 users。旧表清理语句不是兼容查询入口。
- Java 根包与 Maven group 均为 xyz.snowlit；十个业务包按垂直模块维护。对象存储共享 `ObjectStore`，保留真实外部适配接口。
- Web 业务文件放 `src/modules/<feature>/`，公共入口是模块 index.ts；删除旧路径后不添加兼容 re-export。
- 权限、接口或字段修改需同时核对 Web、小程序和后端；新增微信平台能力时同步更新隐私、合法域名、类目/权限和拒绝授权降级方案。
- 数据库变更需要明确备份、迁移与恢复步骤，不能沿用旧需求“当时可以删除正式表”的授权。
- 视觉素材、第三方许可证与运行降级代码保留；用户交互使用现有 Vue/Naive UI/GSAP 体系，小程序使用原生平台能力。

## 通用样例与位置

- 新初始化账号为 `demo_a` / `demo_b`，展示“伴侣 A / 伴侣 B”，初始密码仍为 `123456`；现有本机账号不重命名，微信绑定保留。
- 样例不含个人姓名、具体地址或精确坐标；点滴样例坐标可空，保留列表展示并跳过地图 marker。新建/编辑地点仍要求实际坐标。
- 国家/城市来自 Geoapify 实际结果，解析不到保持未知；天气由 Open-Meteo 提供模型估算，两者独立降级。完全未知位置不写入首页，天气成功仍可展示。
- 首次说明同意与系统授权后，Web 打开页面、小程序首页打开/登录后自动定位；仅前台每 20 分钟更新，后台暂停。外发坐标四舍五入到两位，第三方不接收业务身份；第三方可能保留日志；天气页面来源显示已按用户要求移除。拒绝不重复自动弹窗。
