package xyz.snowlit.album;

import xyz.snowlit.infrastructure.album.RedisAlbumPrivateAccessTokenStore;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AlbumPrivateAccessTests {
    @Test void oldTokensAndTokensWithAnEarlierPasswordStampAreInvalidAndNewUnlockWorks() {
        var redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked") ValueOperations<String,String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        Map<String,String> data = new HashMap<>();
        doAnswer(i -> {data.put(i.getArgument(0),i.getArgument(1));return null;}).when(values).set(anyString(),anyString(),any(Duration.class));
        when(values.get(anyString())).thenAnswer(i -> data.get(i.getArgument(0)));
        var store = new RedisAlbumPrivateAccessTokenStore(redis);
        var passwords = new BCryptPasswordEncoder();
        Album album = new Album(); album.setId(1L); album.setStatus("published"); album.setVisibility("private"); album.setPrivatePasswordHash(passwords.encode("fixture-password"));
        var mapper = mock(AlbumMapper.class); when(mapper.findAlbumById(1L)).thenReturn(album);
        var access = new AlbumPrivateAccess(mapper,passwords,store,Clock.systemUTC());
        var actor = new AuthenticatedActor(2L,"member","Member",null,null,null,null,true);
        String stamp = AlbumPrivateAccess.passwordStamp(album);
        assertThat(stamp).matches("[0-9a-f]{16}");
        String token = access.unlock(actor,1L,new AlbumDtos.AlbumUnlockDto("fixture-password")).privateAccessToken();
        access.require(album,2L,token);
        album.setPrivatePasswordHash(passwords.encode("fixture-password"));
        assertThat(AlbumPrivateAccess.passwordStamp(album)).isNotEqualTo(stamp);
        assertThat(store.validate(token,1L,2L,AlbumPrivateAccess.passwordStamp(album))).isEqualTo(AlbumPrivateAccessTokenStore.ValidationStatus.INVALID);
        assertThatThrownBy(() -> access.require(album,2L,token)).isInstanceOfSatisfying(ApplicationFailure.class,f -> assertThat(f.code()).isEqualTo("PRIVATE_ALBUM_TOKEN_INVALID"));
        String fresh = access.unlock(actor,1L,new AlbumDtos.AlbumUnlockDto("fixture-password")).privateAccessToken();
        access.require(album,2L,fresh);
        data.put("albumPrivateToken:legacy","1:2:"+Instant.now().plusSeconds(3600).getEpochSecond());
        assertThat(store.validate("legacy",1L,2L,AlbumPrivateAccess.passwordStamp(album))).isEqualTo(AlbumPrivateAccessTokenStore.ValidationStatus.INVALID);
        assertThat(store.validate(fresh,1L,3L,AlbumPrivateAccess.passwordStamp(album))).isEqualTo(AlbumPrivateAccessTokenStore.ValidationStatus.INVALID);
    }
}
