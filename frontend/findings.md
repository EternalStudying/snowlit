# Web 架构与维护事实

架构核实：2026-10-12；Web 实启补充：2026-10-17。

## 技术栈与位置

- Vue 3 + Vite + TypeScript + Vue Router + Naive UI；主要动效使用 GSAP，辅助能力使用 Lenis、motion-v、Three 等现有依赖。
- 依赖及命令以 [package.json](package.json)、[package-lock.json](package-lock.json) 为准。
- 全部业务模块：home、album、wishes、diary、story、messages、support、login、weather、about。
- 每个业务模块集中组件、model、Gateway、生命周期、CSS、资产和行为测试，通过 index.ts 暴露公共入口。

## 共享基础设施

- [SessionRequest](src/http/sessionRequest.ts) 集中处理授权、JSON/FormData/204、网络/结构化错误和会话失效。普通会话 401 且未提供特殊错误码或为 UNAUTHORIZED 时失效；私密相册等业务 401 不能误触发全局退出。
- [auth](src/auth.ts) 管理浏览器会话与失效事件；Login 生命周期管理提交、pending/error 和成功交接。
- [router](src/router.ts) 通过模块公开的 lazy loader 加载页面，滚动恢复由 navigation/routeScrollPolicy.ts 管理。
- Home 内的 [JournalRouteShell](src/modules/home/JournalRouteShell.vue) 承载普通页面，分离 hero 体验、模块 reveal 和导航融合。
- 全局主题与基础样式位于 src/styles；通用控件优先沿用 Naive UI，不改变已有手账视觉。

## 业务边界

| 模块 | 维护重点 |
|---|---|
| Album | 浏览/草稿/上传/发布/私密访问/计数生命周期；上传队列与预览编码；目录展示、dialog motion、immersive session 分离 |
| Wishes | 三条独立分页泳道；旧分页响应丢弃与 mutation 后重同步；创建/关闭状态防重入 |
| Diary | 月份归档、读写/权限、图片与 Markdown；预览/详情共用清洗规则，视觉 timeline 单独维护 |
| Story | 公开列表/详情与管理写入； typed Amap SDK、聚合规则、map/editor/transition 保持私有视觉边界 |
| Messages | 最近 20 条远程生命周期；浮动布局、hover、burst 和弹窗为视觉层 |
| Home | 共享摘要与位置数据；hero、滚动、纸张与导航协调留在内部视觉接口 |
| Support | 公告加载/静音/浏览器 dismissal、反馈与顺序图片上传 |
| Login | 表单生命周期与登录场景；会话基础设施仍共享 |
| Weather | 语义数据 Gateway；core/profiles/systems/effects/layers 的渲染体系、加载和销毁 |
| About | 沉浸路由模块；当前导航入口仍锁定 |

详细业务约束见 [当前跨端规格](../docs/product/current-spec.md)。

## 视觉与资源

- `/story` 公开且沉浸，`/about` 沉浸；App 不在沉浸路由使用普通路由壳。
- 点滴进入使用黑场转场；退出恢复原路由与滚动位置，保留 reduced-motion 与地图 SDK 降级。
- Home/Album 等运行资源归各模块；产品文档目录图片只作设计参考，不作为运行依赖。
- GSAP、DOM observation、动画时序与浏览器生命周期必须有销毁路径；不得把它们塞入远程数据生命周期。
- SiteRecordLink 为普通页面与登录页共享的 ICP 展示组件，号码/链接以组件为准。
- Weather 外部代码/资源的许可证位于模块内，必须保留。

## 当前验证与问题

- `npm ls --all` 与 `npm run build` 通过；临时前端 HTTP 检查通过。
- `npm test`：64 文件 / 501 项，全部通过；Weather 契约测试已引用当前 weather 包和后端契约测试，字段排除、映射与降级断言保留。
- 共享 `src/calendarDate.ts` 生成本地自然日，用于新增相册/日记；日记编辑器重新打开时刷新默认日期，时间戳仍保留时间点语义。回归覆盖跨年凌晨/深夜、表单提交与跨午夜重开。
- 10-17 使用 Docker 依赖实启，台灯登录、首页及相册/日记/清单导航通过；7 项认证读取接口全部 200，无应用 JS 错误。桌面正常，390×844 首页存在横向溢出。
- 上传/删除、外部地图及其余写入/权限流程未验收。本轮使用已有 Playwright，未改前端业务源码。
- 启动、地图环境变量、工具限制及问题位置见 [开发指南](../docs/development.md)。

## 位置与通用展示

- 静态姓名和头像资源路径使用通用伴侣标识；姓名取后端资料。首页地点优先真实城市/区县/省份/国家，缺失显示“位置待更新”。
- 首页只上报实际解析到地点的坐标；有地点无天气允许保存空天气，完全未知不覆盖原位置。
- StoryMoment 读取坐标可为空；无坐标样例保留列表、不生成 marker。空地图全球视野，不把 0/0 视为用户位置；真实零坐标仍有效。
- 地图 SDK 降级背景不能生成虚构坐标；编辑器空坐标不能通过 Number(空字符串) 保存成 0/0。


## 全球天气自动更新（2026-10-17）

AppTopBar 管理本机说明同意状态和 20 分钟前台定时器；WeatherAtmosphere/日记被动读取不会自己弹定位框。隐藏暂停，返回时保留剩余间隔；拒绝定位停止自动循环，手动可恢复。过期登录和晚到回调不串账号。未知字段不写假地点；天气设置提供立即刷新、暂停；来源署名与来源说明入口已按用户要求移除。501 项 Web 测试与构建通过；Playwright 通用 UI 样例在 1440×1000、390×844 验证首次同意、自动请求和暂停持久化，未写真实位置，未见应用 JS 异常或框架覆盖层。

地点提示和测试样例现使用国外地点；地名、地址、国家、坐标及对应断言保持一致。实际定位结果仍来自服务。不要恢复旧国内地点提示或测试样例；专门的时区边界测试保留多时区覆盖。
