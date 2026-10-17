package xyz.snowlit.story;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface StoryMapper {

    @Select("""
            <script>
            select id, title, content, event_time, end_time, location_name, address, longitude, latitude,
                   category, images_json, created_by_user_id,
                   created_at, updated_at, deleted_at
            from moments
            where deleted_at is null
            <if test="category != null">
              and category = #{category}
            </if>
            <if test="year != null">
              and year(event_time) = #{year}
            </if>
            order by event_time asc, id asc
            </script>
            """)
    @Results(id = "storyMomentMap", value = {
            @Result(column = "event_time", property = "eventTime"),
            @Result(column = "end_time", property = "endTime"),
            @Result(column = "location_name", property = "locationName"),
            @Result(column = "images_json", property = "imagesJson"),
            @Result(column = "created_by_user_id", property = "createdByUserId"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "updated_at", property = "updatedAt"),
            @Result(column = "deleted_at", property = "deletedAt")
    })
    List<StoryMoment> findMoments(@Param("category") String category, @Param("year") Integer year);

    @Select("""
            select id, title, content, event_time, end_time, location_name, address, longitude, latitude,
                   category, images_json, created_by_user_id,
                   created_at, updated_at, deleted_at
            from moments
            where id = #{id}
            limit 1
            """)
    @Results(value = {
            @Result(column = "event_time", property = "eventTime"),
            @Result(column = "end_time", property = "endTime"),
            @Result(column = "location_name", property = "locationName"),
            @Result(column = "images_json", property = "imagesJson"),
            @Result(column = "created_by_user_id", property = "createdByUserId"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "updated_at", property = "updatedAt"),
            @Result(column = "deleted_at", property = "deletedAt")
    })
    StoryMoment findMomentById(Long id);

    @Select("""
            select distinct year(event_time)
            from moments
            where deleted_at is null
            order by year(event_time) desc
            """)
    List<Integer> findAvailableYears();

    @Insert("""
            insert into moments (
                title, content, event_time, end_time, location_name, address, longitude, latitude,
                category, images_json, created_by_user_id,
                created_at, updated_at
            )
            values (
                #{title}, #{content}, #{eventTime}, #{endTime}, #{locationName}, #{address}, #{longitude}, #{latitude},
                #{category}, #{imagesJson}, #{createdByUserId},
                #{createdAt}, #{updatedAt}
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertMoment(StoryMoment moment);

    @Update("""
            update moments
            set title = #{title},
                content = #{content},
                event_time = #{eventTime},
                end_time = #{endTime},
                location_name = #{locationName},
                address = #{address},
                longitude = #{longitude},
                latitude = #{latitude},
                category = #{category},
                images_json = #{imagesJson},
                updated_at = #{updatedAt}
            where id = #{id}
              and deleted_at is null
            """)
    int updateMoment(StoryMoment moment);

    @Update("""
            update moments
            set deleted_at = #{deletedAt},
                updated_at = #{deletedAt}
            where id = #{id}
              and deleted_at is null
            """)
    int softDeleteMoment(@Param("id") Long id, @Param("deletedAt") LocalDateTime deletedAt);
}
