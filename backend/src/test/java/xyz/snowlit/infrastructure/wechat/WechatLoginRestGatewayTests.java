package xyz.snowlit.infrastructure.wechat;

import xyz.snowlit.auth.WechatLoginGateway;
import xyz.snowlit.failure.ApplicationFailure;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class WechatLoginRestGatewayTests {

    @Test
    void exchangeCodeRejectsMissingConfigurationBeforeCallingWechat() {
        WechatLoginRestGateway client = client("", "secret", "https://api.weixin.qq.com/sns/jscode2session");

        assertThatThrownBy(() -> client.exchangeCode("wx-code"))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("微信小程序登录未配置");
    }

    @Test
    void exchangeCodeReturnsOnlyOpenidAndUnionidFromWechatSuccessResponse() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.weixin.qq.com/sns/jscode2session?appid=app-id&secret=app-secret&js_code=wx-code&grant_type=authorization_code"))
                .andRespond(withSuccess("""
                        {"openid":"openid-1","session_key":"wechat-session-key","unionid":"unionid-1"}
                        """, MediaType.TEXT_PLAIN));
        WechatLoginRestGateway client = client("app-id", "app-secret", "https://api.weixin.qq.com/sns/jscode2session", builder);

        WechatLoginGateway.Session session = client.exchangeCode("wx-code");

        assertThat(session.openid()).isEqualTo("openid-1");
        assertThat(session.unionid()).isEqualTo("unionid-1");
        server.verify();
    }

    @Test
    void exchangeCodeRejectsWechatErrcodeAsUnauthorized() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.weixin.qq.com/sns/jscode2session?appid=app-id&secret=app-secret&js_code=bad-code&grant_type=authorization_code"))
                .andRespond(withSuccess("""
                        {"errcode":40029,"errmsg":"invalid code"}
                        """, MediaType.TEXT_PLAIN));
        WechatLoginRestGateway client = client("app-id", "app-secret", "https://api.weixin.qq.com/sns/jscode2session", builder);

        assertThatThrownBy(() -> client.exchangeCode("bad-code"))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("微信登录凭证无效");
        server.verify();
    }

    @Test
    void exchangeCodeConvertsWechatHttpFailureToBadGateway() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.weixin.qq.com/sns/jscode2session?appid=app-id&secret=app-secret&js_code=wx-code&grant_type=authorization_code"))
                .andRespond(withServerError());
        WechatLoginRestGateway client = client("app-id", "app-secret", "https://api.weixin.qq.com/sns/jscode2session", builder);

        assertThatThrownBy(() -> client.exchangeCode("wx-code"))
                .isInstanceOf(ApplicationFailure.class)
                .hasMessage("微信登录服务暂时不可用");
        server.verify();
    }

    private WechatLoginRestGateway client(String appId, String appSecret, String url) {
        return client(appId, appSecret, url, RestClient.builder());
    }

    private WechatLoginRestGateway client(String appId, String appSecret, String url, RestClient.Builder builder) {
        return new WechatLoginRestGateway(builder, new ObjectMapper(), appId, appSecret, url);
    }
}
