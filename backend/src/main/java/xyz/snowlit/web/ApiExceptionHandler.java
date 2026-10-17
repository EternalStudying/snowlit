package xyz.snowlit.web;

import xyz.snowlit.failure.ApplicationFailure;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApplicationFailure.class)
    public ResponseEntity<Map<String, Object>> handleApplicationFailure(ApplicationFailure failure) {
        HttpStatus status = statusFor(failure.kind());
        return response(status, failure.code(), failure.getMessage());
    }

    private ResponseEntity<Map<String, Object>> response(HttpStatus status, String code, String message) {
        return response(status.value(), code, message);
    }

    private ResponseEntity<Map<String, Object>> response(int status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status);
        if (code != null && !code.isBlank()) {
            body.put("code", code);
        }
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }

    private HttpStatus statusFor(ApplicationFailure.Kind kind) {
        return switch (kind) {
            case INVALID_INPUT -> HttpStatus.BAD_REQUEST;
            case UNAUTHENTICATED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT -> HttpStatus.CONFLICT;
            case LOCKED -> HttpStatus.LOCKED;
            case GONE -> HttpStatus.GONE;
            case PAYLOAD_TOO_LARGE -> HttpStatus.PAYLOAD_TOO_LARGE;
            case DEPENDENCY_FAILURE -> HttpStatus.BAD_GATEWAY;
            case INTERNAL -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }
}
