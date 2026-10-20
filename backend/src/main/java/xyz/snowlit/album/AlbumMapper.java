package xyz.snowlit.album;

import xyz.snowlit.album.Album;
import xyz.snowlit.album.AlbumPhoto;
import xyz.snowlit.album.AlbumUnlockFailure;
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
public interface AlbumMapper {

    @Select("""
            select a.id, a.title, a.description, a.cover_photo_url, a.author_name, a.created_at,
                   a.event_date, a.location, a.view_count, a.like_count, a.visibility,
                   a.private_password_hash, a.pinned, a.sort_order, a.status, a.published_at,
                   a.created_by_user_id,
                   (select count(*) from photos p where p.album_id = a.id) as photo_count
            from albums a
            where a.status = 'published'
            order by a.pinned desc, a.sort_order asc, a.created_at desc
            limit #{size} offset #{offset}
            """)
    @Results(id = "albumMap", value = {
            @Result(column = "cover_photo_url", property = "coverPhotoUrl"),
            @Result(column = "author_name", property = "authorName"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "event_date", property = "eventDate"),
            @Result(column = "view_count", property = "viewCount"),
            @Result(column = "like_count", property = "likeCount"),
            @Result(column = "private_password_hash", property = "privatePasswordHash"),
            @Result(column = "sort_order", property = "sortOrder"),
            @Result(column = "photo_count", property = "photoCount"),
            @Result(column = "published_at", property = "publishedAt"),
            @Result(column = "created_by_user_id", property = "createdByUserId")
    })
    List<Album> findPublishedAlbums(@Param("offset") int offset, @Param("size") int size);

    @Select("select count(*) from albums where status = 'published'")
    long countPublishedAlbums();

    @Select("""
            select a.id, a.title, a.description, a.cover_photo_url, a.author_name, a.created_at,
                   a.event_date, a.location, a.view_count, a.like_count, a.visibility,
                   a.private_password_hash, a.pinned, a.sort_order, a.status, a.published_at,
                   a.created_by_user_id,
                   (select count(*) from photos p where p.album_id = a.id) as photo_count
            from albums a
            where a.id = #{albumId} and a.status = 'published'
            limit 1
            """)
    @Results(value = {
            @Result(column = "cover_photo_url", property = "coverPhotoUrl"),
            @Result(column = "author_name", property = "authorName"),
            @Result(column = "created_at", property = "createdAt"),
            @Result(column = "event_date", property = "eventDate"),
            @Result(column = "view_count", property = "viewCount"),
            @Result(column = "like_count", property = "likeCount"),
            @Result(column = "private_password_hash", property = "privatePasswordHash"),
            @Result(column = "sort_order", property = "sortOrder"),
            @Result(column = "photo_count", property = "photoCount"),
            @Result(column = "published_at", property = "publishedAt"),
            @Result(column = "created_by_user_id", property = "createdByUserId")
    })
    Album findAlbumById(Long albumId);

    @Select("""
            select id, album_id, caption, description, taken_at, location, sort_order, width, height,
                   original_url, original_object_name, original_content_type, original_size_bytes,
                   preview_url, preview_object_name, preview_content_type, preview_size_bytes
            from photos
            where album_id = #{albumId}
            order by sort_order asc, id asc
            limit #{previewLimit}
            """)
    @Results(id = "albumPhotoMap", value = {
            @Result(column = "album_id", property = "albumId"),
            @Result(column = "taken_at", property = "takenAt"),
            @Result(column = "sort_order", property = "sortOrder"),
            @Result(column = "original_url", property = "originalUrl"),
            @Result(column = "original_object_name", property = "originalObjectName"),
            @Result(column = "original_content_type", property = "originalContentType"),
            @Result(column = "original_size_bytes", property = "originalSizeBytes"),
            @Result(column = "preview_url", property = "previewUrl"),
            @Result(column = "preview_object_name", property = "previewObjectName"),
            @Result(column = "preview_content_type", property = "previewContentType"),
            @Result(column = "preview_size_bytes", property = "previewSizeBytes")
    })
    List<AlbumPhoto> findPreviewPhotos(@Param("albumId") Long albumId, @Param("previewLimit") int previewLimit);

