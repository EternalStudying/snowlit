package xyz.snowlit.auth;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface UserMapper {

    @Select("""
            select id, username, display_name, password_hash, avatar_url, bio, mood, couple_role,
                   wechat_openid, wechat_unionid, wechat_bound_at, updated_at
            from users
            where username = #{username}
            limit 1
            """)
    @Results(id = "authUserMap", value = {
            @Result(column = "display_name", property = "displayName"),
            @Result(column = "password_hash", property = "passwordHash"),
            @Result(column = "avatar_url", property = "avatarUrl"),
            @Result(column = "couple_role", property = "coupleRole"),
            @Result(column = "wechat_openid", property = "wechatOpenid"),
            @Result(column = "wechat_unionid", property = "wechatUnionid"),
            @Result(column = "wechat_bound_at", property = "wechatBoundAt"),
            @Result(column = "updated_at", property = "updatedAt")
    })
    User findByUsername(String username);

    @Select("""
            select id, username, display_name, password_hash, avatar_url, bio, mood, couple_role,
                   wechat_openid, wechat_unionid, wechat_bound_at, updated_at
            from users
            where id = #{id}
            limit 1
            """)
    @ResultMap("authUserMap")
    User findById(Long id);

    @Select("""
            select id, username, display_name, password_hash, avatar_url, bio, mood, couple_role,
                   wechat_openid, wechat_unionid, wechat_bound_at, updated_at
            from users
            where wechat_openid = #{openid}
            limit 1
            """)
    @ResultMap("authUserMap")
    User findByWechatOpenid(String openid);

    @Update("""
            update users
            set wechat_openid = #{openid},
                wechat_unionid = #{unionid},
                wechat_bound_at = now(),
                updated_at = now()
            where id = #{id}
              and (wechat_openid is null or wechat_openid = '')
            """)
    int bindWechatOpenidIfUnbound(@Param("id") Long id,
                                  @Param("openid") String openid,
                                  @Param("unionid") String unionid);

    @Update("""
            update users
            set display_name = #{displayName},
                mood = #{mood},
                bio = #{bio},
                updated_at = now()
            where id = #{id}
            """)
    int updateProfile(@Param("id") Long id,
                      @Param("displayName") String displayName,
                      @Param("mood") String mood,
                      @Param("bio") String bio);
}
