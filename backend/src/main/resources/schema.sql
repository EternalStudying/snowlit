set @snowlit_schema_fk_checks = @@foreign_key_checks;
set foreign_key_checks = 0;

drop table if exists diary_images;
drop table if exists diary_image_references;
drop table if exists diaries;
drop table if exists diary_entries;
drop table if exists diary_uploads;
drop table if exists album_activity;
drop table if exists album_daily_likes;
drop table if exists album_daily_views;
drop table if exists album_locks;
drop table if exists album_unlock_failures;
drop table if exists photos;
drop table if exists album_photos;
drop table if exists albums;
drop table if exists moments;
drop table if exists story_moments;
drop table if exists feedback;
drop table if exists user_feedback;
drop table if exists feedback_images;
drop table if exists feedback_screenshots;
drop table if exists notice_mutes;
drop table if exists update_notice_mutes;
drop table if exists notices;
drop table if exists update_notices;
drop table if exists messages;
drop table if exists wishes;
drop table if exists couples;
drop table if exists couple_profile;
drop table if exists home_user_location;
drop table if exists user_couple_role;
drop table if exists users;
drop table if exists auth_user;

set foreign_key_checks = @snowlit_schema_fk_checks;

create table if not exists users (
    id bigint primary key auto_increment comment '用户主键',
    username varchar(60) not null comment '登录账号',
    display_name varchar(80) not null comment '展示昵称',
    password_hash varchar(100) not null comment '登录密码 BCrypt 哈希',
    avatar_url varchar(500) null comment '头像 URL，只读展示',
    bio varchar(200) null comment '个人简介',
    mood varchar(80) null comment '当前心情文案',
    couple_role varchar(20) null comment '情侣角色：boyfriend 或 girlfriend',
    home_latitude double null comment '首页位置纬度',
    home_longitude double null comment '首页位置经度',
    home_city varchar(80) null comment '首页位置城市',
    home_district varchar(80) null comment '首页位置区县',
    home_province varchar(80) null comment '首页位置省份',
    home_country varchar(80) null comment '首页位置国家',
    home_weather varchar(80) null comment '首页天气文案',
    home_temperature double null comment '首页温度',
    last_online_at datetime null comment '最近在线或位置更新时间',
    wechat_openid varchar(128) null comment '微信小程序 openid',
    wechat_unionid varchar(128) null comment '微信 unionid',
    wechat_bound_at datetime null comment '微信账号绑定时间',
    updated_at datetime not null default current_timestamp on update current_timestamp comment '用户资料更新时间',
    unique key uk_users_username (username),
    unique key uk_users_wechat_openid (wechat_openid),
    unique key uk_users_couple_role (couple_role)
) comment='用户账号与首页展示状态';

create table if not exists couples (
    id bigint primary key auto_increment comment '情侣资料主键',
    partner_a_name varchar(50) not null comment '第一位伴侣姓名',
    partner_b_name varchar(50) not null comment '第二位伴侣姓名',
    started_on date not null comment '情侣关系开始日',
    anniversary_on date not null comment '纪念日日期',
    slogan varchar(200) not null comment '首页展示标语'
) comment='情侣关系基础资料';

create table if not exists wishes (
    id bigint primary key auto_increment comment '清单主键',
    title varchar(160) not null comment '清单标题',
    description text not null comment '清单描述',
    category varchar(20) not null comment '清单分类：want_go 或 want_do',
    completed boolean not null default false comment '是否已完成',
    image_url varchar(500) null comment '清单图片 URL',
    location_name varchar(120) null comment '地点名称',
    latitude double null comment '地点纬度',
    longitude double null comment '地点经度',
    note text null comment '清单备注',
    expected_completed_at datetime null comment '预计完成时间',
    completed_at datetime null comment '实际完成时间',
    created_at datetime not null comment '创建时间',
    updated_at datetime not null comment '更新时间',
    last_operated_by_user_id bigint null comment '最后操作用户 ID',
    last_operated_at datetime null comment '最后操作时间',
    constraint fk_wishes_last_operator foreign key (last_operated_by_user_id) references users(id) on delete set null
) comment='心愿清单';

create table if not exists messages (
    id bigint primary key auto_increment comment '留言主键',
    author_user_id bigint not null comment '作者用户 ID',
    content text not null comment '留言文字内容',
    image_url varchar(700) null comment '留言图片 URL',
    image_object_name varchar(500) null comment '留言图片对象名',
    image_content_type varchar(80) null comment '留言图片内容类型',
    image_size_bytes bigint null comment '留言图片字节数',
    created_at datetime not null comment '创建时间',
    deleted_at datetime null comment '软删除时间',
    constraint fk_messages_author foreign key (author_user_id) references users(id) on delete cascade
) comment='私密留言';

