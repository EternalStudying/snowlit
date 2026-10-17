# Snowlit

情侣记录项目，包含 Vue Web 前端、Spring Boot 后端和微信原生小程序。

## 开发入口

1. 先读 [AGENTS.md](AGENTS.md) 和 [task_plan.md](task_plan.md)。
2. 环境、启动、测试和已知问题见 [开发指南](docs/development.md)。
3. 业务规则与权限见 [当前规格](docs/product/current-spec.md)，领域术语见 [CONTEXT.md](CONTEXT.md)。
4. Web、后端分别读取本目录的 task_plan.md、findings.md、progress.md；小程序读取 [产品规格](miniprogram/product-spec.md) 与 [技术规格](miniprogram/technical-spec.md)。
5. 参考素材见 [设计索引](docs/product/assets/README.md)；文档图片不作为运行依赖。

## 本地运行

后端需要 MySQL、Redis 和 MinIO；微信/天气 Key 可写入 Git 忽略的 backend/config/local.properties。新检出从 .example 创建此文件。

```sh
cd frontend
npm ci
npm run dev
```

另开终端配置后端连接信息后运行：

```sh
cd backend
SQL_INIT_MODE=never mvn spring-boot:run
```

保留已有数据必须使用 SQL_INIT_MODE=never。首次初始化只在可重置测试库中按开发指南执行；初始化脚本会重建表。
