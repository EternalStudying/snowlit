## 项目线程规则

1. 在本项目下开启每一个新线程时，必须先阅读项目根目录的 `AGENTS.md` 文件。
2. 在本项目下开启每一个新线程时，必须使用 `planning-with-files` skill 阅读项目根目录的 `task_plan.md`。
3. 前端线程还必须阅读 `frontend/task_plan.md`、`frontend/findings.md`、`frontend/progress.md`；后端线程还必须阅读 `backend/task_plan.md`、`backend/findings.md`、`backend/progress.md`；全栈线程需要同时阅读前后端三件套。
4. 微信小程序线程还必须阅读 `miniprogram/product-spec.md` 和 `miniprogram/technical-spec.md`；如果任务涉及后端接口、数据库、权限或生产域名，同时阅读后端三件套；如果任务涉及 Web 前端联动，同时阅读前端三件套。
5. 每一个需求完成之后，由 agent 根据任务复杂度、后续维护价值和上下文延续需要，自行决定更新根目录总览或对应前端、后端、小程序文档；第二版开发期间前后端三件套继续维护，但不要恢复第一版长篇流水账。

## 命令行工具规则

1. 如需使用 `rg` / ripgrep，必须调用 `/Applications/Codex.app/Contents/Resources/rg`，不要使用系统自带或 `PATH` 中的 `rg`。

## 项目经理 agent 专用规则

1. 当用户向项目经理 agent 提出需求时，项目经理 agent 必须持续追问必要问题，直到 100% 理解用户的想法、目标、边界、验收标准和执行约束后，再给出对应的 prompt。
2. 项目经理 agent 在写规格文档和给出 prompt 之前，必须先通过追问确认自己已经 100% 理解需求；不能在存在不确定、含糊或多种解释时直接写规格或 prompt。
3. 项目经理 agent 的 prompt 可以面向前端 agent、后端 agent 或其他单一职责执行 agent；如果需求需要同时操作前端和后端，则 prompt 应明确发给全栈 agent。
4. 项目经理 agent 在给出 prompt 之前应先写规格文档；十分简单、一次性、低风险且边界清晰的需求可以不写规格文档。如果项目经理 agent 不确定是否需要写规格文档，必须先询问用户。
5. 本规则只在与项目经理 agent 对话时生效，不适用于前端、后端、全栈或其他执行型 agent。
6. 项目经理 agent 默认不得修改代码；只有在用户明确允许修改代码或明确要求实现某个改动时，才可以进行对应代码编辑。

## 微信小程序 agent 专用规则

1. 微信小程序任务优先使用 `engineering-wechat-mini-program-developer` agent；不要用 Web 前端实现思路直接套到小程序端。
2. 小程序目录固定为 `miniprogram/`，与 `frontend/`、`backend/` 并列；不要把小程序代码放入 `frontend/`。
3. `miniprogram/product-spec.md` 是小程序长期产品规格入口，`miniprogram/technical-spec.md` 是小程序长期技术规格入口；产品范围变化更新产品规格，接口、架构、平台能力或审核/隐私变化更新技术规格。
4. 小程序 V1 默认使用微信原生小程序能力并复用现有 Spring Boot 后端；不要默认引入云开发、第二套业务数据源，也不要复刻 Web 端 GSAP/Lenis/Three 沉浸动效。
5. 小程序端不得保存 `openid`、`session_key`、AppSecret；只保存后端签发的业务 token，权限必须由后端校验，不能信任小程序前端传入的权限状态。
6. 新增小程序模块时遵循技术规格中的目录与分层规则：先新增 `services/<domain>.js` 封装 API，页面只处理状态、交互和展示；上传统一走封装，不在页面里直接拼接业务接口。
7. 新增定位、图片上传、订阅消息、保存图片等微信平台能力时，必须同步确认隐私保护指引、合法域名、类目/权限和降级方案。

## 依赖使用规则

1. 在实现需求时，可以随意添加依赖，只要该依赖能够让需求的实现更加方便。
2. 添加依赖时应说明该依赖用于解决什么问题，并避免引入与当前需求无关的依赖。

## 前端截图检查规则

1. 进行前端截图检查、真实浏览器视觉验证或 UI 流程调试时，Chrome MCP 与 Playwright 各司其职、融合使用。
2. Chrome MCP（`mcp__chrome_devtools`）优先用于快速打开页面、交互检查、截图观察、查看 console 和 network、验证单次 UI 状态。
3. Playwright 优先用于需要可重复自动化脚本、批量视口、trace、复杂流程回归或需要留存脚本证据的验收；本机优先使用项目或本机已有 Playwright 能力和可用浏览器。
4. 在本项目中使用浏览器检查时，临时脚本、截图、traces 或报告统一放到项目根目录的 `codex-work/`。
5. 不要临时安装 `@playwright/cli`；需要 Playwright 时使用项目或本机已有能力。

## 前端 UI 参考资源

1. 设计页面或组件时，可以参考以下 UI/动效资源的组件代码、交互方式和视觉表达：
   - Animate UI：https://animate-ui.com/
   - Kokonut UI Card Flip：https://kokonutui.com/docs/cards/card-flip
   - React Bits：https://reactbits.dev/
   - Design Spells：https://www.designspells.com/
2. 参考这些资源时，应优先适配本项目已有技术栈、视觉风格和交互规则，不直接堆叠无关效果。
3. 如果借鉴组件代码，需要先确认依赖、许可证和实现成本；React 组件示例应转换为符合本项目 Vue 3 + Vite 的实现。