create table if not exists notices (
    id bigint primary key auto_increment comment '公告主键',
    client_type varchar(20) not null default 'web' comment '客户端类型：web 或 miniprogram',
    title varchar(120) not null comment '公告标题',
    version varchar(60) not null comment '公告版本号',
    items_json text not null comment '公告条目 JSON 数组',
    enabled boolean not null default false comment '是否启用',
    published_at datetime not null comment '发布时间',
    created_at datetime not null comment '创建时间',
    updated_at datetime not null comment '更新时间'
) comment='更新公告';

create table if not exists notice_mutes (
    user_id bigint not null comment '用户 ID',
    client_type varchar(20) not null default 'web' comment '客户端类型：web 或 miniprogram',
    muted_until datetime not null comment '公告静音截止时间',
    updated_at datetime not null comment '更新时间',
    primary key (user_id, client_type),
    constraint fk_notice_mutes_user foreign key (user_id) references users(id) on delete cascade
) comment='用户公告静音记录';

create table if not exists feedback_images (
    id bigint primary key auto_increment comment '反馈图片主键',
    user_id bigint not null comment '上传用户 ID',
    object_name varchar(500) not null comment 'MinIO 对象名',
    url varchar(700) not null comment '反馈图片 URL',
    content_type varchar(80) not null comment '反馈图片内容类型',
    size_bytes bigint not null comment '反馈图片字节数',
    created_at datetime not null comment '上传时间',
    constraint fk_feedback_images_user foreign key (user_id) references users(id) on delete cascade,
    unique key uk_feedback_images_url (url)
) comment='反馈图片上传记录';

create table if not exists feedback (
    id bigint primary key auto_increment comment '反馈主键',
    user_id bigint not null comment '反馈用户 ID',
    type varchar(20) not null comment '反馈类型：bug、idea 或 other',
    title varchar(160) not null comment '反馈标题',
    content text not null comment '反馈内容',
    contact varchar(200) null comment '联系方式',
    image_urls_json text not null comment '反馈图片 URL JSON 数组',
    page_url varchar(1000) null comment '提交页面 URL',
    user_agent varchar(1000) null comment '浏览器 User-Agent',
    status varchar(20) not null default 'pending' comment '处理状态：pending、processing 或 resolved',
    created_at datetime not null comment '创建时间',
    updated_at datetime not null comment '更新时间',
    constraint fk_feedback_user foreign key (user_id) references users(id) on delete cascade
) comment='用户反馈';

create table if not exists albums (
    id bigint primary key auto_increment comment '相册主键',
    title varchar(120) not null comment '相册标题',
    description varchar(500) not null comment '相册描述',
    cover_photo_url varchar(500) not null comment '封面预览图 URL',
    author_name varchar(80) not null comment '作者展示名',
    created_at datetime not null comment '创建时间',
    event_date date not null comment '相册事件日期',
    location varchar(120) not null comment '相册地点',
    view_count bigint not null default 0 comment '累计浏览数',
    like_count bigint not null default 0 comment '累计喜欢数',
    visibility varchar(20) not null default 'public' comment '可见性：public 或 private',
    private_password_hash varchar(100) null comment '私密相册密码哈希',
    pinned boolean not null default false comment '是否置顶',
    sort_order int not null default 100 comment '排序值',
    status varchar(20) not null default 'published' comment '发布状态：draft 或 published',
    published_at datetime null comment '发布时间',
    created_by_user_id bigint null comment '创建用户 ID',
    constraint fk_albums_created_by foreign key (created_by_user_id) references users(id) on delete set null
) comment='相册';

create table if not exists photos (
    id bigint primary key auto_increment comment '照片主键',
    album_id bigint not null comment '相册 ID',
    caption varchar(120) not null comment '照片标题',
    description varchar(500) not null comment '照片描述',
    taken_at date not null comment '拍摄日期',
    location varchar(120) not null comment '拍摄地点',
    sort_order int not null default 100 comment '排序值',
    width int not null comment '照片宽度像素',
    height int not null comment '照片高度像素',
    original_url varchar(700) null comment '原图 URL',
    original_object_name varchar(500) null comment '原图对象名',
    original_content_type varchar(80) null comment '原图内容类型',
    original_size_bytes bigint null comment '原图字节数',
    preview_url varchar(700) not null comment 'WebP 预览图 URL',
    preview_object_name varchar(500) null comment '预览图对象名',
    preview_content_type varchar(80) null comment '预览图内容类型',
    preview_size_bytes bigint null comment '预览图字节数',
    constraint fk_photos_album foreign key (album_id) references albums(id) on delete cascade,
    index idx_photos_album_sort (album_id, sort_order, id)
) comment='相册照片';

create table if not exists album_activity (
    id bigint primary key auto_increment comment '相册行为主键',
    album_id bigint not null comment '相册 ID',
    user_id bigint not null comment '用户 ID',
    activity_date date not null comment '行为自然日',
    viewed boolean not null default false comment '当天是否已贡献浏览数',
    liked boolean not null default false comment '当天当前是否喜欢',
    first_viewed_at datetime null comment '当天首次浏览时间',
    liked_at datetime null comment '当天最近一次切换为喜欢的时间',
    updated_at datetime not null comment '行为记录更新时间',
    constraint fk_album_activity_album foreign key (album_id) references albums(id) on delete cascade,
    constraint fk_album_activity_user foreign key (user_id) references users(id) on delete cascade,
    unique key uq_album_activity (album_id, user_id, activity_date)
) comment='相册每日用户行为';

