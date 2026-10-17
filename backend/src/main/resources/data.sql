insert ignore into couples (id, partner_a_name, partner_b_name, started_on, anniversary_on, slogan)
values (1, '伴侣 A', '伴侣 B', '2024-01-01', '2024-01-01', '把普通日子过成喜欢的样子');

update couples
set partner_a_name = '伴侣 A',
    partner_b_name = '伴侣 B',
    started_on = '2024-01-01',
    anniversary_on = '2024-01-01',
    slogan = '把普通日子过成喜欢的样子'
where id = 1;

-- Initial password for both users: 123456
insert ignore into users (
    id, username, display_name, password_hash, couple_role,
    home_latitude, home_longitude, home_city, home_district, home_province, home_country,
    home_weather, home_temperature, last_online_at, updated_at
)
values
    (1, 'demo_a', '伴侣 A', '$2a$10$TpcuPT.ru2p8svo8xL3uvuOSzUS0hIFnJfswNnNfPr0gmFmnBqtMa', 'boyfriend',
     null, null, null, null, null, null,
     null, null, null, '2026-05-18 19:10:07'),
    (2, 'demo_b', '伴侣 B', '$2a$10$TpcuPT.ru2p8svo8xL3uvuOSzUS0hIFnJfswNnNfPr0gmFmnBqtMa', 'girlfriend',
     null, null, null, null, null, null,
     null, null, null, '2026-05-16 20:30:00');

start transaction;

set @old_foreign_key_checks = @@foreign_key_checks;
set foreign_key_checks = 0;

delete from diary_images;
delete from diaries;
delete from diary_uploads;
delete from album_activity;
delete from album_locks;
delete from photos;
delete from albums;
delete from moments;
delete from wishes;
delete from messages;
delete from feedback;
delete from feedback_images;
delete from notices;

set foreign_key_checks = @old_foreign_key_checks;

insert into notices (
    id, client_type, title, version, items_json, enabled, published_at, created_at, updated_at
)
values
    (9001, 'web', '样例数据已补齐', 'local-demo-1.0',
     json_array('本地库现在包含公开/私密/草稿相册。', '点滴覆盖所有分类、跨年筛选和软删除；样例不含定位。', '清单、日记、反馈也补充了典型状态。'),
     true, '2026-05-27 09:00:00', '2026-05-27 09:00:00', '2026-05-27 09:00:00'),
    (9002, 'web', '已停用公告样例', 'local-disabled-0.1',
     json_array('这条用于覆盖 enabled=false 的公告状态。'),
     false, '2026-05-20 09:00:00', '2026-05-20 09:00:00', '2026-05-20 09:00:00'),
    (9003, 'miniprogram', '小程序样例公告', 'mini-local-1.0',
     json_array('小程序公告已和 Web 公告分开。', '首页和我的页会读取小程序专属公告。'),
     true, '2026-05-27 10:00:00', '2026-05-27 10:00:00', '2026-05-27 10:00:00')
on duplicate key update
    client_type = values(client_type),
    title = values(title),
    version = values(version),
    items_json = values(items_json),
    enabled = values(enabled),
    published_at = values(published_at),
    updated_at = values(updated_at);

insert into messages (
    id, author_user_id, content, image_url, image_object_name, image_content_type,
    image_size_bytes, created_at, deleted_at
)
values
    (9601, 2, '样例｜今晚的晚霞很好看，想把这句也留在这里。', null, null, null, null, '2026-05-27 20:30:00', null),
    (9602, 1, '样例｜刚下班，在回家的路上。今天有点累，但想到等下见到你就很开心。',
     'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=900&q=80',
     'messages/seed/evening-road.webp', 'image/webp', 123456, '2026-05-27 19:40:00', null),
    (9603, 2, '样例｜这条被软删除，用于验证列表和首页摘要不返回。', null, null, null, null, '2026-05-27 18:00:00', '2026-05-27 18:30:00')
on duplicate key update
    author_user_id = values(author_user_id),
    content = values(content),
    image_url = values(image_url),
    image_object_name = values(image_object_name),
    image_content_type = values(image_content_type),
    image_size_bytes = values(image_size_bytes),
    created_at = values(created_at),
    deleted_at = values(deleted_at);

