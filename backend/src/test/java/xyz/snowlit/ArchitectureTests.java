package xyz.snowlit;

import xyz.snowlit.infrastructure.storage.LocalDiskObjectStore;
import xyz.snowlit.infrastructure.storage.MinioObjectStore;
import xyz.snowlit.storage.ObjectStore;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class ArchitectureTests {

    private static final Path JAVA_ROOT = Path.of("src/main/java/xyz/snowlit");
    private static final Set<String> DOMAINS = Set.of(
            "album",
            "auth",
            "diary",
            "feedback",
            "home",
            "messages",
            "notices",
            "story",
            "weather",
            "wishes"
    );

    @Test
    void sourceTreeUsesXyzRootAndVerticalBusinessPackages() throws Exception {
        assertThat(Files.isDirectory(JAVA_ROOT)).isTrue();
        assertThat(Files.exists(Path.of("src/main/java/cn"))).isFalse();

        for (String domain : DOMAINS) {
            assertThat(Files.isDirectory(JAVA_ROOT.resolve(domain)))
                    .describedAs("%s should be a vertical business package", domain)
                    .isTrue();
        }

        for (String legacyLayer : List.of("controller", "service", "dto", "vo", "entity", "mapper")) {
            assertThat(javaFiles(JAVA_ROOT.resolve(legacyLayer)))
                    .describedAs("legacy horizontal layer %s should be empty", legacyLayer)
                    .isEmpty();
        }

        for (Path source : javaFiles(JAVA_ROOT)) {
            assertThat(Files.readString(source))
                    .describedAs("%s should use the canonical package root", source)
                    .startsWith("package xyz.snowlit");
        }
    }

    @Test
    void applicationModulesOwnBusinessFlowWithoutRawHttpAuthentication() throws Exception {
        List<Path> modules = javaFiles(JAVA_ROOT).stream()
                .filter(path -> path.getFileName().toString().endsWith("Module.java"))
                .toList();
        assertThat(modules)
                .extracting(path -> path.getFileName().toString())
                .containsExactlyInAnyOrder(
                        "AlbumModule.java",
                        "AuthModule.java",
                        "DiaryModule.java",
                        "FeedbackModule.java",
                        "HomeModule.java",
                        "MessageModule.java",
                        "NoticeModule.java",
                        "StoryModule.java",
                        "WeatherModule.java",
                        "WishModule.java"
                );

        for (Path module : modules) {
            String source = Files.readString(module);
            assertThat(source)
                    .describedAs("%s must not depend on HTTP authorization headers", module)
                    .doesNotContain("@RequestHeader", "\"Authorization\"");
            if (!module.endsWith("auth/AuthModule.java")) {
                assertThat(source)
                        .describedAs("%s must receive an authenticated actor instead of parsing JWT", module)
                        .doesNotContain("JwtService", "UserMapper");
            }
        }

        String controllers = javaFiles(JAVA_ROOT).stream()
                .filter(path -> path.getFileName().toString().endsWith("Controller.java"))
                .map(ArchitectureTests::read)
                .reduce("", (left, right) -> left + "\n" + right);
        assertThat(controllers)
                .contains("@CurrentActor")
                .doesNotContain("extractToken(");

        String allSources = readJavaFiles(JAVA_ROOT);
        assertThat(allSources)
                .doesNotMatch("(?s).*@Autowired\\s+private\\s+.*")
                .doesNotMatch("(?s).*@Value\\([^\\n]+\\)\\s+private\\s+.*");
    }

    @Test
    void imagesEnterThroughOneIntakeOverTwoObjectStoreAdapters() throws Exception {
        assertThat(ObjectStore.class.isInterface()).isTrue();
        assertThat(ObjectStore.class).isAssignableFrom(MinioObjectStore.class);
        assertThat(ObjectStore.class).isAssignableFrom(LocalDiskObjectStore.class);

        assertThat(javaFiles(JAVA_ROOT).stream()
                .map(path -> path.getFileName().toString())
                .filter(name -> name.matches("(Album|Diary|Feedback|Message|Story|Wish)(Images|Assets)\\.java")
                        || name.equals("ObjectKeys.java"))
                .toList())
                .describedAs("per-domain image storage modules are replaced by ImageIntake")
                .isEmpty();

        assertThat(javaFiles(JAVA_ROOT).stream()
                .map(path -> path.getFileName().toString())
                .filter(name -> name.startsWith("Minio"))
                .toList()).containsExactly("MinioObjectStore.java");

        assertThat(javaFiles(JAVA_ROOT).stream()
                .map(path -> path.getFileName().toString())
                .filter(name -> name.endsWith("Service.java"))
                .toList()).isEmpty();
    }

    @Test
    void failuresAreTypedAndLegacyStringProtocolIsGone() throws Exception {
        String sources = readJavaFiles(JAVA_ROOT);
        assertThat(sources)
                .contains("class ApplicationFailure", "@ExceptionHandler(ApplicationFailure.class)")
                .doesNotContain("ResponseStatusException", "code + \":\" + message");
    }

    @Test
    void schemaUsesCanonicalTablesAndKeepsV2AssetContracts() throws Exception {
        String schema = Files.readString(Path.of("src/main/resources/schema.sql"));
        String mapperSql = readJavaFiles(JAVA_ROOT);

        List<String> oldTables = List.of(
                "auth_user",
                "user_couple_role",
                "home_user_location",
                "couple_profile",
                "update_notices",
                "update_notice_mutes",
                "user_feedback",
                "feedback_screenshots",
                "album_photos",
                "album_daily_views",
                "album_daily_likes",
                "album_unlock_failures",
                "diary_entries",
                "diary_image_references",
                "story_moments"
        );
        for (String oldTable : oldTables) {
            assertThat(schema).doesNotContain("create table if not exists " + oldTable);
            assertThat(mapperSql).doesNotContain("from " + oldTable, "into " + oldTable, "update " + oldTable);
        }

        List<String> targetTables = List.of(
                "users",
                "couples",
                "wishes",
                "messages",
                "notices",
                "notice_mutes",
                "feedback",
                "feedback_images",
                "albums",
                "photos",
                "album_activity",
                "album_locks",
                "diaries",
                "diary_uploads",
                "diary_images",
                "moments"
        );
        for (String table : targetTables) {
            assertThat(schema).contains("create table if not exists " + table);
            assertTableAndColumnsHaveChineseComments(schema, table);
        }

        assertThat(schema).contains(
                "status varchar(20) not null default 'published'",
                "published_at datetime null",
                "created_by_user_id bigint null",
                "original_url varchar(700) null",
                "original_object_name varchar(500) null",
                "preview_url varchar(700) not null",
                "preview_object_name varchar(500) null",
                "unique key uq_album_activity (album_id, user_id, activity_date)",
                "wechat_openid varchar(128) null",
                "unique key uk_users_wechat_openid (wechat_openid)"
        ).doesNotContain("alter table");
    }

    @Test
    void v2ContractsDoNotRestoreLegacyAliasesOrSiteApi() throws Exception {
        String sources = readJavaFiles(JAVA_ROOT);
        String schema = Files.readString(Path.of("src/main/resources/schema.sql"));
        String data = Files.readString(Path.of("src/main/resources/data.sql"));

        assertThat(sources).doesNotContain(
                "preview_url as url",
                "preview_url as thumbnail_url",
                "entry_date as date",
                "created_by_user_id as created_by",
                "last_operated_by_user_id as last_operated_by",
                "class SiteController",
                "interface SiteService",
                "from memories",
                "from memory_tags",
                "from wish_items"
        );
        assertThat(sources).contains(
                "HomeLatestDiaryVo",
                "String previewUrl",
                "String originalUrl",
                "LocalDate entryDate",
                "Long uploadId",
                "Long createdByUserId",
                "Long lastOperatedByUserId",
                "findVisibleMonthCounts",
                "findImageUrlsByDiaryIds"
        );
        assertThat(schema).doesNotContain(
                "create table if not exists memories",
                "create table if not exists memory_tags",
                "create table if not exists wish_items",
                "wish_operation"
        );
        assertThat(data).doesNotContain(
                "insert ignore into memories",
                "insert ignore into memory_tags",
                "insert ignore into wish_items"
        );
    }

    @Test
    void runtimeProfilesKeepLocalDefaultsAndExplicitProductionDependencies() throws Exception {
        String common = Files.readString(Path.of("src/main/resources/application.yml"));
        String dev = Files.readString(Path.of("src/main/resources/application-dev.yml"));
        String prod = Files.readString(Path.of("src/main/resources/application-prod.yml"));
        String webConfig = Files.readString(JAVA_ROOT.resolve("config/WebConfig.java"));

        assertThat(common)
                .contains("default: dev")
                .doesNotContain("SERVER_PUBLIC_IP");
        assertThat(webConfig).contains("\"/api/auth/wechat-login\"");
        assertThat(dev).contains(
                "jdbc:mysql://127.0.0.1:3306/snowlit_dev",
                "host: ${LOCAL_REDIS_HOST:127.0.0.1}",
                "endpoint: ${LOCAL_MINIO_ENDPOINT:http://127.0.0.1:9000}"
        );
        assertThat(prod).contains(
                "url: ${DB_URL}",
                "host: ${REDIS_HOST}",
                "endpoint: ${MINIO_ENDPOINT}",
                "public-base-url: ${MINIO_PUBLIC_BASE_URL}"
        ).doesNotContain(
                "jdbc:mysql://127.0.0.1:3306/snowlit_dev",
                "http://127.0.0.1:9000"
        );
    }

    private static List<Path> javaFiles(Path root) throws Exception {
        if (!Files.exists(root)) {
            return List.of();
        }
        try (var files = Files.walk(root)) {
            return files.filter(path -> path.toString().endsWith(".java"))
                    .sorted()
                    .toList();
        }
    }

    private static String readJavaFiles(Path root) throws Exception {
        StringBuilder content = new StringBuilder();
        for (Path path : javaFiles(root)) {
            content.append(Files.readString(path)).append('\n');
        }
        return content.toString();
    }

    private static String read(Path path) {
        try {
            return Files.readString(path);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void assertTableAndColumnsHaveChineseComments(String schema, String table) {
        Pattern tablePattern = Pattern.compile(
                "create table if not exists " + table + " \\((.*?)\\) comment='([^']+)'",
                Pattern.DOTALL
        );
        var matcher = tablePattern.matcher(schema);
        assertThat(matcher.find())
                .describedAs("%s should have a table comment", table)
                .isTrue();
        assertThat(matcher.group(2))
                .describedAs("%s table comment should be Chinese", table)
                .matches(".*\\p{IsHan}.*");

        for (String rawLine : matcher.group(1).split("\\R")) {
            String line = rawLine.trim();
            if (line.isEmpty()
                    || line.startsWith("constraint ")
                    || line.startsWith("unique key ")
                    || line.startsWith("index ")
                    || line.startsWith("primary key ")) {
                continue;
            }
            assertThat(line)
                    .describedAs("%s column should have a Chinese comment: %s", table, line)
                    .contains(" comment '")
                    .matches(".*comment '.*\\p{IsHan}.*'.*");
        }
    }
}
