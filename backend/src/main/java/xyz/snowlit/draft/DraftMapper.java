package xyz.snowlit.draft;

import org.apache.ibatis.annotations.*;
import java.time.LocalDateTime;

@Mapper
public interface DraftMapper {
    @Select("select * from drafts where user_id = #{userId} and kind = #{kind}")
    Draft find(@Param("userId") Long userId, @Param("kind") String kind);

    @Select("select * from drafts where user_id = #{userId} and kind = #{kind} for update")
    Draft lock(@Param("userId") Long userId, @Param("kind") String kind);

    // The unique key serializes concurrent first saves/uploads without replacing either JSON column.
    @Insert("""
            insert into drafts (user_id, kind, fields_json, images_json, created_at, updated_at)
            values (#{userId}, #{kind}, '{}', '[]', #{now}, #{now})
            on duplicate key update id = drafts.id
            """)
    void ensure(@Param("userId") Long userId, @Param("kind") String kind, @Param("now") LocalDateTime now);

    @Update("update drafts set fields_json = #{fields}, updated_at = #{now} where id = #{id}")
    void saveFields(@Param("id") Long id, @Param("fields") String fields, @Param("now") LocalDateTime now);

    @Update("update drafts set images_json = #{images}, updated_at = #{now} where id = #{id}")
    void saveImages(@Param("id") Long id, @Param("images") String images, @Param("now") LocalDateTime now);

    @Delete("delete from drafts where id = #{id}")
    void delete(Long id);
}
