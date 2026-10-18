package xyz.snowlit.messages;
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
public interface MessageMapper {

    @Select("""
            select count(*)
            from messages
            where deleted_at is null
            """)
    long countMessages();

    @Select("""
            select m.id, m.author_user_id, coalesce(u.display_name, u.username) as author_name,
                   m.content, m.image_url, m.image_object_name, m.image_content_type,
                   m.image_size_bytes, m.created_at, m.deleted_at
            from messages m
            left join users u on u.id = m.author_user_id
            where m.deleted_at is null
            order by m.created_at desc, m.id desc
            limit #{size} offset #{offset}
            """)
    @Results(id = "messageMap", value = {
            @Result(column = "author_user_id", property = "authorUserId"),
            @Result(column = "author_name", property = "authorName"),
            @Result(column = "image_url", property = "imageUrl"),
            @Result(column = "image_object_name", property = "imageObjectName"),
            @Result(column = "image_content_type", property = "imageContentType"),
            @Result(column = "image_size_bytes", property = "imageSizeBytes"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "deleted_at", property = "deletedAt")
    })
    List<Message> findMessages(@Param("offset") int offset, @Param("size") int size);

    @Select("""
            select m.id, m.author_user_id, coalesce(u.display_name, u.username) as author_name,
                   m.content, m.image_url, m.image_object_name, m.image_content_type,
                   m.image_size_bytes, m.created_at, m.deleted_at
            from messages m
            left join users u on u.id = m.author_user_id
            where m.id = #{id}
            limit 1
            """)
    @Results(id = "messageByIdMap", value = {
            @Result(column = "author_user_id", property = "authorUserId"),
            @Result(column = "author_name", property = "authorName"),
            @Result(column = "image_url", property = "imageUrl"),
            @Result(column = "image_object_name", property = "imageObjectName"),
            @Result(column = "image_content_type", property = "imageContentType"),
            @Result(column = "image_size_bytes", property = "imageSizeBytes"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "deleted_at", property = "deletedAt")
    })
    Message findMessageById(Long id);

    @Insert("""
            insert into messages (
                author_user_id, content, image_url, image_object_name, image_content_type,
                image_size_bytes, created_at, deleted_at
            )
            values (
                #{authorUserId}, #{content}, #{imageUrl}, #{imageObjectName}, #{imageContentType},
                #{imageSizeBytes}, #{createdAt}, #{deletedAt}
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertMessage(Message message);

    @Update("""
            update messages
            set deleted_at = #{deletedAt}
            where id = #{id}
              and deleted_at is null
            """)
    int softDeleteMessage(@Param("id") Long id, @Param("deletedAt") LocalDateTime deletedAt);

    @Select("""
            select m.id, m.author_user_id, coalesce(u.display_name, u.username) as author_name,
                   m.content, m.created_at
            from messages m
            left join users u on u.id = m.author_user_id
            where m.deleted_at is null
            order by m.created_at desc, m.id desc
            limit 1
            """)
    @Results(id = "latestMessageMap", value = {
            @Result(column = "author_user_id", property = "authorUserId"),
            @Result(column = "author_name", property = "authorName"),
            @Result(column = "created_at", property = "createdAt")
    })
    Message findLatest();
}