insert into wishes (
    id, title, description, category, completed, image_url, location_name, latitude, longitude,
    note, expected_completed_at, completed_at, created_at, updated_at, last_operated_by_user_id, last_operated_at
)
values
    (9101, '样例｜周末去植物园拍照', '覆盖 want_go、未完成、有图、通用地点和预计时间。', 'want_go', false,
     'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=80',
     '示例地点', null, null, '带微距镜头和驱蚊水。', '2026-06-06 09:30:00', null,
     '2026-05-27 09:10:00', '2026-05-27 09:10:00', null, null),
    (9102, '样例｜去没有计划的小城', '覆盖 want_go、未完成、无图、无坐标、无预计时间。', 'want_go', false,
     null, '未知小城', null, null, null, null, null,
     '2026-05-27 09:11:00', '2026-05-27 09:11:00', null, null),
    (9103, '样例｜一起做一次早餐', '覆盖 want_do、未完成、无图、有备注。', 'want_do', false,
     null, '家里厨房', null, null, '先从松饼开始。', '2026-06-02 08:30:00', null,
     '2026-05-27 09:12:00', '2026-05-27 09:12:00', null, null),
    (9104, '样例｜完成一场城市夜走', '覆盖 want_go、已完成、有完成时间和操作者。', 'want_go', true,
     'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=900&q=80',
     '城市夜景步道', null, null, '已经整理进点滴地图。', null, '2026-05-21 22:20:00',
     '2026-05-01 10:00:00', '2026-05-21 22:20:00', 1, '2026-05-21 22:20:00'),
    (9105, '样例｜做完一盒彩色饼干', '覆盖 want_do、已完成、有图。', 'want_do', true,
     'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=900&q=80',
     '家里厨房', null, null, '味道比外形更稳定。', null, '2026-05-19 20:10:00',
     '2026-05-02 10:00:00', '2026-05-19 20:10:00', 2, '2026-05-19 20:10:00'),
    (9106, '样例｜很久以后再完成的愿望', '覆盖远期预计完成时间。', 'want_do', false,
     null, '未来的家', null, null, '用于测试日期排序和长周期文案。', '2027-02-14 20:00:00', null,
     '2026-05-27 09:13:00', '2026-05-27 09:13:00', null, null)
on duplicate key update
    title = values(title),
    description = values(description),
    category = values(category),
    completed = values(completed),
    image_url = values(image_url),
    location_name = values(location_name),
    latitude = values(latitude),
    longitude = values(longitude),
    note = values(note),
    expected_completed_at = values(expected_completed_at),
    completed_at = values(completed_at),
    created_at = values(created_at),
    updated_at = values(updated_at),
    last_operated_by_user_id = values(last_operated_by_user_id),
    last_operated_at = values(last_operated_at);

insert into albums (
    id, title, description, cover_photo_url, author_name, created_at, event_date, location,
    view_count, like_count, visibility, private_password_hash, pinned, sort_order, status,
    published_at, created_by_user_id
)
values
    (9201, '样例｜公开置顶三图相册', '覆盖公开、置顶、多照片、preview/original 双字段。',
     'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
     '伴侣 A', '2026-05-27 09:20:00', '2026-05-20', '示例地点',
     88, 12, 'public', null, true, 1, 'published', '2026-05-27 09:20:00', 1),
    (9202, '样例｜公开普通相册', '覆盖公开、非置顶、单照片。',
     'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
     '伴侣 B', '2026-05-26 20:00:00', '2026-05-18', '示例地点',
     13, 2, 'public', null, false, 80, 'published', '2026-05-26 20:00:00', 2),
    (9203, '样例｜私密相册', '覆盖私密发布相册、密码哈希和解锁流程。',
     'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=80',
     '伴侣 B', '2026-05-25 21:00:00', '2026-05-14', '只属于我们',
     5, 1, 'private', '$2a$10$TpcuPT.ru2p8svo8xL3uvuOSzUS0hIFnJfswNnNfPr0gmFmnBqtMa', false, 90,
     'published', '2026-05-25 21:00:00', 2),
    (9204, '样例｜男生账号公开草稿', '覆盖 user_id=1 当前 draft，普通列表不可见。', '',
     '伴侣 A', '2026-05-27 09:30:00', '2026-05-27', '草稿箱',
     0, 0, 'public', null, false, 100, 'draft', null, 1),
    (9205, '样例｜女生账号私密草稿', '覆盖 user_id=2 当前 private draft，未发布且无照片。', '',
     '伴侣 B', '2026-05-27 09:31:00', '2026-05-27', '草稿箱',
     0, 0, 'private', '$2a$10$TpcuPT.ru2p8svo8xL3uvuOSzUS0hIFnJfswNnNfPr0gmFmnBqtMa', false, 100,
     'draft', null, 2)
