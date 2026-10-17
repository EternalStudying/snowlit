package xyz.snowlit.notices;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;

@Mapper
public interface NoticeMapper {

    @Select("""
            select id, client_type, title, version, items_json, enabled, published_at, created_at, updated_at
            from notices
            where enabled = true
              and client_type = #{clientType}
            order by published_at desc, id desc
            limit 1
            """)
    @Results(id = "updateNoticeMap", value = {
            @Result(column = "client_type", property = "clientType"),
            @Result(column = "items_json", property = "itemsJson"),
            @Result(column = "published_at", property = "publishedAt"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "updated_at", property = "updatedAt")
    })
    Notice findLatestEnabled(String clientType);

    @Select("""
            select muted_until
            from notice_mutes
            where user_id = #{userId}
              and client_type = #{clientType}
            limit 1
            """)
    LocalDateTime findMutedUntilByUserId(@Param("userId") Long userId, @Param("clientType") String clientType);

    @Insert("""
            insert into notice_mutes (user_id, client_type, muted_until, updated_at)
            values (#{userId}, #{clientType}, #{mutedUntil}, #{mutedUntil})
            on duplicate key update
                muted_until = values(muted_until),
                updated_at = values(updated_at)
            """)
    int upsertMute(
            @Param("userId") Long userId,
            @Param("clientType") String clientType,
            @Param("mutedUntil") LocalDateTime mutedUntil
    );
}
