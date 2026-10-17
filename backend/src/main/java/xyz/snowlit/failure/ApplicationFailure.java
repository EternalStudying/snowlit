package xyz.snowlit.failure;

import java.util.Objects;

public final class ApplicationFailure extends RuntimeException {

    public enum Kind {
        INVALID_INPUT,
        UNAUTHENTICATED,
        FORBIDDEN,
        NOT_FOUND,
        CONFLICT,
        LOCKED,
        GONE,
        PAYLOAD_TOO_LARGE,
        DEPENDENCY_FAILURE,
        INTERNAL
    }

    private final Kind kind;
    private final String code;

    private ApplicationFailure(Kind kind, String code, String message, Throwable cause) {
        super(requireText(message, "message"), cause);
        this.kind = Objects.requireNonNull(kind, "kind");
        this.code = requireText(code, "code");
    }

    public static ApplicationFailure invalidInput(String code, String message) {
        return new ApplicationFailure(Kind.INVALID_INPUT, code, message, null);
    }

    public static ApplicationFailure unauthenticated(String code, String message) {
        return new ApplicationFailure(Kind.UNAUTHENTICATED, code, message, null);
    }

    public static ApplicationFailure forbidden(String code, String message) {
        return new ApplicationFailure(Kind.FORBIDDEN, code, message, null);
    }

    public static ApplicationFailure notFound(String code, String message) {
        return new ApplicationFailure(Kind.NOT_FOUND, code, message, null);
    }

    public static ApplicationFailure conflict(String code, String message) {
        return new ApplicationFailure(Kind.CONFLICT, code, message, null);
    }

    public static ApplicationFailure locked(String code, String message) {
        return new ApplicationFailure(Kind.LOCKED, code, message, null);
    }

    public static ApplicationFailure gone(String code, String message) {
        return new ApplicationFailure(Kind.GONE, code, message, null);
    }

    public static ApplicationFailure payloadTooLarge(String code, String message) {
        return new ApplicationFailure(Kind.PAYLOAD_TOO_LARGE, code, message, null);
    }

    public static ApplicationFailure dependencyFailure(String code, String message, Throwable cause) {
        return new ApplicationFailure(Kind.DEPENDENCY_FAILURE, code, message, cause);
    }

    public static ApplicationFailure internal(String code, String message) {
        return new ApplicationFailure(Kind.INTERNAL, code, message, null);
    }

    public Kind kind() {
        return kind;
    }

    public String code() {
        return code;
    }

    private static String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " must not be blank");
        }
        return value;
    }
}
