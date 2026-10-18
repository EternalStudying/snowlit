package xyz.snowlit.support;

import xyz.snowlit.auth.User;
import xyz.snowlit.auth.UserMapper;

/**
 * UserMapper holding at most one user, for request-identity tests.
 */
public final class SingleUserMapper implements UserMapper {

    private User user;

    public SingleUserMapper(User user) {
        this.user = user;
    }

    public void replace(User user) {
        this.user = user;
    }

    @Override
    public User findByUsername(String username) {
        return user;
    }

    @Override
    public User findById(Long id) {
        return user != null && user.getId().equals(id) ? user : null;
    }

    @Override
    public User findByWechatOpenid(String openid) {
        return null;
    }

    @Override
    public int bindWechatOpenidIfUnbound(Long id, String openid, String unionid) {
        return 0;
    }

    @Override
    public int updateProfile(Long id, String displayName, String mood, String bio) {
        return 0;
    }
}
