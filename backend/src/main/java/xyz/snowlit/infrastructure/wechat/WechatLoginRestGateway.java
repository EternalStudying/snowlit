package xyz.snowlit.infrastructure.wechat;

import xyz.snowlit.text.Text;
import xyz.snowlit.auth.WechatLoginGateway;
import xyz.snowlit.failure.ApplicationFailure;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;

@Component
public final class WechatLoginRestGateway implements WechatLoginGateway {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String appId;
    private final String appSecret;
    private final String code2SessionUrl;

    public WechatLoginRestGateway(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${snowlit.wechat.miniprogram.app-id:}") String appId,
            @Value("${snowlit.wechat.miniprogram.app-secret:}") String appSecret,
            @Value("${snowlit.wechat.miniprogram.code2-session-url:https://api.weixin.qq.com/sns/jscode2session}")
            String code2SessionUrl
    ) {
        this.restClient = restClientBuilder.build();
        this.objectMapper = objectMapper;
        this.appId = Text.trim(appId);
        this.appSecret = Text.trim(appSecret);
        this.code2SessionUrl = Text.trim(code2SessionUrl);
    }

    @Override
    public Session exchangeCode(String code) {
        if (appId.isBlank() || appSecret.isBlank() || code2SessionUrl.isBlank()) {
            throw ApplicationFailure.internal("WECHAT_LOGIN_NOT_CONFIGURED", "微信小程序登录未配置");
        }

        String responseBody;
        try {
            responseBody = restClient.get()
                    .uri(code2SessionUri(code))
                    .retrieve()
                    .body(String.class);
        } catch (RuntimeException ex) {
            throw ApplicationFailure.dependencyFailure(
                    "WECHAT_CODE2SESSION_FAILED",
                    "微信登录服务暂时不可用",
                    ex
            );
        }

        WechatCode2SessionResponse response = parseResponse(responseBody);
        if (response == null) {
            throw dependencyFailure(null);
        }
        if (response.errcode() != null && response.errcode() != 0) {
            if (response.errcode() == 40029 || response.errcode() == 40163) {
                throw ApplicationFailure.unauthenticated("WECHAT_LOGIN_CODE_INVALID", "微信登录凭证无效");
            }
            if (response.errcode() == 40013 || response.errcode() == 40125) {
                throw ApplicationFailure.internal("WECHAT_LOGIN_NOT_CONFIGURED", "微信小程序登录配置无效");
            }
            throw dependencyFailure(null);
        }
        String openid = Text.trim(response.openid());
        if (openid.isBlank()) {
            throw ApplicationFailure.unauthenticated("WECHAT_LOGIN_CODE_INVALID", "微信登录凭证无效");
        }
        return new Session(openid, Text.trim(response.unionid()));
    }

    private URI code2SessionUri(String code) {
        return UriComponentsBuilder.fromUriString(code2SessionUrl)
                .queryParam("appid", appId)
                .queryParam("secret", appSecret)
                .queryParam("js_code", code)
                .queryParam("grant_type", "authorization_code")
                .build()
                .toUri();
    }

    private WechatCode2SessionResponse parseResponse(String responseBody) {
        String body = Text.trim(responseBody);
        if (body.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(body, WechatCode2SessionResponse.class);
        } catch (JsonProcessingException ex) {
            throw dependencyFailure(ex);
        }
    }

    private ApplicationFailure dependencyFailure(Throwable cause) {
        return ApplicationFailure.dependencyFailure(
                "WECHAT_CODE2SESSION_FAILED",
                "微信登录服务暂时不可用",
                cause
        );
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record WechatCode2SessionResponse(String openid, String unionid, Integer errcode, String errmsg) {
    }
}