on duplicate key update
    title = values(title),
    description = values(description),
    cover_photo_url = values(cover_photo_url),
    author_name = values(author_name),
    created_at = values(created_at),
    event_date = values(event_date),
    location = values(location),
    view_count = values(view_count),
    like_count = values(like_count),
    visibility = values(visibility),
    private_password_hash = values(private_password_hash),
    pinned = values(pinned),
    sort_order = values(sort_order),
    status = values(status),
    published_at = values(published_at),
    created_by_user_id = values(created_by_user_id);

insert into photos (
    id, album_id, caption, description, taken_at, location, sort_order, width, height,
    original_url, original_object_name, original_content_type, original_size_bytes,
    preview_url, preview_object_name, preview_content_type, preview_size_bytes
)
values
    (920101, 9201, '海边第一张', '公开相册封面候选，覆盖横图。', '2026-05-20', '示例地点', 10, 1600, 1067,
     'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=90',
     'album/9201/original/local-demo-sea-1.webp', 'image/webp', 248000,
     'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
     'album/9201/preview/local-demo-sea-1.webp', 'image/webp', 68000),
    (920102, 9201, '花店门口', '覆盖竖图附近的说明文字。', '2026-05-20', '示例地点', 20, 1067, 1600,
     'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1600&q=90',
     'album/9201/original/local-demo-flower.webp', 'image/webp', 231000,
     'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=900&q=80',
     'album/9201/preview/local-demo-flower.webp', 'image/webp', 61000),
    (920103, 9201, '夜空', '覆盖深色照片和较长描述。', '2026-05-21', '示例地点', 30, 1600, 1000,
     'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=90',
     'album/9201/original/local-demo-night.webp', 'image/webp', 288000,
     'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80',
     'album/9201/preview/local-demo-night.webp', 'image/webp', 72000),
    (920201, 9202, '窗边咖啡', '普通公开相册单图。', '2026-05-18', '示例地点', 10, 1600, 1067,
     'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1600&q=90',
     'album/9202/original/local-demo-coffee.webp', 'image/webp', 202000,
     'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
     'album/9202/preview/local-demo-coffee.webp', 'image/webp', 52000),
    (920301, 9203, '私密瞬间', '私密相册照片。', '2026-05-14', '只属于我们', 10, 1600, 1067,
     'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1600&q=90',
     'album/9203/original/local-demo-private.webp', 'image/webp', 220000,
     'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=80',
     'album/9203/preview/local-demo-private.webp', 'image/webp', 57000),
    (920401, 9204, '草稿照片', '草稿中已上传但未发布的照片。', '2026-05-27', '草稿箱', 10, 1600, 1067,
     'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1600&q=90',
     'album/9204/original/local-demo-draft.webp', 'image/webp', 200000,
     'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=900&q=80',
     'album/9204/preview/local-demo-draft.webp', 'image/webp', 51000)
on duplicate key update
    album_id = values(album_id),
    caption = values(caption),
    description = values(description),
    taken_at = values(taken_at),
    location = values(location),
    sort_order = values(sort_order),
    width = values(width),
    height = values(height),
    original_url = values(original_url),
    original_object_name = values(original_object_name),
    original_content_type = values(original_content_type),
    original_size_bytes = values(original_size_bytes),
    preview_url = values(preview_url),
    preview_object_name = values(preview_object_name),
    preview_content_type = values(preview_content_type),
    preview_size_bytes = values(preview_size_bytes);

insert into album_activity (
    album_id, user_id, activity_date, viewed, liked, first_viewed_at, liked_at, updated_at
)
values
    (9201, 1, '2026-05-27', true, false, '2026-05-27 10:00:00', null, '2026-05-27 10:00:00'),
    (9201, 2, '2026-05-27', true, false, '2026-05-27 10:05:00', null, '2026-05-27 10:05:00'),
    (9203, 2, '2026-05-27', true, true, '2026-05-27 10:10:00', '2026-05-27 10:12:00', '2026-05-27 10:12:00')
on duplicate key update
    viewed = values(viewed),
    liked = values(liked),
    first_viewed_at = values(first_viewed_at),
    liked_at = values(liked_at),
    updated_at = values(updated_at);

insert into album_locks (
    album_id, user_id, failure_count, locked_until, last_failed_at, updated_at
)
values
    (9203, 1, 2, null, '2026-05-27 10:12:00', '2026-05-27 10:12:00')