    @Select("""
            select id, album_id, caption, description, taken_at, location, sort_order, width, height,
                   original_url, original_object_name, original_content_type, original_size_bytes,
                   preview_url, preview_object_name, preview_content_type, preview_size_bytes
            from photos
            where album_id = #{albumId}
            order by sort_order asc, id asc
            """)
    @Results(value = {
            @Result(column = "album_id", property = "albumId"),
            @Result(column = "taken_at", property = "takenAt"),
            @Result(column = "sort_order", property = "sortOrder"),
            @Result(column = "original_url", property = "originalUrl"),
            @Result(column = "original_object_name", property = "originalObjectName"),
            @Result(column = "original_content_type", property = "originalContentType"),
            @Result(column = "original_size_bytes", property = "originalSizeBytes"),
            @Result(column = "preview_url", property = "previewUrl"),
            @Result(column = "preview_object_name", property = "previewObjectName"),
            @Result(column = "preview_content_type", property = "previewContentType"),
            @Result(column = "preview_size_bytes", property = "previewSizeBytes")
    })
    List<AlbumPhoto> findPhotosByAlbumId(Long albumId);

    @Select("""
            select id, album_id, caption, description, taken_at, location, sort_order, width, height,
                   original_url, original_object_name, original_content_type, original_size_bytes,
                   preview_url, preview_object_name, preview_content_type, preview_size_bytes
            from photos
            where id = #{photoId}
            limit 1
            """)
    @ResultMap("albumPhotoMap")
    AlbumPhoto findPhotoById(Long photoId);

    @Select("""
            select id, album_id, caption, description, taken_at, location, sort_order, width, height,
                   original_url, original_object_name, original_content_type, original_size_bytes,
                   preview_url, preview_object_name, preview_content_type, preview_size_bytes
            from photos
            where album_id = #{albumId}
            order by sort_order asc, id asc
            limit 1
            """)
    @ResultMap("albumPhotoMap")
    AlbumPhoto findFirstPhotoByAlbumId(Long albumId);

    @Select("select count(*) from photos where album_id = #{albumId}")
    int countPhotosByAlbumId(Long albumId);

