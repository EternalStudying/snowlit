# Snowlit 项目计划

## 当前任务：隐私残留清理与 Git 重新初始化

按用户明确授权保留公开 ICP 备案组件与号码，清理旧昵称、地点/地址/坐标设计图、本机身份路径与旧审计流水；业务日界线改为中性 UTC；保留密钥文件和实际业务数据。验证后移除本仓库旧 Git 元数据并建立干净初始提交，不备份旧历史到项目中。

| 阶段 | 状态 |
|---|---|
| 范围和 Git/服务状态核对 | complete |
| 源码、素材、文档和忽略产物清理 | complete |
| 回归与私密配置/数据保护核对 | complete |
| Git 重新初始化与新历史审查 | complete |

## 维护入口

1. 阅读 [AGENTS.md](AGENTS.md)；Web / 后端任务继续读取对应三件套，全栈同时读取。
2. 小程序读取 [产品规格](miniprogram/product-spec.md) 与 [技术规格](miniprogram/technical-spec.md)。
3. 启动、配置、测试和环境边界见 [开发指南](docs/development.md)，业务规则见 [当前规格](docs/product/current-spec.md)。

## 当前环境与验证

- 后端 8080 已重启；Docker MySQL/Redis/MinIO 运行。现有库必须使用 SQL_INIT_MODE=never，不能重跑 schema.sql/data.sql。
- 本机微信/Geoapify 配置保存在 Git 忽略、600 权限的 backend/config/local.properties；现有登录凭据与用户确认的微信绑定保留。开发者工具服务端口按用户要求保持开启。
- 新初始化使用 demo_a/demo_b、通用伴侣名和空坐标；已有库仅清理核对后的样例字段，16 表记录数、账号凭据和微信绑定摘要未变。
- 后端 259/259、Web 501/501 与构建通过；小程序 80/80、112 个 JS 语法、32 WXML/35 WXSS 编译通过。原生模拟器全球地点与天气实连成功；加速到期刷新、切离暂停、未到期返回续排通过。
- 前轮真实微信登录/退出/再次登录、主要读写与五类图片上传/读取/删除已通过；Geoapify/Open-Meteo 公共坐标与模拟器当前定位天气链路通过。此结果不代表真机或线上发布验收。
- 旧调试截图、个人位置备份和临时脚本已清理；本轮仅保留 codex-work/privacy-refresh 脱敏结果，复用工具位于 codex-work/runtime。

## 后续事项

- Geoapify/Open-Meteo 全球链路已接通；仍无法解析的地点继续保持未知。
- Web 服务已停止；390px 首页横向溢出仍待处理，外部地图和当前改动的真实 Web 视觉验收尚未完成。
- 微信真机、系统选图、线上域名/TLS/隐私后台配置仍需实际验收。
