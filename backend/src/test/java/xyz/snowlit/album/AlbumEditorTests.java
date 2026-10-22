package xyz.snowlit.album;

import com.fasterxml.jackson.databind.*;
import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.draft.*;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.storage.*;
import xyz.snowlit.support.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.*;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AlbumEditorTests {
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-05-20T12:00:00Z"), ZoneOffset.UTC);
    static final AuthenticatedActor MANAGER = actor(2, true);
    static AuthenticatedActor actor(long id, boolean manager) { return new AuthenticatedActor(id, "member", "Member", null, null, null, null, manager); }
    final ObjectMapper json = new ObjectMapper().findAndRegisterModules();
    final AlbumMapper mapper = mock(AlbumMapper.class);
    final DraftMapper draftMapper = mock(DraftMapper.class);
    final Map<Long, Album> albums = new LinkedHashMap<>();
    final Map<Long, AlbumPhoto> photos = new LinkedHashMap<>();
    final Map<String, Draft> draftRows = new LinkedHashMap<>();
    final InMemoryObjectStore objects = new InMemoryObjectStore();
    final ImageIntake intake = new ImageIntake(objects, CLOCK);
    final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    final Transactions tx = new Transactions();
    final TransactionTemplate transaction = new TransactionTemplate(tx);
    final DraftModule drafts = new DraftModule(draftMapper, json, intake, mock(AlbumModule.class), null, null, CLOCK, tx);
    final AlbumEditor editor = new AlbumEditor(mapper, drafts, passwords, intake, CLOCK);
    long nextDraft = 1, nextPhoto = 20;
    boolean failWrite;

    @BeforeEach void setup() {
        Album a = new Album(); a.setId(1L); a.setStatus("published"); a.setTitle("Before"); a.setDescription("Description");
        a.setEventDate(LocalDate.of(2026, 5, 1)); a.setLocation(""); a.setVisibility("public"); a.setPinned(false); a.setSortOrder(100);
        a.setCreatedByUserId(1L); a.setAuthorName("Original author"); a.setCreatedAt(LocalDateTime.of(2025, 1, 1, 0, 0));
        a.setPublishedAt(LocalDateTime.of(2025, 1, 2, 0, 0)); a.setViewCount(13); a.setLikeCount(7); albums.put(1L, a);
        for (long id : List.of(11L, 12L)) {
            AlbumPhoto p = new AlbumPhoto(); p.setId(id); p.setAlbumId(1L); p.setCaption("Existing"); p.setDescription("Keep");
            p.setTakenAt(a.getEventDate()); p.setLocation(""); p.setWidth(32); p.setHeight(24); p.setSortOrder((int)id - 10);
            p.setPreviewUrl("https://objects.test/preview" + id); p.setOriginalUrl("https://objects.test/original" + id);
            if (id == 11) { p.setOriginalObjectName("original11"); p.setPreviewObjectName("preview11"); }
            photos.put(id, p);
        }
        a.setCoverPhotoUrl(photos.get(11L).getPreviewUrl());
        when(mapper.lockAlbum(anyLong())).thenAnswer(i -> albums.get(i.getArgument(0)));
        when(mapper.findAlbumById(anyLong())).thenAnswer(i -> albums.get(i.getArgument(0)));
        when(mapper.findPhotosByAlbumId(anyLong())).thenAnswer(i -> photos.values().stream().filter(p -> p.getAlbumId().equals(i.getArgument(0))).sorted(Comparator.comparingInt(AlbumPhoto::getSortOrder)).toList());
        when(mapper.countPhotosByAlbumId(anyLong())).thenAnswer(i -> photos.size());
        doAnswer(i -> { if (failWrite) throw new IllegalStateException("simulated write failure"); return null; }).when(mapper).updateAlbum(any());
        doAnswer(i -> { photos.remove(i.getArgument(0)); return null; }).when(mapper).deletePhoto(anyLong());
        doAnswer(i -> { AlbumPhoto p = i.getArgument(0); p.setId(nextPhoto++); photos.put(p.getId(), p); return 1; }).when(mapper).insertPhoto(any());
        doAnswer(i -> { albums.remove(i.getArgument(0)); photos.clear(); return null; }).when(mapper).deleteAlbum(anyLong());
        when(draftMapper.lock(anyLong(), anyString())).thenAnswer(i -> draftRows.get(i.getArgument(0) + "/" + i.getArgument(1)));
        doAnswer(i -> {
            String key = i.getArgument(0) + "/" + i.getArgument(1);
            draftRows.computeIfAbsent(key, k -> { Draft d = new Draft(); d.setId(nextDraft++); d.setUserId(i.getArgument(0)); d.setKind(i.getArgument(1)); d.setFieldsJson("{}"); d.setImagesJson("[]"); d.setCreatedAt(LocalDateTime.now(CLOCK)); d.setUpdatedAt(LocalDateTime.now(CLOCK)); return d; });
            return null;
        }).when(draftMapper).ensure(anyLong(), anyString(), any());
        doAnswer(i -> { row(i.getArgument(0)).setFieldsJson(i.getArgument(1)); return null; }).when(draftMapper).saveFields(anyLong(), anyString(), any());
        doAnswer(i -> { row(i.getArgument(0)).setImagesJson(i.getArgument(1)); return null; }).when(draftMapper).saveImages(anyLong(), anyString(), any());
        doAnswer(i -> { draftRows.values().removeIf(d -> d.getId().equals(i.getArgument(0))); return null; }).when(draftMapper).delete(anyLong());
    }
    Draft row(Long id) { return draftRows.values().stream().filter(d -> d.getId().equals(id)).findFirst().orElseThrow(); }
    <T> T run(java.util.function.Supplier<T> action) { return transaction.execute(s -> action.get()); }
    void fails(String code, Runnable action) { assertThatThrownBy(action::run).isInstanceOfSatisfying(ApplicationFailure.class, f -> assertThat(f.code()).isEqualTo(code)); }
    AlbumDtos.AlbumPhotoEntryDto existing(long id) { return new AlbumDtos.AlbumPhotoEntryDto(id, null); }
    AlbumDtos.AlbumPhotoEntryDto added(String id) { return new AlbumDtos.AlbumPhotoEntryDto(null, id); }
    AlbumDtos.AlbumSaveDto request(String visibility, String password, boolean pinned, List<AlbumDtos.AlbumPhotoEntryDto> order) {
        return new AlbumDtos.AlbumSaveDto("After", "Changed", LocalDate.of(2026, 5, 20), "Park", visibility, password, pinned, order);
    }
    AlbumVos.AlbumDetailVo save(List<AlbumDtos.AlbumPhotoEntryDto> order) { return run(() -> editor.save(MANAGER, 1L, request("public", null, true, order))); }
    void start() { run(() -> editor.start(MANAGER, 1L)); }
    DraftVos.DraftImageVo upload() { return run(() -> editor.upload(MANAGER, 1L, TestImages.jpeg("file", "x.jpg"), null, null, json.createObjectNode().put("width",32).put("height",24))); }
    String state() throws Exception { return json.writeValueAsString(List.of(albums, photos, draftRows)); }

    @Test void nonManagersCannotUseAnyOperation() {
        var actor = actor(3, false);
        for (Runnable action : List.<Runnable>of(() -> editor.start(actor, 1L), () -> editor.upload(actor, 1L, null, null, null, null),
                () -> editor.remove(actor, 1L, "id"), () -> editor.cancel(actor, 1L), () -> editor.save(actor, 1L, null), () -> editor.delete(actor, 1L))) fails("ALBUM_FORBIDDEN", action);
        verifyNoInteractions(draftMapper);
    }
    @Test void anotherManagerCanStartAndSavePrivateWithoutTokenAndDelete() {
        albums.get(1L).setVisibility("private"); albums.get(1L).setPrivatePasswordHash(passwords.encode("fixture-only"));
        var started = run(() -> editor.start(MANAGER, 1L));
        assertThat(started.album().hasPassword()).isTrue();
        var result = run(() -> editor.save(MANAGER, 1L, request("private", null, false, List.of(existing(11), existing(12)))));
        assertThat(result.canManage()).isTrue(); assertThat(result.album().sortOrder()).isEqualTo(100);
        run(() -> { editor.delete(MANAGER, 1L); return null; }); assertThat(albums).isEmpty();
    }
    @Test void startReplacesSameAndDifferentAlbumDraftAfterCommit() {
        start(); upload();
        tx.beforeCommit = () -> assertThat(objects.deleted()).isEmpty();
        start(); assertThat(objects.deleted()).hasSize(2);
        tx.beforeCommit = () -> {}; upload(); tx.beforeCommit = () -> assertThat(objects.deleted()).hasSize(2);
        Album other = json.convertValue(albums.get(1L), Album.class); other.setId(2L); albums.put(2L, other);
        run(() -> editor.start(MANAGER, 2L)); assertThat(objects.deleted()).hasSize(4);
        fails("ALBUM_EDIT_EXPIRED", this::upload);
        assertThat(draftRows).hasSize(1);
    }
    @Test void fullAlbumStillTakesUploadsBecauseSaveDecidesTheFinalCount() {
        // The member may have removed photos on screen; only the saved list is held to 50.
        for (long id = 13; id <= 60; id++) {
            AlbumPhoto copy = json.convertValue(photos.get(12L), AlbumPhoto.class); copy.setId(id); copy.setSortOrder((int) id - 10); photos.put(id, copy);
        }
        start(); var image = upload();
        var order = new ArrayList<AlbumDtos.AlbumPhotoEntryDto>();
        for (long id = 12; id <= 60; id++) order.add(existing(id));
        order.add(added(image.id()));
        assertThat(save(order).photos()).hasSize(50);
    }
    @Test void editDraftHoldsAtMostFiftyUploads() {
        start(); for (int i = 0; i < 50; i++) upload();
        fails("ALBUM_PHOTO_LIMIT_EXCEEDED", this::upload); assertThat(objects.stored()).hasSize(100);
    }
    @Test void saveUpdatesFieldsOrdersPhotosCoverAndPreservesProvenanceCountsAndTimes() {
        start(); var image = upload(); var unused = upload();
        tx.beforeCommit = () -> assertThat(objects.deleted()).isEmpty();
        var result = save(List.of(added(image.id()), existing(12)));
        assertThat(result.photos()).extracting(AlbumVos.AlbumPhotoVo::sortOrder).containsExactly(1,2);
        assertThat(result.photos()).extracting(AlbumVos.AlbumPhotoVo::previewUrl).containsExactly(image.url(), "https://objects.test/preview12");
        assertThat(result.album().coverPhotoUrl()).isEqualTo(image.url()); assertThat(result.album().title()).isEqualTo("After");
        assertThat(result.album().description()).isEqualTo("Changed"); assertThat(result.album().location()).isEqualTo("Park");
        assertThat(result.album().eventDate()).isEqualTo(LocalDate.of(2026,5,20)); assertThat(result.album().sortOrder()).isEqualTo(10);
        assertThat(result.album().viewCount()).isEqualTo(13); assertThat(result.album().likeCount()).isEqualTo(7);
        assertThat(albums.get(1L).getPublishedAt()).isEqualTo(LocalDateTime.of(2025,1,2,0,0));
        assertThat(result.album().createdAt()).isEqualTo(LocalDateTime.of(2025,1,1,0,0));
        assertThat(albums.get(1L).getCreatedByUserId()).isEqualTo(1L); assertThat(result.album().authorName()).isEqualTo("Original author");
        assertThat(photos).doesNotContainKey(11L); assertThat(draftRows).isEmpty();
        assertThat(result.photos().get(0).takenAt()).isEqualTo(LocalDate.of(2026,5,20)); assertThat(result.photos().get(0).caption()).isEqualTo("未命名照片");
        assertThat(objects.deleted()).contains("original11","preview11").hasSize(4);
        assertThat(objects.stored()).extracting(ObjectStore.StoredObject::url).contains(image.url()).doesNotContain(unused.url());
    }
    @Test void invalidPhotoListsLeaveAlbumDraftPhotosAndStorageIntact() throws Exception {
        start(); upload(); String before = state();
        for (var order : List.of(List.<AlbumDtos.AlbumPhotoEntryDto>of(), List.of(existing(999)), List.of(existing(11),existing(11)),
                List.of(added("unknown")), List.of(new AlbumDtos.AlbumPhotoEntryDto(11L,"id")), List.of(new AlbumDtos.AlbumPhotoEntryDto(null,null)))) {
            fails(order.isEmpty() ? "ALBUM_PHOTO_REQUIRED" : "ALBUM_PHOTOS_INVALID", () -> save(order));
            assertThat(state()).isEqualTo(before); assertThat(objects.deleted()).isEmpty();
        }
        fails("ALBUM_PHOTO_LIMIT_EXCEEDED", () -> save(Collections.nCopies(51, existing(11))));
    }
    @Test void fieldValidationAndExpiredDraftLeaveAllStateUntouched() throws Exception {
        start(); upload(); String before=state();
        fails("ALBUM_TITLE_REQUIRED",() -> run(() -> editor.save(MANAGER,1L,new AlbumDtos.AlbumSaveDto("", "",LocalDate.now(CLOCK),"","public",null,false,List.of(existing(12))))));
        assertThat(state()).isEqualTo(before); assertThat(objects.deleted()).isEmpty();
        editor.cancel(MANAGER,1L);
        fails("ALBUM_EDIT_EXPIRED",() -> save(List.of(added("expired"))));
    }
    @Test void removingNewPhotoCleansAfterCommitAndNoObjectNamesInEditResponses() throws Exception {
        start(); var image=upload();
        String response=json.writeValueAsString(run(() -> editor.start(actor(1,true),1L)));
        assertThat(response).doesNotContain("ObjectName","objectName","PasswordHash","passwordHash");
        tx.beforeCommit=() -> assertThat(objects.deleted()).isEmpty();
        run(() -> {editor.remove(MANAGER,1L,image.id());return null;});
        assertThat(objects.deleted()).hasSize(2);
    }
    @Test void failedDatabaseWriteRollsBackEverythingAndNeverCleansStorage() throws Exception {
        start(); upload(); String before = state(); failWrite = true;
        assertThatThrownBy(() -> save(List.of(existing(12)))).hasMessage("simulated write failure");
        assertThat(state()).isEqualTo(before); assertThat(objects.deleted()).isEmpty();
    }
    @Test void passwordKeepsChangesClearsAndRequiresWithLockReset() {
        albums.get(1L).setVisibility("private"); String hash = passwords.encode("fixture-only"); albums.get(1L).setPrivatePasswordHash(hash);
        run(() -> editor.save(MANAGER,1L,request("private","  ",false,List.of(existing(11),existing(12)))));
        assertThat(albums.get(1L).getPrivatePasswordHash()).isEqualTo(hash); verify(mapper,never()).clearAlbumUnlockFailures(any());
        run(() -> editor.save(MANAGER,1L,request("private","changed-fixture",false,List.of(existing(11),existing(12)))));
        assertThat(passwords.matches("changed-fixture",albums.get(1L).getPrivatePasswordHash())).isTrue();
        save(List.of(existing(11),existing(12))); assertThat(albums.get(1L).getPrivatePasswordHash()).isNull();
        verify(mapper,times(2)).clearAlbumUnlockFailures(1L);
        fails("ALBUM_PRIVATE_PASSWORD_REQUIRED", () -> run(() -> editor.save(MANAGER,1L,request("private",null,false,List.of(existing(11),existing(12))))));
    }
    @Test void deleteCleansAfterCommitSkipsNullNamesAndIsNotFoundAgain() {
        tx.beforeCommit = () -> { assertThat(albums).isEmpty(); assertThat(photos).isEmpty(); assertThat(objects.deleted()).isEmpty(); };
        run(() -> { editor.delete(MANAGER,1L); return null; }); assertThat(objects.deleted()).containsExactly("original11","preview11");
        fails("ALBUM_NOT_FOUND", () -> run(() -> { editor.delete(MANAGER,1L); return null; }));
    }
    @Test void deletedAlbumBlocksUploadAndSaveButCancelStillCleansEditDraft() {
        start(); upload(); run(() -> { editor.delete(actor(1,true),1L); return null; });
        assertThat(draftRows).hasSize(1);
        fails("ALBUM_NOT_FOUND", () -> save(List.of(existing(11)))); fails("ALBUM_NOT_FOUND",this::upload);
        editor.cancel(MANAGER,1L); editor.cancel(MANAGER,1L); assertThat(draftRows).isEmpty();
    }
    @Test void unpublishedAlbumsCannotBeEditedOrDeleted() {
        albums.get(1L).setStatus("draft"); fails("ALBUM_NOT_FOUND",this::start);
        fails("ALBUM_NOT_FOUND",() -> save(List.of(existing(11))));
        fails("ALBUM_NOT_FOUND",() -> run(() -> {editor.delete(MANAGER,1L);return null;}));
    }
    @ParameterizedTest @ValueSource(strings={"title","description","location"}) void sharedLengthChecks(String field) {
        var fields = new AlbumDtos.AlbumCreateDto(field.equals("title")?"x".repeat(121):"Title",field.equals("description")?"x".repeat(501):"",LocalDate.now(CLOCK),field.equals("location")?"x".repeat(121):"","public",null,false);
        String code="ALBUM_"+field.toUpperCase()+"_TOO_LONG";
        fails(code,() -> new AlbumPublisher(mapper,passwords,CLOCK).create(MANAGER,fields,List.of(photos.get(11L))));
        fails(code,() -> run(() -> editor.save(MANAGER,1L,new AlbumDtos.AlbumSaveDto(fields.title(),fields.description(),fields.eventDate(),fields.location(),fields.visibility(),null,false,List.of(existing(11))))));
    }
    class Transactions extends AbstractPlatformTransactionManager {
        boolean active; String snapshot; Runnable beforeCommit=()->{};
        protected Object doGetTransaction(){return new Object();}
        protected boolean isExistingTransaction(Object o){return active;}
        protected void doBegin(Object o,TransactionDefinition d){active=true;try{snapshot=state();}catch(Exception e){throw new RuntimeException(e);}}
        protected void doCommit(DefaultTransactionStatus s){beforeCommit.run();}
        protected void doSetRollbackOnly(DefaultTransactionStatus s){}
        protected void doRollback(DefaultTransactionStatus s){
            try { var root=json.readTree(snapshot); restore(albums,root.get(0),Long.class,Album.class); restore(photos,root.get(1),Long.class,AlbumPhoto.class); restore(draftRows,root.get(2),String.class,Draft.class); }
            catch(Exception e){throw new RuntimeException(e);}
        }
        <K,V> void restore(Map<K,V> map,JsonNode node,Class<K> key,Class<V> value){map.clear();map.putAll(json.convertValue(node,json.getTypeFactory().constructMapType(LinkedHashMap.class,key,value)));}
        protected void doCleanupAfterCompletion(Object o){active=false;}
    }
}
