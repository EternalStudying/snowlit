package xyz.snowlit.auth;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginDto(String username, String password) {
    }

    public record ProfileUpdateDto(
            String displayName,
            String mood,
            String bio
    ) {
    }

    public record WechatBindLoginDto(String code, String username, String password) {
    }

    public record WechatLoginDto(String code) {
    }
}
