package xyz.snowlit.web;

public final class BearerToken {

    private static final String PREFIX = "Bearer ";

    private BearerToken() {
    }

    public static String fromAuthorization(String authorization) {
        return authorization != null && authorization.startsWith(PREFIX)
                ? authorization.substring(PREFIX.length())
                : "";
    }
}