create table if not exists album_locks (
    id bigint primary key auto_increment comment '相册锁定主键',
    album_id bigint not null comment '相册 ID',
    user_id bigint not null comment '用户 ID',
    failure_count int not null default 0 comment '连续失败次数',
    locked_until datetime null comment '锁定截止时间',
    last_failed_at datetime not null comment '最近失败时间',
    updated_at datetime not null comment '更新时间',
    constraint fk_album_locks_album foreign key (album_id) references albums(id) on delete cascade,
    constraint fk_album_locks_user foreign key (user_id) references users(id) on delete cascade,
    unique key uq_album_locks (album_id, user_id)
) comment='私密相册访问锁定状态';

create table if not exists diaries (
    id bigint primary key auto_increment comment '日记主键',
    role varchar(20) not null comment '作者情侣角色：boyfriend 或 girlfriend',
    author_user_id bigint not null comment '作者用户 ID',
    content_markdown text not null comment 'Markdown 正文',
    title varchar(160) not null comment '日记标题',
    summary varchar(300) not null comment '日记摘要',
    visibility varchar(20) not null comment '可见性：shared 或 private',
    mood_key varchar(30) not null comment '心情标识',
    entry_date date not null comment '日记日期',
    weather varchar(80) null comment '天气文案',
    raw_weather varchar(80) null comment '原始天气文案',
    temperature double null comment '温度',
    wind_direction varchar(80) null comment '风向',
    wind_power varchar(80) null comment '风力',
    humidity varchar(80) null comment '湿度',
    province varchar(80) null comment '省份',
    city varchar(80) null comment '城市',
    district varchar(80) null comment '区县',
    location_name varchar(120) null comment '地点名称',
    latitude double null comment '地点纬度',
    longitude double null comment '地点经度',
    created_at datetime not null comment '创建时间',
    updated_at datetime not null comment '更新时间',
    deleted boolean not null default false comment '是否软删除',
    deleted_at datetime null comment '软删除时间',
    constraint fk_diaries_author foreign key (author_user_id) references users(id) on delete cascade,
    unique key uq_diaries_role_date_deleted (role, entry_date, deleted)
) comment='日记';

create table if not exists diary_uploads (
    id bigint primary key auto_increment comment '日记上传主键',
    user_id bigint not null comment '上传用户 ID',
    object_name varchar(500) not null comment 'MinIO 对象名',
    url varchar(700) not null comment '图片 URL',
    content_type varchar(80) not null comment '图片内容类型',
    size_bytes bigint not null comment '图片字节数',
    temporary boolean not null default true comment '是否临时图片',
    deleted boolean not null default false comment '是否已清理',
    created_at datetime not null comment '上传时间',
    promoted_at datetime null comment '转为正式图片时间',
    deleted_at datetime null comment '清理时间',
    constraint fk_diary_uploads_user foreign key (user_id) references users(id) on delete cascade,
    unique key uk_diary_uploads_url (url)
) comment='日记图片上传记录';

create table if not exists diary_images (
    id bigint primary key auto_increment comment '日记引用图片主键',
    diary_id bigint not null comment '日记 ID',
    upload_id bigint null comment '日记上传记录 ID',
    image_url varchar(700) not null comment '正文引用图片 URL',
    created_at datetime not null comment '引用创建时间',
    constraint fk_diary_images_diary foreign key (diary_id) references diaries(id) on delete cascade,
    constraint fk_diary_images_upload foreign key (upload_id) references diary_uploads(id) on delete set null
) comment='日记引用图片';

create table if not exists moments (
    id bigint primary key auto_increment comment '点滴主键',
    title varchar(160) not null comment '点滴标题',
    content text not null comment '点滴正文',
    event_time datetime not null comment '开始时间',
    end_time datetime null comment '结束时间',
    location_name varchar(160) not null comment '地点名称',
    address varchar(300) null comment '详细地址',
    longitude double null comment '地点经度（无定位样例可为空）',
    latitude double null comment '地点纬度（无定位样例可为空）',
    category varchar(20) not null comment '点滴分类：daily、date、travel、anniversary 或 surprise',
    images_json text not null comment '点滴图片 URL JSON 数组',
    created_by_user_id bigint not null comment '创建用户 ID',
    created_at datetime not null comment '创建时间',
    updated_at datetime not null comment '更新时间',
    deleted_at datetime null comment '软删除时间',
    constraint fk_moments_created_by foreign key (created_by_user_id) references users(id) on delete cascade,
    index idx_moments_event_time (deleted_at, event_time),
    index idx_moments_category_time (deleted_at, category, event_time)
) comment='点滴地图记录';
