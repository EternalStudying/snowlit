package xyz.snowlit.auth;

public interface WechatLoginGateway {

    Session exchangeCode(String code);

    record Session(String openid, String unionid) {
    }
}
