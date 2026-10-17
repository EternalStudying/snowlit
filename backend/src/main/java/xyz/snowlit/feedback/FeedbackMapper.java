package xyz.snowlit.feedback;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface FeedbackMapper {

    @Insert("""
            insert into feedback_images (
                user_id, object_name, url, content_type, size_bytes, created_at
            )
            values (
                #{userId}, #{objectName}, #{url}, #{contentType}, #{sizeBytes}, #{createdAt}
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertImage(FeedbackImage image);

    @Select("""
            <script>
            select id, user_id, object_name, url, content_type, size_bytes, created_at
            from feedback_images
            where url in
            <foreach item="url" collection="urls" open="(" separator="," close=")">
                #{url}
            </foreach>
            </script>
            """)
    @Results(id = "feedbackImageMap", value = {
            @Result(column = "user_id", property = "userId"),
            @Result(column = "object_name", property = "objectName"),
            @Result(column = "content_type", property = "contentType"),
            @Result(column = "size_bytes", property = "sizeBytes"),
            @Result(column = "created_at", property = "createdAt")
    })
    List<FeedbackImage> findImagesByUrls(@Param("urls") List<String> urls);

    @Insert("""
            insert into feedback (
                user_id, type, title, content, contact, image_urls_json,
                page_url, user_agent, status, created_at, updated_at
            )
            values (
                #{userId}, #{type}, #{title}, #{content}, #{contact}, #{imageUrlsJson},
                #{pageUrl}, #{userAgent}, #{status}, #{createdAt}, #{updatedAt}
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertFeedback(Feedback feedback);
}
