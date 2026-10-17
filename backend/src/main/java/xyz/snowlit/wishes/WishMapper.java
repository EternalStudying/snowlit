package xyz.snowlit.wishes;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface WishMapper {

    @Select("""
            <script>
            select count(*)
            from wishes
            where completed = #{completed}
            <if test="category != null">
                and category = #{category}
            </if>
            </script>
            """)
    long countWishes(@Param("category") String category, @Param("completed") boolean completed);

    @Select("""
            <script>
            select id, title, category, completed, image_url, created_at, completed_at
            from wishes
            where completed = #{completed}
            <if test="category != null">
                and category = #{category}
            </if>
            <choose>
                <when test="completed">
                    order by completed_at desc, id desc
                </when>
                <otherwise>
                    order by created_at desc, id desc
                </otherwise>
            </choose>
            limit #{size} offset #{offset}
            </script>
            """)
    List<Wish> findWishes(@Param("category") String category,
                              @Param("completed") boolean completed,
                              @Param("offset") int offset,
                              @Param("size") int size);

    @Select("""
            select id, title, description, category, completed, image_url, location_name,
                   latitude, longitude, note, expected_completed_at, completed_at,
                   created_at, updated_at, last_operated_by_user_id, last_operated_at
            from wishes
            where id = #{id}
            limit 1
            """)
    Wish findWishById(Long id);

    @Insert("""
            insert into wishes (
                title, description, category, completed, image_url, location_name,
                latitude, longitude, note, expected_completed_at, completed_at,
                created_at, updated_at, last_operated_by_user_id, last_operated_at
            )
            values (
                #{title}, #{description}, #{category}, #{completed}, #{imageUrl}, #{locationName},
                #{latitude}, #{longitude}, #{note}, #{expectedCompletedAt}, #{completedAt},
                #{createdAt}, #{updatedAt}, #{lastOperatedByUserId}, #{lastOperatedAt}
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertWish(Wish wish);

    @Update("""
            update wishes
            set completed = true,
                image_url = #{imageUrl},
                completed_at = #{operatedAt},
                updated_at = #{operatedAt},
                last_operated_by_user_id = #{userId},
                last_operated_at = #{operatedAt}
            where id = #{id}
            """)
    int completeWish(@Param("id") Long id,
                     @Param("userId") Long userId,
                     @Param("operatedAt") LocalDateTime operatedAt,
                     @Param("imageUrl") String imageUrl);

    @Update("""
            update wishes
            set completed = false,
                completed_at = null,
                updated_at = #{operatedAt},
                last_operated_by_user_id = #{userId},
                last_operated_at = #{operatedAt}
            where id = #{id}
            """)
    int reopenWish(@Param("id") Long id,
                   @Param("userId") Long userId,
                   @Param("operatedAt") LocalDateTime operatedAt);

    @Update("""
            update wishes
            set title = #{title},
                description = #{description},
                category = #{category},
                location_name = #{locationName},
                note = #{note},
                expected_completed_at = #{expectedCompletedAt},
                updated_at = #{updatedAt},
                last_operated_by_user_id = #{lastOperatedByUserId},
                last_operated_at = #{lastOperatedAt}
            where id = #{id}
            """)
    int updateWish(Wish wish);

    @Delete("delete from wishes where id = #{id}")
    int deleteWish(Long id);
}