on duplicate key update
    failure_count = values(failure_count),
    locked_until = values(locked_until),
    last_failed_at = values(last_failed_at),
    updated_at = values(updated_at);

insert into diary_uploads (
    id, user_id, object_name, url, content_type, size_bytes, temporary, deleted,
    created_at, promoted_at, deleted_at
)
values
    (9301, 1, 'diary/final/local-demo-market.webp',
     'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
     'image/webp', 83000, false, false, '2026-05-27 10:20:00', '2026-05-27 10:25:00', null),
    (9302, 2, 'diary/tmp/local-demo-temp.webp',
     'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80',
     'image/webp', 76000, true, false, '2026-05-27 10:21:00', null, null),
    (9303, 1, 'diary/final/local-demo-deleted.webp',
     'https://images.unsplash.com/photo-1511407397940-d57f68e81203?auto=format&fit=crop&w=1200&q=80',
     'image/webp', 71000, false, true, '2026-05-27 10:22:00', '2026-05-27 10:23:00', '2026-05-27 10:30:00')
on duplicate key update
    user_id = values(user_id),
    object_name = values(object_name),
    url = values(url),
    content_type = values(content_type),
    size_bytes = values(size_bytes),
    temporary = values(temporary),
    deleted = values(deleted),
    promoted_at = values(promoted_at),
    deleted_at = values(deleted_at);

insert into diaries (
    id, role, author_user_id, content_markdown, title, summary, visibility, mood_key, entry_date,
    weather, raw_weather, temperature, wind_direction, wind_power, humidity,
    province, city, district, location_name, latitude, longitude,
    created_at, updated_at, deleted, deleted_at
)
values
    (9301, 'girlfriend', 2,
     '# 样例｜有图共享日记\n\n今天路过集市，买了一束很亮的花。\n\n![集市](https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80)',
     '样例｜有图共享日记', '覆盖共享日记、图片引用、天气和位置。', 'shared', 'happy', '2026-05-27',
     '晴', '晴', 26, '东南风', '2', '58', null, null, null, '集市门口', null, null,
     '2026-05-27 10:30:00', '2026-05-27 10:30:00', false, null),
    (9302, 'boyfriend', 1,
     '# 样例｜无天气私密日记\n\n这条用于覆盖私密、无天气、无坐标的详情状态。',
     '样例｜无天气私密日记', '覆盖私密日记和空天气位置。', 'private', 'calm', '2026-05-26',
     null, null, null, null, null, null, null, null, null, null, null, null,
     '2026-05-26 22:00:00', '2026-05-26 22:00:00', false, null),
    (9303, 'girlfriend', 2,
     '# 样例｜软删除日记\n\n正常列表不应看到这条。',
     '样例｜软删除日记', '覆盖 deleted=true。', 'shared', 'tired', '2026-05-25',
     '阴', '阴', 21, '北风', '3', '70', null, null, null, '旧记录', null, null,
     '2026-05-25 20:00:00', '2026-05-25 20:10:00', true, '2026-05-25 20:10:00')
on duplicate key update
    role = values(role),
    author_user_id = values(author_user_id),
    content_markdown = values(content_markdown),
    title = values(title),
    summary = values(summary),
    visibility = values(visibility),
    mood_key = values(mood_key),
    entry_date = values(entry_date),
    weather = values(weather),
    raw_weather = values(raw_weather),
    temperature = values(temperature),
    wind_direction = values(wind_direction),
    wind_power = values(wind_power),
    humidity = values(humidity),
    province = values(province),
    city = values(city),
    district = values(district),
    location_name = values(location_name),
    latitude = values(latitude),
    longitude = values(longitude),
    created_at = values(created_at),
    updated_at = values(updated_at),
    deleted = values(deleted),
    deleted_at = values(deleted_at);

insert into diary_images (
    id, diary_id, upload_id, image_url, created_at
)
values
    (9301, 9301, 9301,
     'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
     '2026-05-27 10:30:00')
on duplicate key update
    diary_id = values(diary_id),
    upload_id = values(upload_id),
    image_url = values(image_url),
    created_at = values(created_at);

