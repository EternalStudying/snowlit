package xyz.snowlit;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class DataSqlPasswordHashTests {

    @Test
    void initialUsersUseDocumentedPassword() throws Exception {
        String dataSql = Files.readString(Path.of("src/main/resources/data.sql"));
        Matcher matcher = Pattern.compile("\\$2a\\$10\\$[./A-Za-z0-9]{53}").matcher(dataSql);

        assertThat(matcher.find()).isTrue();
        assertThat(new BCryptPasswordEncoder().matches("123456", matcher.group())).isTrue();
        assertThat(dataSql).contains("'demo_a'", "'demo_b'", "'boyfriend'", "'girlfriend'");
    }
}
