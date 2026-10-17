package xyz.snowlit.home;

import xyz.snowlit.album.AlbumPhoto;
import xyz.snowlit.diary.DiaryEntry;
import xyz.snowlit.messages.Message;
import xyz.snowlit.wishes.Wish;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface HomeMapper {

    @Select("""
            select id, partner_a_name, partner_b_name, started_on, anniversary_on, slogan
            from couples
            order by id
            limit 1
            """)
    @Results(id = "homeCoupleMap", value = {
            @Result(column = "partner_a_name", property = "personA"),
            @Result(column = "partner_b_name", property = "personB"),
            @Result(column = "started_on", property = "startDate"),
            @Result(column = "anniversary_on", property = "anniversaryDate")
    })
    Couple findCouple();

    @Select("""
            select couple_role
            from users
            where id = #{userId}
            limit 1
            """)
    String findRoleByUserId(Long userId);

    @Select("""
            select id as user_id, couple_role as role,
                   home_latitude as latitude, home_longitude as longitude,
                   home_city as city, home_district as district, home_province as province,
                   home_country as country, home_weather as weather, home_temperature as temperature,
                   last_online_at
            from users
            where couple_role = #{role}
            limit 1
            """)
    @Results(id = "homeUserLocationMap", value = {
            @Result(column = "user_id", property = "userId"),
            @Result(column = "last_online_at", property = "lastOnlineAt")
    })
    HomeLocation findLocationByRole(String role);

    @Update("""
            update users
            set couple_role = #{role},
                home_latitude = #{latitude},
                home_longitude = #{longitude},
                home_city = #{city},
                home_district = #{district},
                home_province = #{province},
                home_country = #{country},
                home_weather = #{weather},
                home_temperature = #{temperature},
                last_online_at = #{lastOnlineAt}
            where id = #{userId}
            """)
    int upsertLocation(HomeLocation location);

    @Select("""
            select id, title, summary, mood_key, entry_date
            from diaries
            where deleted = false
              and visibility = 'shared'
            order by entry_date desc, updated_at desc, id desc
            limit 1
            """)
    @Results(id = "homeLatestDiaryMap", value = {
            @Result(column = "mood_key", property = "moodKey"),
            @Result(column = "entry_date", property = "entryDate")
    })
    DiaryEntry findLatestDiary();

    @Select("""
            select p.id, p.album_id, p.preview_url, p.original_url, p.caption, p.description,
                   p.taken_at, p.location, p.sort_order, p.width, p.height
            from photos p
            join albums a on a.id = p.album_id
            where a.visibility = 'public'
            order by p.taken_at desc, p.id desc
            limit 1
            """)
    @Results(id = "homeLatestPhotoMap", value = {
            @Result(column = "album_id", property = "albumId"),
            @Result(column = "preview_url", property = "previewUrl"),
            @Result(column = "original_url", property = "originalUrl"),
            @Result(column = "taken_at", property = "takenAt"),
            @Result(column = "sort_order", property = "sortOrder")
    })
    AlbumPhoto findLatestPhoto();

    @Select("""
            select id, title, category, completed, image_url, created_at, completed_at
            from wishes
            order by created_at desc, id desc
            limit 1
            """)
    Wish findLatestWish();

    @Select("""
            select m.id, m.author_user_id, coalesce(u.display_name, u.username) as author_name,
                   m.content, m.created_at
            from messages m
            left join users u on u.id = m.author_user_id
            where m.deleted_at is null
            order by m.created_at desc, m.id desc
            limit 1
            """)
    @Results(id = "homeLatestMessageMap", value = {
            @Result(column = "author_user_id", property = "authorUserId"),
            @Result(column = "author_name", property = "authorName"),
            @Result(column = "created_at", property = "createdAt")
    })
    Message findLatestMessage();

    @Select("select count(*) from photos")
    long countPhotos();

    @Select("select count(*) from wishes")
    long countWishes();

    @Select("select count(*) from wishes where completed = true")
    long countCompletedWishes();

    @Select("select count(*) from messages where deleted_at is null")
    long countMessages();
}