insert into moments (
    id, title, content, event_time, end_time, location_name, address, longitude, latitude,
    category, images_json, created_by_user_id, created_at, updated_at, deleted_at
)
values
    (9401, '样例｜日常早餐', '', '2026-05-27 08:00:00', null, '家里厨房', '示例地点',
     null, null, 'daily', json_array(), 1, '2026-05-27 10:40:00', '2026-05-27 10:40:00', null),
    (9402, '样例｜第一次看海', '覆盖 travel、多日 endTime、三张图片。', '2026-05-01 10:00:00', '2026-05-03 18:00:00',
     '示例地点', '示例地点', null, null, 'travel',
     json_array(
       'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
       'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=900&q=80',
       'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=80'
     ),
     2, '2026-05-27 10:41:00', '2026-05-27 10:41:00', null),
    (9403, '样例｜纪念日晚餐', '覆盖 anniversary 和单图。', '2026-02-14 19:30:00', null,
     '窗边餐厅', '示例地点', null, null, 'anniversary',
     json_array('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80'),
     1, '2026-05-27 10:42:00', '2026-05-27 10:42:00', null),
    (9404, '样例｜下班后的惊喜', '覆盖 surprise 和无定位样例。', '2025-12-24 21:00:00', null,
     '城市广场', '示例地点', null, null, 'surprise',
     json_array('https://images.unsplash.com/photo-1512909006721-3d6018887383?auto=format&fit=crop&w=900&q=80'),
     2, '2026-05-27 10:43:00', '2026-05-27 10:43:00', null),
    (9405, '样例｜第一次认真约会', '覆盖 date 和 2024 年筛选。', '2024-08-18 17:20:00', null,
     '湖边长椅', '示例地点', null, null, 'date',
     json_array(), 1, '2026-05-27 10:44:00', '2026-05-27 10:44:00', null),
    (9406, '样例｜很早以前的旅行', '覆盖 2023 年筛选。', '2023-10-03 12:00:00', '2023-10-05 18:00:00',
     '山间民宿', '示例地点', null, null, 'travel',
     json_array('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80'),
     2, '2026-05-27 10:45:00', '2026-05-27 10:45:00', null),
    (9407, '样例｜软删除点滴', '正常列表和详情不应返回这条。', '2026-04-01 12:00:00', null,
     '旧地点', '示例地点', null, null, 'daily',
     json_array(), 1, '2026-05-27 10:46:00', '2026-05-27 10:47:00', '2026-05-27 10:47:00')
on duplicate key update
    title = values(title),
    content = values(content),
    event_time = values(event_time),
    end_time = values(end_time),
    location_name = values(location_name),
    address = values(address),
    longitude = values(longitude),
    latitude = values(latitude),
    category = values(category),
    images_json = values(images_json),
    created_by_user_id = values(created_by_user_id),
    created_at = values(created_at),
    updated_at = values(updated_at),
    deleted_at = values(deleted_at);

insert into feedback_images (
    id, user_id, object_name, url, content_type, size_bytes, created_at
)
values
    (9501, 1, 'feedback/local-demo-ui.webp',
     'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1000&q=80',
     'image/webp', 64000, '2026-05-27 11:00:00'),
    (9502, 2, 'feedback/local-demo-mobile.webp',
     'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80',
     'image/webp', 59000, '2026-05-27 11:01:00')
on duplicate key update
    user_id = values(user_id),
    object_name = values(object_name),
    url = values(url),
    content_type = values(content_type),
    size_bytes = values(size_bytes),
    created_at = values(created_at);

insert into feedback (
    id, user_id, type, title, content, contact, image_urls_json, page_url, user_agent,
    status, created_at, updated_at
)
values
    (9501, 1, 'bug', '样例｜相册图片加载慢', '覆盖 pending bug 反馈和截图。', 'local@example.com',
     json_array('https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1000&q=80'),
     'http://127.0.0.1:5173/albums', 'Local Seed Browser', 'pending', '2026-05-27 11:05:00', '2026-05-27 11:05:00'),
    (9502, 2, 'idea', '样例｜想要小程序提醒', '覆盖 processing idea 反馈。', null,
     json_array(), 'http://127.0.0.1:5173/wishes', 'Local Seed Browser', 'processing', '2026-05-27 11:06:00', '2026-05-27 11:08:00'),
    (9503, 2, 'other', '样例｜另一位用户反馈', '覆盖其他类型反馈和 resolved 状态。', null,
     json_array('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80'),
     'http://127.0.0.1:5173/story', 'Local Seed Browser', 'resolved', '2026-05-27 11:07:00', '2026-05-27 11:20:00')
on duplicate key update
    user_id = values(user_id),
    type = values(type),
    title = values(title),
    content = values(content),
    contact = values(contact),
    image_urls_json = values(image_urls_json),
    page_url = values(page_url),
    user_agent = values(user_agent),
    status = values(status),
    created_at = values(created_at),
    updated_at = values(updated_at);

commit;
