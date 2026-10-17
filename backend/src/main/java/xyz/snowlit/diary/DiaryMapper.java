package xyz.snowlit.diary;

import xyz.snowlit.diary.DiaryEntry;
import xyz.snowlit.diary.DiaryImage;
import xyz.snowlit.diary.DiaryImageReference;
import xyz.snowlit.diary.DiaryMonthCount;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface DiaryMapper {

    @Select("""
            <script>
            select year(entry_date) as entry_year,
                   month(entry_date) as entry_month,
                   count(*) as entry_count
            from diaries
            where deleted = false
              and (visibility = 'shared' or author_user_id = #{userId})
            <if test="year != null">
              and year(entry_date) = #{year}
            </if>
            group by year(entry_date), month(entry_date)
            order by year(entry_date) desc, month(entry_date) asc
            </script>
            """)
    @Results(value = {
            @Result(column = "entry_year", property = "year"),
            @Result(column = "entry_month", property = "month"),
            @Result(column = "entry_count", property = "count")
    })
    List<DiaryMonthCount> findVisibleMonthCounts(@Param("userId") Long userId,
                                                 @Param("role") String role,
                                                 @Param("year") Integer year);

    @Select("""
            select d.*, u.display_name as author_name
            from diaries d
            join users u on u.id = d.author_user_id
            where d.deleted = false
              and d.entry_date >= #{start}
              and d.entry_date < #{end}
              and (d.visibility = 'shared' or d.author_user_id = #{userId})
            order by d.entry_date desc, d.created_at desc, d.id desc
            """)
    @Results(id = "diaryEntryMap", value = {
            @Result(column = "author_user_id", property = "authorUserId"),
            @Result(column = "author_name", property = "authorName"),
            @Result(column = "content_markdown", property = "contentMarkdown"),
            @Result(column = "entry_date", property = "entryDate"),
            @Result(column = "mood_key", property = "moodKey"),
            @Result(column = "raw_weather", property = "rawWeather"),
            @Result(column = "wind_direction", property = "windDirection"),
            @Result(column = "wind_power", property = "windPower"),
            @Result(column = "location_name", property = "locationName"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "updated_at", property = "updatedAt"),
            @Result(column = "deleted_at", property = "deletedAt")
    })
    List<DiaryEntry> findVisibleEntriesByMonth(@Param("userId") Long userId,
                                               @Param("role") String role,
                                               @Param("start") LocalDate start,
                                               @Param("end") LocalDate end);

    @Select("""
            select d.*, u.display_name as author_name
            from diaries d
            join users u on u.id = d.author_user_id
            where d.id = #{id}
            limit 1
            """)
    @Results(value = {
            @Result(column = "author_user_id", property = "authorUserId"),
            @Result(column = "author_name", property = "authorName"),
            @Result(column = "content_markdown", property = "contentMarkdown"),
            @Result(column = "entry_date", property = "entryDate"),
            @Result(column = "mood_key", property = "moodKey"),
            @Result(column = "raw_weather", property = "rawWeather"),
            @Result(column = "wind_direction", property = "windDirection"),
            @Result(column = "wind_power", property = "windPower"),
            @Result(column = "location_name", property = "locationName"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "updated_at", property = "updatedAt"),
            @Result(column = "deleted_at", property = "deletedAt")
    })
    DiaryEntry findDiaryById(Long id);

    @Select("""
            <script>
            select count(*) > 0
            from diaries
            where deleted = false
              and role = #{role}
              and entry_date = #{date}
            <if test="excludedId != null">
              and id != #{excludedId}
            </if>
            </script>
            """)
    boolean existsActiveDiaryForRoleAndDate(@Param("role") String role,
                                            @Param("date") LocalDate date,
                                            @Param("excludedId") Long excludedId);

    @Insert("""
            insert into diaries (
                role, author_user_id, content_markdown, title, summary, visibility, mood_key, entry_date,
                weather, raw_weather, temperature, wind_direction, wind_power, humidity,
                province, city, district, location_name, latitude, longitude,
                created_at, updated_at, deleted
            )
            values (
                #{role}, #{authorUserId}, #{contentMarkdown}, #{title}, #{summary}, #{visibility}, #{moodKey}, #{entryDate},
                #{weather}, #{rawWeather}, #{temperature}, #{windDirection}, #{windPower}, #{humidity},
                #{province}, #{city}, #{district}, #{locationName}, #{latitude}, #{longitude},
                #{createdAt}, #{updatedAt}, false
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertDiary(DiaryEntry diary);

    @Update("""
            update diaries
            set content_markdown = #{contentMarkdown},
                title = #{title},
                summary = #{summary},
                visibility = #{visibility},
                mood_key = #{moodKey},
                updated_at = #{updatedAt}
            where id = #{id}
            """)
    int updateDiary(DiaryEntry diary);

    @Update("""
            update diaries
            set deleted = true,
                deleted_at = #{deletedAt},
                updated_at = #{deletedAt}
            where id = #{id}
            """)
    int softDeleteDiary(@Param("id") Long id, @Param("deletedAt") LocalDateTime deletedAt);

    @Select("""
            select image_url
            from diary_images
            where diary_id = #{diaryId}
            order by id asc
            """)
    List<String> findImageUrlsByDiaryId(Long diaryId);

    @Select("""
            <script>
            select diary_id, image_url
            from diary_images
            where diary_id in
            <foreach item="diaryId" collection="diaryIds" open="(" separator="," close=")">
                #{diaryId}
            </foreach>
            order by diary_id asc, id asc
            </script>
            """)
    @Results(value = {
            @Result(column = "diary_id", property = "diaryId"),
            @Result(column = "image_url", property = "imageUrl")
    })
    List<DiaryImageReference> findImageUrlsByDiaryIds(@Param("diaryIds") List<Long> diaryIds);

    @Select("""
            <script>
            select id, user_id as uploader_user_id, object_name, url, content_type, size_bytes,
                   temporary, deleted, created_at, promoted_at, deleted_at
            from diary_uploads
            where url in
            <foreach item="url" collection="urls" open="(" separator="," close=")">
                #{url}
            </foreach>
            </script>
            """)
    @Results(id = "diaryImageMap", value = {
            @Result(column = "uploader_user_id", property = "uploaderUserId"),
            @Result(column = "object_name", property = "objectName"),
            @Result(column = "content_type", property = "contentType"),
            @Result(column = "size_bytes", property = "sizeBytes"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "promoted_at", property = "promotedAt"),
            @Result(column = "deleted_at", property = "deletedAt")
    })
    List<DiaryImage> findImagesByUrls(@Param("urls") List<String> urls);

    @Select("""
            select i.id, i.user_id as uploader_user_id, i.object_name, i.url, i.content_type, i.size_bytes,
                   i.temporary, i.deleted, i.created_at, i.promoted_at, i.deleted_at
            from diary_images r
            join diary_uploads i on i.id = r.upload_id
            where r.diary_id = #{diaryId}
            order by r.id asc
            """)
    @Results(value = {
            @Result(column = "uploader_user_id", property = "uploaderUserId"),
            @Result(column = "object_name", property = "objectName"),
            @Result(column = "content_type", property = "contentType"),
            @Result(column = "size_bytes", property = "sizeBytes"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "promoted_at", property = "promotedAt"),
            @Result(column = "deleted_at", property = "deletedAt")
    })
    List<DiaryImage> findImagesReferencedByDiary(Long diaryId);

    @Select("""
            select id, user_id as uploader_user_id, object_name, url, content_type, size_bytes,
                   temporary, deleted, created_at, promoted_at, deleted_at
            from diary_uploads
            where temporary = true
              and deleted = false
              and created_at < #{before}
            """)
    @ResultMap("diaryImageMap")
    List<DiaryImage> findExpiredTemporaryImages(@Param("before") LocalDateTime before);

    @Select("""
            select count(*)
            from diary_images r
            join diaries d on d.id = r.diary_id
            where r.upload_id = #{uploadId}
              and d.deleted = false
            """)
    int countActiveReferencesForUpload(Long uploadId);

    @Insert("""
            insert into diary_uploads (
                user_id, object_name, url, content_type, size_bytes,
                temporary, deleted, created_at
            )
            values (
                #{uploaderUserId}, #{objectName}, #{url}, #{contentType}, #{sizeBytes},
                #{temporary}, false, #{createdAt}
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertImage(DiaryImage image);

    @Update("""
            <script>
            update diary_uploads
            set temporary = false,
                promoted_at = #{promotedAt}
            where id in
            <foreach item="id" collection="ids" open="(" separator="," close=")">
                #{id}
            </foreach>
            </script>
            """)
    int markImagesPermanent(@Param("ids") List<Long> ids, @Param("promotedAt") LocalDateTime promotedAt);

    @Update("""
            update diary_uploads
            set deleted = true,
                deleted_at = #{deletedAt}
            where id = #{uploadId}
            """)
    int markUploadDeleted(@Param("uploadId") Long uploadId, @Param("deletedAt") LocalDateTime deletedAt);

    @Delete("delete from diary_images where diary_id = #{diaryId}")
    int deleteImageReferences(Long diaryId);

    @Insert("""
            <script>
            insert into diary_images (diary_id, upload_id, image_url, created_at)
            values
            <foreach item="reference" collection="references" separator=",">
                (#{diaryId}, #{reference.uploadId}, #{reference.imageUrl}, #{reference.createdAt})
            </foreach>
            </script>
            """)
    int insertImageReferences(@Param("diaryId") Long diaryId, @Param("references") List<DiaryImageReference> references);

    default void replaceImageReferences(Long diaryId, List<DiaryImageReference> references) {
        deleteImageReferences(diaryId);
        if (references != null && !references.isEmpty()) {
            insertImageReferences(diaryId, references);
        }
    }
}