    @Insert("""
            insert into albums (
                title, description, cover_photo_url, author_name, created_at, event_date, location,
                view_count, like_count, visibility, private_password_hash, pinned, sort_order,
                status, published_at, created_by_user_id
            )
            values (
                #{title}, #{description}, #{coverPhotoUrl}, #{authorName}, #{createdAt}, #{eventDate}, #{location},
                #{viewCount}, #{likeCount}, #{visibility}, #{privatePasswordHash}, #{pinned}, #{sortOrder},
                #{status}, #{publishedAt}, #{createdByUserId}
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertAlbum(Album album);

    @Insert("""
            insert into photos (
                album_id, caption, description, taken_at, location,
                sort_order, width, height,
                original_url, original_object_name, original_content_type, original_size_bytes,
                preview_url, preview_object_name, preview_content_type, preview_size_bytes
            )
            values (
                #{albumId}, #{caption}, #{description}, #{takenAt}, #{location},
                #{sortOrder}, #{width}, #{height},
                #{originalUrl}, #{originalObjectName}, #{originalContentType}, #{originalSizeBytes},
                #{previewUrl}, #{previewObjectName}, #{previewContentType}, #{previewSizeBytes}
            )
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    int insertPhoto(AlbumPhoto photo);

    @Update("update albums set like_count = like_count + 1 where id = #{albumId}")
    int incrementLike(Long albumId);

    @Update("update albums set like_count = greatest(like_count - 1, 0) where id = #{albumId}")
    int decrementLike(Long albumId);

    @Update("update albums set view_count = view_count + 1 where id = #{albumId}")
    int incrementView(Long albumId);

    @Select("""
            <script>
            select album_id
            from album_activity
            where user_id = #{userId}
              and activity_date = #{likeDate}
              and liked = true
              and album_id in
              <foreach collection="albumIds" item="albumId" open="(" separator="," close=")">
                #{albumId}
              </foreach>
            </script>
            """)
    List<Long> findActiveDailyLikeAlbumIds(@Param("userId") Long userId,
                                           @Param("likeDate") LocalDate likeDate,
                                           @Param("albumIds") List<Long> albumIds);

    @Select("""
            select liked
            from album_activity
            where album_id = #{albumId} and user_id = #{userId} and activity_date = #{likeDate}
            limit 1
            """)
    Boolean findDailyLikeActive(@Param("albumId") Long albumId,
                                @Param("userId") Long userId,
                                @Param("likeDate") LocalDate likeDate);





    /**
     * Flips today's like for the user, creating the activity row as liked when absent.
     * Assignments run left to right, so liked_at reads the previous liked value.
     */
    @Insert("""
            insert into album_activity (
                album_id, user_id, activity_date, viewed, liked, first_viewed_at, liked_at, updated_at
            )
            values (
                #{albumId}, #{userId}, #{day}, false, true, null, #{now}, #{now}
            )
            on duplicate key update
                liked_at = if(album_activity.liked, album_activity.liked_at, values(liked_at)),
                updated_at = values(updated_at),
                liked = not album_activity.liked
            """)
    void toggleDailyLike(@Param("albumId") Long albumId,
                         @Param("userId") Long userId,
                         @Param("day") LocalDate day,
                         @Param("now") LocalDateTime now);

    /**
     * @return 1 when this call created today's viewed activity row
     */
    @Insert("""
            insert ignore into album_activity (
                album_id, user_id, activity_date, viewed, liked, first_viewed_at, liked_at, updated_at
            )
            values (
                #{albumId}, #{userId}, #{day}, true, false, #{now}, null, #{now}
            )
            """)
    int insertDailyView(@Param("albumId") Long albumId,
                        @Param("userId") Long userId,
                        @Param("day") LocalDate day,
                        @Param("now") LocalDateTime now);

    /**
     * @return 1 when this call marked an existing (like-only) activity row as viewed
     */
    @Update("""
            update album_activity
            set viewed = true, first_viewed_at = #{now}, updated_at = #{now}
            where album_id = #{albumId} and user_id = #{userId} and activity_date = #{day} and viewed = false
            """)
    int markDailyViewed(@Param("albumId") Long albumId,
                        @Param("userId") Long userId,
                        @Param("day") LocalDate day,
                        @Param("now") LocalDateTime now);

    @Select("""
            select album_id, user_id, failure_count, locked_until
            from album_locks
            where album_id = #{albumId} and user_id = #{userId}
            limit 1
            """)
    @Results(value = {
            @Result(column = "album_id", property = "albumId"),
            @Result(column = "user_id", property = "userId"),
            @Result(column = "failure_count", property = "failureCount"),
            @Result(column = "locked_until", property = "lockedUntil")
    })
    AlbumUnlockFailure findUnlockFailure(@Param("albumId") Long albumId, @Param("userId") Long userId);

    @Insert("""
            insert into album_locks (
                album_id, user_id, failure_count, locked_until, last_failed_at, updated_at
            )
            values (
                #{albumId}, #{userId}, #{failureCount}, #{lockedUntil}, #{lastFailedAt}, #{updatedAt}
            )
            on duplicate key update
                failure_count = values(failure_count),
                locked_until = values(locked_until),
                last_failed_at = values(last_failed_at),
                updated_at = values(updated_at)
            """)
    int recordUnlockFailure(@Param("albumId") Long albumId,
                            @Param("userId") Long userId,
                            @Param("failureCount") int failureCount,
                            @Param("lockedUntil") LocalDateTime lockedUntil,
                            @Param("lastFailedAt") LocalDateTime lastFailedAt,
                            @Param("updatedAt") LocalDateTime updatedAt);

    @Delete("delete from album_locks where album_id = #{albumId} and user_id = #{userId}")
    int clearUnlockFailure(@Param("albumId") Long albumId, @Param("userId") Long userId);

    @Select("""
            select p.id, p.album_id, p.preview_url, p.caption, p.taken_at
            from photos p
            join albums a on a.id = p.album_id
            where a.visibility = 'public' and a.status = 'published'
            order by p.taken_at desc, p.id desc
            limit 1
            """)
    @Results(id = "latestPublicPhotoMap", value = {
            @Result(column = "album_id", property = "albumId"),
            @Result(column = "preview_url", property = "previewUrl"),
            @Result(column = "taken_at", property = "takenAt")
    })
    AlbumPhoto findLatestPublicPhoto();

    @Select("select count(*) from photos p join albums a on a.id = p.album_id where a.status = 'published'")
    long countAllPhotos();
}
