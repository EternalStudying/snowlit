# 后端架构与维护事实

最近核实日期：2026-10-17。

## 架构

- Spring Boot + MyBatis + MySQL 单体；pom 编译目标 Java 17，本机 Java 21 可构建。
- Java 根包和 Maven group 均为 xyz.snowlit。
- 十个垂直业务包为 album、auth、diary、feedback、home、messages、notices、story、weather、wishes；每个域集中 controller、Module、Mapper、model、DTO/VO 和私有策略。
- web 负责请求 actor、鉴权入口、CORS 与 HTTP 失败映射；failure 定义 ApplicationFailure。
- 业务 Module 接收 AuthenticatedActor 或用户 ID，不逐个重复解析 bearer/JWT。
- storage.ObjectStore 是对象存储接口；infrastructure.storage.MinioObjectStore 是共享 MinIO 实现，各域保留命名、大小限制、校验、回收和错误码。
- Java 接口用于 MyBatis 和可变化的外部 adapter；不恢复单一业务实现的 interface/Impl 双层。
- 多构造器服务明确标注 Spring 注入入口；AlbumModule 保留可代理性以支持 @Transactional。SpringModuleWiringTests 使用真实容器与事务代理回归，外部协作者 mock。

## API 与权限

- 控制器及跨端业务规则索引见 [当前规格](../docs/product/current-spec.md)，不要以删除的历史规格代替源码契约。
- SiteManagerPolicy 当前允许 ID 1/2 管理用户；相册草稿、点滴写入、清单创建/编辑/删除使用它。
- 日记私密读取与修改/删除要求按作者身份处理；角色只读取 users.couple_role，缺失报告未配置，不能把它描述成已实现的多情侣隔离。
- 清单 complete/reopen 当前仅要求登录；UI 门控与后端权限是两个独立校验点。
- 留言登录可读写，只有作者可删除；正文必填、图片可选。
- 微信登录与绑定复用 users/JWT/Redis；openid、session_key、AppSecret 不返回客户端。自动 dev 绑定只在显式 dev 配置下适用。
- 业务错误为 ApplicationFailure，由 web.ApiExceptionHandler 映射为 status/code/message，保持现有外部错误契约。

## 数据与配置

- [schema.sql](src/main/resources/schema.sql)、[data.sql](src/main/resources/data.sql) 与各域 Mapper 是数据结构入口。用户表是 users，不恢复旧表或旧字段兼容查询。
- 照片使用 originalUrl/previewUrl；日记响应 entryDate、创建 date；反馈提交 imageUrls；头像只读展示。
- 默认 profile 为 dev；数据库默认 127.0.0.1:3306/snowlit_dev。dev SQL 初始化默认 always，会重建表；prod 默认 never。
- 登录会话、私密相册访问 token 使用 Redis；常规业务资产使用 ObjectStore。反馈保留本地存储适配。
- 默认后端端口 8080；具体 LOCAL_*、生产变量和启动方法见 [开发指南](../docs/development.md)。
- Docker 三项依赖已运行；后端进程从容器配置取得本机凭据，SQL_INIT_MODE=never，未写环境文件。重启仍需提供对应 LOCAL_* 环境变量。
- dev 自动导入 `backend/config/local.properties`，支持项目根/后端工作目录；本机微信凭据已写入（600，Git 忽略，资源目录外），示例为 `.example`。重启即可读取，同名环境变量优先，prod 不导入；数据库/存储仍按既有方式配置。凭据不写入文档、验证参数或报告。
- 当前后端 8080 已按新要求重新启动并保持运行，SQL_INIT_MODE=never；真实微信身份按用户确认绑定到现有账号。绑定 200、me 200、退出 204、再次微信登录 200；其他账号与业务内容未修改。
- 仓库文档不证明当前生产服务、证书、备份定时器或微信后台状态；上线前重新核实。

## 验证

- 本轮 `mvn -o test`：259 项全部通过，包含 UTC 跨日计数、来源样例与既有权限/网关/装配回归。
- 本机配置读取支持根目录/后端目录、环境变量优先与 prod 隔离，凭据位于资源目录外且不写入报告。
- 前端 Weather 契约测试引用当前 weather 包及 Module/Controller 路径，跨端字段变更需同步维护。
- 此前模拟器已验证真实微信登录/绑定、全球天气、图片上传与主要接口；此结果不代替真机和线上验收。

## 通用样例与实际地理结果

- 当前 GlobalWeatherGateway 使用 Geoapify 逆地理与 Open-Meteo 模型天气，WGS84 坐标在 WeatherGateway.Coordinates 取两位后才交给外部适配。国家缺失保持未知，地址与天气独立降级。Geoapify 分号分隔的地名别名仅展示首个有效名称；不保存街道或门牌。
- Home personStatuses 返回 city/district/province/country，供两端显示真实地点；Auth/Home/Diary 均移除按姓名猜角色。
- data.sql 使用 demo_a/demo_b 与通用伴侣名，不含初始位置；moments 坐标可空，仅用于无定位样例，业务写入仍校验坐标。
- 本机库只按样例 ID+标题更新旧地点字段，清理旧种子位置和姓名；16 表记录数、账号凭据与微信绑定校验未变。现有库重启继续 SQL_INIT_MODE=never。


## 全球天气接入验证（2026-10-17）

- `GEOAPIFY_KEY` 读取 Git 忽略/600 的本机配置；可选 `OPEN_METEO_API_KEY` 用于商业客户端点，个人非商业免费端点无需 Key。前端产物与小程序无密钥。
- 模糊网格缓存完整结果 20 分钟、失败/部分结果 2 分钟；上限约 2048 项、同格请求合并。到期使用 Instant，避免夏令时回拨延长缓存。
- 真实服务：公共柏林样例解析与天气正常；原生微信模拟器当前 WGS84 位置查询 200、位置写入 204、地点/温度显示正常。现有数据库 16 表记录数、账号凭据和微信绑定摘要未变。
- 后端 259 项回归通过，包含独立失败、缺失温度/零度、WMO 映射、供应商昼夜、坐标量化、缓存与跨夏令时到期。未知状态保留，不硬编码国家/城市。

测试地点样例已统一换为国外地点/国家；相册、首页、日记、清单和天气断言同步，天气采用柏林公共样例坐标。此改动仅涉及测试，不改变现有业务数据；相册日界线以当前 UTC 契约为准。

相册喜欢/浏览的自然日统一 UTC，开发 JDBC 默认 UTC；不依赖设备或服务器所在地，既有历史活动日期不重算。
