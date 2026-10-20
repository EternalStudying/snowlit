package xyz.snowlit.draft;

import com.fasterxml.jackson.databind.*;
import xyz.snowlit.album.*;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.diary.*;
import xyz.snowlit.home.MemberLocations;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.*;
import xyz.snowlit.story.*;
import xyz.snowlit.support.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.support.*;
import org.springframework.transaction.TransactionDefinition;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class DraftModuleTests {
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-05-20T12:30:00Z"), ZoneOffset.UTC);
    static final AuthenticatedActor OWNER = actor(1L, true, "boyfriend");
    static AuthenticatedActor actor(long id, boolean manager, String role) {
        return new AuthenticatedActor(id, "member" + id, "Member", null, null, null, role, manager);
    }
    final ObjectMapper json = new ObjectMapper().findAndRegisterModules();
    final Rows rows = new Rows();
    final Transactions tx = new Transactions();
    final InMemoryObjectStore objects = new InMemoryObjectStore();
    final ImageIntake intake = new ImageIntake(objects, CLOCK);
    final AlbumMapper albumMapper = mock(AlbumMapper.class);
    final DiaryMapper diaryMapper = mock(DiaryMapper.class);
    final StoryMapper storyMapper = mock(StoryMapper.class);
    final AlbumModule albums = new AlbumModule(albumMapper, mock(AlbumPrivateAccess.class), CLOCK,
            new AlbumPublisher(albumMapper, new BCryptPasswordEncoder(), CLOCK));
    final DiaryModule diaries = new DiaryModule(diaryMapper, mock(MemberLocations.class), intake, CLOCK);
    final StoryModule story = new StoryModule(storyMapper, intake, CLOCK);
    final DraftModule drafts = new DraftModule(rows, json, intake, albums, diaries, story, CLOCK, tx);

    @BeforeEach void useRealReferenceReplacement() {
        doCallRealMethod().when(diaryMapper).replaceImageReferences(any(), any());
    }

    JsonNode fields(String source) { try { return json.readTree(source); } catch (Exception e) { throw new RuntimeException(e); } }
    JsonNode albumFields() { return fields("{\"title\":\"Weekend\",\"eventDate\":\"2026-05-20\",\"visibility\":\"public\"}"); }
    JsonNode metadata() { return fields("{\"width\":32,\"height\":24,\"caption\":\"Photo\"}"); }
    DraftVos.DraftImageVo upload(DraftKind kind) {
        return drafts.upload(OWNER, kind, TestImages.jpeg("file", "photo.jpg"), null, null, kind == DraftKind.ALBUM ? metadata() : null);
    }
    void fails(String code, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApplicationFailure.class, e -> assertThat(e.code()).isEqualTo(code));
    }

    @Test void saveCreatesAndReplacesFieldsWithoutReplacingImages() {
        assertThat(drafts.current(OWNER, DraftKind.ALBUM).draft()).isNull();
        drafts.save(OWNER, DraftKind.ALBUM, albumFields());
        var image = upload(DraftKind.ALBUM);
        drafts.save(OWNER, DraftKind.ALBUM, fields("{\"title\":\"Changed\"}"));
        var current = drafts.current(OWNER, DraftKind.ALBUM).draft();
        assertThat(rows.rows).hasSize(1);
        assertThat(current.fields().path("title").asText()).isEqualTo("Changed");
        assertThat(current.fields().has("eventDate")).isFalse();
        assertThat(current.images()).containsExactly(image);
    }

    @ParameterizedTest @ValueSource(strings = {
        "{\"privatePassword\":\"secret\"}", "{\"title\":3}", "{\"pinned\":1}",
        "{\"eventDate\":\"2026-02-30\"}", "{\"eventDate\":\"20/05/2026\"}",
        "{\"visibility\":\"shared\"}", "{\"objectName\":\"unowned\"}", "[]", "null"
    }) void invalidAlbumFieldsAreRejected(String source) {
        fails("DRAFT_FIELDS_INVALID", () -> drafts.save(OWNER, DraftKind.ALBUM, fields(source)));
        assertThat(rows.rows).isEmpty();
    }

    @Test void byteAndCharacterLimitsIncludeSerializedJsonEscapes() {
        for (String body : List.of("a".repeat(60001), "文".repeat(22000), "\n".repeat(33000))) {
            var value = json.createObjectNode().put("contentMarkdown", body);
            fails("DRAFT_FIELDS_INVALID", () -> drafts.save(OWNER, DraftKind.DIARY, value));
        }
        assertThat(drafts.save(OWNER, DraftKind.DIARY, json.createObjectNode().put("contentMarkdown", "a".repeat(60000))).fields().path("contentMarkdown").asText()).hasSize(60000);
        fails("DRAFT_FIELDS_INVALID", () -> drafts.save(OWNER, DraftKind.ALBUM, json.createObjectNode().put("title", "a".repeat(121))));
        fails("DRAFT_FIELDS_INVALID", () -> drafts.save(OWNER, DraftKind.MOMENT, json.createObjectNode().put("content", "文".repeat(22000))));
    }

    @ParameterizedTest @ValueSource(strings = {"{\"moodKey\":\"unknown\"}", "{\"weatherSnapshot\":{\"city\":3}}", "{\"weatherSnapshot\":{\"extra\":1}}", "{\"visibility\":\"public\"}"})
    void invalidDiaryFieldsAreRejected(String source) { fails("DRAFT_FIELDS_INVALID", () -> drafts.save(OWNER, DraftKind.DIARY, fields(source))); }
    @ParameterizedTest @ValueSource(strings = {"{\"category\":\"unknown\"}", "{\"longitude\":\"1\"}", "{\"images\":[]}", "{\"eventTime\":\"invalid\"}"})
    void invalidMomentFieldsAreRejected(String source) { fails("DRAFT_FIELDS_INVALID", () -> drafts.save(OWNER, DraftKind.MOMENT, fields(source))); }

    @Test void oneDraftPerMemberAndKindAndOtherMemberCannotReadChangeOrDiscardIt() {
        drafts.save(OWNER, DraftKind.DIARY, fields("{\"contentMarkdown\":\"Mine\"}"));
        drafts.save(OWNER, DraftKind.ALBUM, fields("{}"));
        var other = actor(2L, true, "girlfriend");
        assertThat(drafts.current(other, DraftKind.DIARY).draft()).isNull();
        drafts.discard(other, DraftKind.DIARY);
        drafts.save(other, DraftKind.DIARY, fields("{\"contentMarkdown\":\"Other\"}"));
        assertThat(rows.rows).hasSize(3);
        assertThat(drafts.current(OWNER, DraftKind.DIARY).draft().fields().path("contentMarkdown").asText()).isEqualTo("Mine");
    }

    @Test void managerAndCoupleRoleChecksApplyToAllDraftOperations() {
        var guest = actor(3L, false, null);
        for (DraftKind kind : List.of(DraftKind.ALBUM, DraftKind.MOMENT, DraftKind.DIARY)) {
            String code = kind == DraftKind.ALBUM ? "ALBUM_FORBIDDEN" : kind == DraftKind.MOMENT ? "STORY_FORBIDDEN" : "DIARY_ROLE_NOT_CONFIGURED";
            fails(code, () -> drafts.current(guest, kind));
            fails(code, () -> drafts.save(guest, kind, fields("{}")));
            fails(code, () -> drafts.discard(guest, kind));
            fails(code, () -> drafts.upload(guest, kind, TestImages.jpeg("file", "x.jpg"), null, null, metadata()));
            fails(code, () -> drafts.removeImage(guest, kind, "id"));
            fails(code, () -> drafts.publish(guest, kind, new DraftDtos.PublishDto(fields("{}"), null)));
        }
    }

    @ParameterizedTest @EnumSource(DraftKind.class) void uploadCreatesDraftAndNeverReturnsObjectNames(DraftKind kind) throws Exception {
        var image = upload(kind);
        assertThat(drafts.current(OWNER, kind).draft().images()).containsExactly(image);
        String response = json.writeValueAsString(drafts.current(OWNER, kind));
        assertThat(response).doesNotContain("objectName", "contentType", "sizeBytes", "\"original\":");
        verify(diaryMapper, never()).insertImage(any());
    }

    @ParameterizedTest @EnumSource(DraftKind.class) void uploadEnforcesLimits(DraftKind kind) throws Exception {
        int max = kind == DraftKind.ALBUM ? 50 : kind == DraftKind.DIARY ? 20 : 3;
        var image = upload(kind);
        Draft row = rows.find(1L, kind.path());
        JsonNode item = json.readTree(row.getImagesJson()).get(0);
        var list = json.createArrayNode();
        for (int i = 0; i < max; i++) list.add(item.deepCopy());
        row.setImagesJson(json.writeValueAsString(list));
        String code = kind == DraftKind.ALBUM ? "ALBUM_PHOTO_LIMIT_EXCEEDED" : kind == DraftKind.DIARY ? "DIARY_IMAGE_LIMIT_EXCEEDED" : "STORY_IMAGE_LIMIT_EXCEEDED";
        fails(code, () -> upload(kind));
        assertThat(drafts.current(OWNER, kind).draft().images()).hasSize(max);
    }

    @Test void webUploadKeepsPreviewPolicyAndCompensatesPartialStoreFailure() {
        fails("ALBUM_PREVIEW_TYPE_INVALID", () -> drafts.upload(OWNER, DraftKind.ALBUM, null, TestImages.jpeg("original", "a.jpg"), TestImages.jpeg("preview", "p.jpg"), metadata()));
        ImageIntake broken = spy(intake);
        doThrow(ApplicationFailure.dependencyFailure("ALBUM_UPLOAD_FAILED", "失败", null)).when(broken).store(any(), eq(AlbumPublisher.PREVIEW_IMAGE), any(), eq("preview"), any());
        DraftModule withFailure = new DraftModule(rows, json, broken, albums, diaries, story, CLOCK, tx);
        fails("ALBUM_UPLOAD_FAILED", () -> withFailure.upload(OWNER, DraftKind.ALBUM, null, TestImages.jpeg("original", "a.jpg"), TestImages.webp("preview", "p.webp"), metadata()));
        assertThat(objects.stored()).isEmpty();
        assertThat(objects.deleted()).hasSize(1);
    }

    @Test void rowWriteFailureCompensatesStoredObjects() {
        rows.failImages = true;
        assertThatThrownBy(() -> upload(DraftKind.ALBUM)).isInstanceOf(IllegalStateException.class);
        assertThat(objects.stored()).isEmpty();
        assertThat(objects.deleted()).hasSize(2);
    }

    @Test void removeUsesStoredNamesAndOnlyAfterCommitAndRejectsUnknownIds() {
        var image = upload(DraftKind.ALBUM);
        tx.beforeCommit = () -> assertThat(objects.deleted()).isEmpty();
        drafts.removeImage(OWNER, DraftKind.ALBUM, image.id());
        assertThat(objects.deleted()).hasSize(2);
        assertThat(drafts.current(OWNER, DraftKind.ALBUM).draft().images()).isEmpty();
        fails("DRAFT_IMAGE_NOT_FOUND", () -> drafts.removeImage(OWNER, DraftKind.ALBUM, image.id()));
        fails("DRAFT_IMAGE_NOT_FOUND", () -> drafts.removeImage(actor(2L, true, "girlfriend"), DraftKind.ALBUM, image.id()));
    }

    @Test void discardIsIdempotentAndDeletesObjectsAfterRowAndCommit() {
        upload(DraftKind.ALBUM);
        tx.beforeCommit = () -> { assertThat(rows.rows).isEmpty(); assertThat(objects.deleted()).isEmpty(); };
        drafts.discard(OWNER, DraftKind.ALBUM);
        assertThat(objects.deleted()).hasSize(2);
        tx.beforeCommit = () -> {};
        drafts.discard(OWNER, DraftKind.ALBUM);
        assertThat(rows.rows).isEmpty();
    }

    @Test void unavailableStoreDoesNotRestoreDiscardedRow() {
        upload(DraftKind.DIARY); objects.becomeUnavailable(); drafts.discard(OWNER, DraftKind.DIARY);
        assertThat(rows.rows).isEmpty();
    }

    @Test void albumPublishesPhotosInOrderCoverAndDateAndDeletesDraft() {
        doAnswer(i -> { ((Album)i.getArgument(0)).setId(19L); return 1; }).when(albumMapper).insertAlbum(any());
        var first = upload(DraftKind.ALBUM); var second = upload(DraftKind.ALBUM);
        var result = (AlbumVos.AlbumDetailVo) drafts.publish(OWNER, DraftKind.ALBUM, new DraftDtos.PublishDto(albumFields(), null));
        assertThat(result.photos()).extracting(AlbumVos.AlbumPhotoVo::previewUrl).containsExactly(first.url(), second.url());
        assertThat(result.photos()).extracting(AlbumVos.AlbumPhotoVo::sortOrder).containsExactly(1, 2);
        assertThat(result.photos()).extracting(AlbumVos.AlbumPhotoVo::takenAt).containsOnly(LocalDate.of(2026, 5, 20));
        verify(albumMapper).insertAlbum(argThat(a -> a.getStatus().equals("published") && a.getPublishedAt().equals(LocalDateTime.now(CLOCK)) && a.getCoverPhotoUrl().equals(first.url())));
        assertThat(rows.rows).isEmpty(); assertThat(objects.stored()).hasSize(4);
    }

    @Test void olderOverLimitAlbumStaysIntactUntilReducedToFiftyPhotos() throws Exception {
        upload(DraftKind.ALBUM);
        var row = rows.find(1L, "album");
        var source = json.readTree(row.getImagesJson()).get(0);
        var list = json.createArrayNode();
        for (int i = 0; i < 51; i++) list.add(source.deepCopy());
        row.setImagesJson(json.writeValueAsString(list));
        fails("ALBUM_PHOTO_LIMIT_EXCEEDED", () -> drafts.publish(OWNER, DraftKind.ALBUM, new DraftDtos.PublishDto(albumFields(), null)));
        assertThat(drafts.current(OWNER, DraftKind.ALBUM).draft().images()).hasSize(51);
        verify(albumMapper, never()).insertAlbum(any());
    }

    @Test void albumValidationFailureCommitsNewestFieldsAndPrivatePasswordNeverStored() {
        upload(DraftKind.ALBUM);
        fails("ALBUM_TITLE_REQUIRED", () -> drafts.publish(OWNER, DraftKind.ALBUM, new DraftDtos.PublishDto(fields("{\"description\":\"Newest\"}"), null)));
        assertThat(drafts.current(OWNER, DraftKind.ALBUM).draft().fields().path("description").asText()).isEqualTo("Newest");
        var privateFields = albumFields().deepCopy(); ((com.fasterxml.jackson.databind.node.ObjectNode) privateFields).put("visibility", "private");
        fails("ALBUM_PRIVATE_PASSWORD_REQUIRED", () -> drafts.publish(OWNER, DraftKind.ALBUM, new DraftDtos.PublishDto(privateFields, null)));
        drafts.publish(OWNER, DraftKind.ALBUM, new DraftDtos.PublishDto(privateFields, "test-password"));
        verify(albumMapper).insertAlbum(argThat(a -> new BCryptPasswordEncoder().matches("test-password", a.getPrivatePasswordHash())));
        verify(albumMapper, times(1)).insertAlbum(any());
    }

    @Test void emptyAlbumAndMissingDraftAreRejected() {
        fails("DRAFT_NOT_FOUND", () -> drafts.publish(OWNER, DraftKind.ALBUM, new DraftDtos.PublishDto(albumFields(), null)));
        drafts.save(OWNER, DraftKind.ALBUM, fields("{}"));
        fails("ALBUM_PHOTO_REQUIRED", () -> drafts.publish(OWNER, DraftKind.ALBUM, new DraftDtos.PublishDto(albumFields(), null)));
    }

    @Test void convertedMobileImageCanUseSameOriginalAndPreview() throws Exception {
        var image = upload(DraftKind.ALBUM);
        var row = rows.find(1L, "album");
        var list = (com.fasterxml.jackson.databind.node.ArrayNode) json.readTree(row.getImagesJson());
        var stored = (com.fasterxml.jackson.databind.node.ObjectNode) list.get(0);
        var original = (com.fasterxml.jackson.databind.node.ObjectNode) stored.get("original");
        original.put("url", stored.get("url").asText()).put("objectName", stored.get("objectName").asText());
        row.setImagesJson(json.writeValueAsString(list));
        drafts.publish(OWNER, DraftKind.ALBUM, new DraftDtos.PublishDto(albumFields(), null));
        verify(albumMapper).insertPhoto(argThat(p -> p.getPreviewUrl().equals(p.getOriginalUrl()) && p.getPreviewObjectName().equals(p.getOriginalObjectName())));
    }

    JsonNode diaryFields(String body) {
        return json.createObjectNode().put("contentMarkdown", body).put("date", "2026-05-20").put("moodKey", "calm").put("visibility", "shared");
    }
    @Test void diaryPromotesOnlyReferencedImagesAndDeletesUnusedAfterCommit() {
        var used = upload(DraftKind.DIARY); var unused = upload(DraftKind.DIARY);
        doAnswer(i -> { ((DiaryEntry)i.getArgument(0)).setId(24L); return 1; }).when(diaryMapper).insertDiary(any());
        doAnswer(i -> { ((DiaryImage)i.getArgument(0)).setId(42L); return 1; }).when(diaryMapper).insertImage(any());
        tx.beforeCommit = () -> assertThat(objects.deleted()).isEmpty();
        var result = (DiaryVos.DiarySummaryVo) drafts.publish(OWNER, DraftKind.DIARY, new DraftDtos.PublishDto(diaryFields("Hello ![x](" + used.url() + ")"), null));
        assertThat(result.imageUrls()).containsExactly(used.url());
        verify(diaryMapper).insertImage(argThat(i -> !i.isTemporary() && i.getUrl().equals(used.url())));
        verify(diaryMapper).markImagesPermanent(List.of(42L), LocalDateTime.now(CLOCK));
        verify(diaryMapper).insertImageReferences(eq(24L), argThat(list -> list.size() == 1 && list.get(0).getUploadId().equals(42L)));
        assertThat(objects.stored()).extracting(ObjectStore.StoredObject::url).containsExactly(used.url());
        assertThat(rows.rows).isEmpty();
    }

    @Test void diaryConflictAndForeignImageKeepLatestDraftWithoutCreatingRecords() {
        upload(DraftKind.DIARY);
        fails("DIARY_IMAGE_FORBIDDEN", () -> drafts.publish(OWNER, DraftKind.DIARY, new DraftDtos.PublishDto(diaryFields("![x](https://unowned.test/photo.jpg)"), null)));
        when(diaryMapper.existsActiveDiaryForRoleAndDate("boyfriend", LocalDate.of(2026, 5, 20), null)).thenReturn(true);
        fails("DIARY_DAY_ALREADY_EXISTS", () -> drafts.publish(OWNER, DraftKind.DIARY, new DraftDtos.PublishDto(diaryFields("Newest"), null)));
        assertThat(drafts.current(OWNER, DraftKind.DIARY).draft().fields().path("contentMarkdown").asText()).isEqualTo("Newest");
        verify(diaryMapper, never()).insertDiary(any()); verify(diaryMapper, never()).insertImage(any());
    }

    @Test void momentUsesDraftImagesInUploadOrder() {
        var a = upload(DraftKind.MOMENT); var b = upload(DraftKind.MOMENT);
        var form = fields("{\"title\":\"Walk\",\"eventTime\":\"2026-05-20T12:00:00\",\"locationName\":\"Park\",\"longitude\":0,\"latitude\":0,\"category\":\"daily\"}");
        var result = (StoryVos.StoryMomentVo) drafts.publish(OWNER, DraftKind.MOMENT, new DraftDtos.PublishDto(form, null));
        assertThat(result.images()).containsExactly(a.url(), b.url()); assertThat(rows.rows).isEmpty();
    }

    @Test void imageMutationSqlLocksRowsAndFieldsSqlCannotReplaceImages() throws Exception {
        String lock = DraftMapper.class.getMethod("lock", Long.class, String.class).getAnnotation(org.apache.ibatis.annotations.Select.class).value()[0];
        assertThat(lock).contains("for update", "user_id = #{userId}", "kind = #{kind}");
        String save = DraftMapper.class.getMethod("saveFields", Long.class, String.class, LocalDateTime.class).getAnnotation(org.apache.ibatis.annotations.Update.class).value()[0];
        assertThat(save).contains("fields_json").doesNotContain("images_json");
    }

    static class Rows implements DraftMapper {
        final Map<String, Draft> rows = new LinkedHashMap<>(); boolean failImages;
        String key(Long id, String kind) { return id + "/" + kind; }
        public Draft find(Long id, String kind) { return rows.get(key(id, kind)); }
        public Draft lock(Long id, String kind) { return find(id, kind); }
        public void ensure(Long id, String kind, LocalDateTime now) {
            rows.computeIfAbsent(key(id, kind), k -> { var d = new Draft(); d.setId((long)rows.size()+1); d.setUserId(id); d.setKind(kind); d.setFieldsJson("{}"); d.setImagesJson("[]"); d.setCreatedAt(now); d.setUpdatedAt(now); return d; });
        }
        Draft byId(Long id) { return rows.values().stream().filter(d -> d.getId().equals(id)).findFirst().orElseThrow(); }
        public void saveFields(Long id, String fields, LocalDateTime now) { byId(id).setFieldsJson(fields); byId(id).setUpdatedAt(now); }
        public void saveImages(Long id, String images, LocalDateTime now) { if (failImages) throw new IllegalStateException("simulated write failure"); byId(id).setImagesJson(images); byId(id).setUpdatedAt(now); }
        public void delete(Long id) { rows.values().removeIf(d -> d.getId().equals(id)); }
    }
    static class Transactions extends AbstractPlatformTransactionManager {
        Runnable beforeCommit = () -> {};
        protected Object doGetTransaction() { return new Object(); }
        protected void doBegin(Object transaction, TransactionDefinition definition) {}
        protected void doCommit(DefaultTransactionStatus status) { beforeCommit.run(); }
        protected void doRollback(DefaultTransactionStatus status) {}
    }
}
