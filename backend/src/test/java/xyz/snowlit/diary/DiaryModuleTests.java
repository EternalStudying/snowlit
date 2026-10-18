package xyz.snowlit.diary;

import xyz.snowlit.storage.ObjectStore;

import xyz.snowlit.auth.AuthenticatedActor;
import xyz.snowlit.failure.ApplicationFailure;
import xyz.snowlit.diary.DiaryDtos.DiaryCreateDto;
import xyz.snowlit.diary.DiaryDtos.DiaryUpdateDto;
import xyz.snowlit.diary.DiaryDtos.DiaryWeatherSnapshotDto;
import xyz.snowlit.home.HomeLocation;
import xyz.snowlit.home.HomeMapper;
import xyz.snowlit.diary.DiaryVos.DiaryDetailVo;
import xyz.snowlit.diary.DiaryVos.DiaryMonthListVo;
import xyz.snowlit.diary.DiaryVos.DiaryMonthsVo;
import xyz.snowlit.diary.DiaryVos.DiarySummaryVo;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DiaryModuleTests {

    private static final AuthenticatedActor ACTOR =
            new AuthenticatedActor(1L, "demo_a", "伴侣 B", null, null, null, "girlfriend");
    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-05-17T12:00:00Z"), ZoneId.of("Asia/Singapore"));

    private final DiaryMapper diaryMapper = mock(DiaryMapper.class);
    private final HomeMapper homeMapper = mock(HomeMapper.class);
    private final DiaryImages imageStorageService = mock(DiaryImages.class);
    private final DiaryModule diaryService =
            new DiaryModule(diaryMapper, homeMapper, imageStorageService, CLOCK);

    @Test
    void accountWithoutCoupleRoleCannotUseDiaries() {
        AuthenticatedActor withoutRole = new AuthenticatedActor(3L, "guest", "游客", null, null, null, null);

        assertThatThrownBy(() -> diaryService.months(withoutRole, null))
                .isInstanceOfSatisfying(ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("DIARY_ROLE_NOT_CONFIGURED"));
    }

    @Test
    void monthsReturnTwelveMonthsForRequestedYearUsingVisibleEntriesOnly() {
        when(diaryMapper.findVisibleMonthCounts(1L, "girlfriend", 2026)).thenReturn(List.of(
                new DiaryMonthCount(2026, 5, 2),
                new DiaryMonthCount(2026, 6, 1)
        ));

        DiaryMonthsVo months = diaryService.months(ACTOR, 2026);

        assertThat(months.years()).hasSize(1);
        assertThat(months.years().get(0).year()).isEqualTo(2026);
        assertThat(months.years().get(0).months()).hasSize(12);
        assertThat(months.years().get(0).months().get(4).month()).isEqualTo("2026-05");
        assertThat(months.years().get(0).months().get(4).count()).isEqualTo(2);
        assertThat(months.years().get(0).months().get(4).hasEntries()).isTrue();
        assertThat(months.years().get(0).months().get(5).count()).isEqualTo(1);
        assertThat(months.years().get(0).months().get(0).count()).isZero();
        assertThat(months.years().get(0).months().get(0).hasEntries()).isFalse();
        verify(diaryMapper).findVisibleMonthCounts(1L, "girlfriend", 2026);
    }

    @Test
    void monthsWithoutRequestedYearUsesGroupedVisibleYearsAndStillFillsEmptyMonths() {
        when(diaryMapper.findVisibleMonthCounts(1L, "girlfriend", null)).thenReturn(List.of(
                new DiaryMonthCount(2025, 12, 1),
                new DiaryMonthCount(2026, 5, 2)
        ));

        DiaryMonthsVo months = diaryService.months(ACTOR, null);

        assertThat(months.years()).extracting(year -> year.year()).containsExactly(2026, 2025);
        assertThat(months.years().get(0).months()).hasSize(12);
        assertThat(months.years().get(0).months().get(4).month()).isEqualTo("2026-05");
        assertThat(months.years().get(0).months().get(4).count()).isEqualTo(2);
        assertThat(months.years().get(1).months().get(11).month()).isEqualTo("2025-12");
        assertThat(months.years().get(1).months().get(11).count()).isEqualTo(1);
        verify(diaryMapper).findVisibleMonthCounts(1L, "girlfriend", null);
    }

    @Test
    void monthListReturnsSummariesWithoutMarkdownBody() {
        when(diaryMapper.findVisibleEntriesByMonth(1L, "girlfriend", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 6, 1)))
                .thenReturn(List.of(diary(10L, 1L, "girlfriend", "shared", false)));
        when(diaryMapper.findImageUrlsByDiaryIds(List.of(10L))).thenReturn(List.of());

        DiaryMonthListVo month = diaryService.listByMonth(ACTOR, "2026-05");

        assertThat(month.month()).isEqualTo("2026-05");
        assertThat(month.items()).extracting(DiarySummaryVo::title).containsExactly("今天的光");
        assertThat(month.items().get(0).authorName()).isEqualTo("伴侣 B");
        assertThat(month.items().get(0).authorAvatar()).contains("partner-b");
        assertThat(month.items().get(0).moodKey()).isEqualTo("happy");
        assertThat(Arrays.stream(DiarySummaryVo.class.getRecordComponents()).map(component -> component.getName()))
                .doesNotContain("contentMarkdown")
                .contains("imageUrls", "visibility");
        verify(diaryMapper, never()).findImageUrlsByDiaryId(anyLong());
    }

    @Test
    void monthListBatchesImageUrlsForAllSummariesKeepingReferenceOrder() {
        when(diaryMapper.findVisibleEntriesByMonth(1L, "girlfriend", LocalDate.of(2026, 5, 1), LocalDate.of(2026, 6, 1)))
                .thenReturn(List.of(
                        diary(10L, 1L, "girlfriend", "shared", false),
                        diary(11L, 2L, "boyfriend", "shared", false),
                        diary(12L, 1L, "girlfriend", "shared", false)
                ));
        when(diaryMapper.findImageUrlsByDiaryIds(List.of(10L, 11L, 12L))).thenReturn(List.of(
                imageReference(10L, "https://cdn.example.com/diary/10-a.webp"),
                imageReference(10L, "https://cdn.example.com/diary/10-b.webp"),
                imageReference(11L, "https://cdn.example.com/diary/11-a.webp")
        ));

        DiaryMonthListVo month = diaryService.listByMonth(ACTOR, "2026-05");

        assertThat(month.items()).hasSize(3);
        assertThat(month.items().get(0).imageUrls()).containsExactly(
                "https://cdn.example.com/diary/10-a.webp",
                "https://cdn.example.com/diary/10-b.webp"
        );
        assertThat(month.items().get(1).imageUrls()).containsExactly("https://cdn.example.com/diary/11-a.webp");
        assertThat(month.items().get(2).imageUrls()).isEmpty();
        verify(diaryMapper).findImageUrlsByDiaryIds(List.of(10L, 11L, 12L));
        verify(diaryMapper, never()).findImageUrlsByDiaryId(anyLong());
    }

    @Test
    void detailHandlesPrivateVisibilityAndDeletedState() {
        when(diaryMapper.findDiaryById(10L)).thenReturn(diary(10L, 1L, "girlfriend", "shared", false));
        when(diaryMapper.findImageUrlsByDiaryId(10L)).thenReturn(List.of("https://static.example.com/diary/one.webp"));

        DiaryDetailVo detail = diaryService.getDetail(ACTOR, 10L);

        assertThat(detail.contentMarkdown()).contains("# 今天的光");
        assertThat(detail.imageUrls()).containsExactly("https://static.example.com/diary/one.webp");

        when(diaryMapper.findDiaryById(11L)).thenReturn(diary(11L, 2L, "boyfriend", "private", false));
        assertThatThrownBy(() -> diaryService.getDetail(ACTOR, 11L))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("DIARY_NOT_FOUND")
                );

        when(diaryMapper.findDiaryById(12L)).thenReturn(diary(12L, 1L, "girlfriend", "shared", true));
        assertThatThrownBy(() -> diaryService.getDetail(ACTOR, 12L))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("DIARY_DELETED")
                );
    }

    @Test
    void createExtractsTitleUsesRoleWeatherSnapshotAndMaintainsImageReferences() {
        DiaryCreateDto request = new DiaryCreateDto(
                "# 新标题\n\n今天很好。\n\n![图](https://cdn.example.com/diary/tmp/one.webp)",
                LocalDate.of(2026, 5, 17),
                "happy",
                "shared",
                new DiaryWeatherSnapshotDto("晴", "晴", 22.0, "东风", "≤3", "60", "示例地区 A", "示例城市 A", "示例街区 A", "示例街区 A", 52.52, 13.41)
        );
        DiaryImage image = image(100L, 1L, "https://cdn.example.com/diary/tmp/one.webp", true);
        when(diaryMapper.existsActiveDiaryForRoleAndDate("girlfriend", LocalDate.of(2026, 5, 17), null)).thenReturn(false);
        when(diaryMapper.findImagesByUrls(List.of("https://cdn.example.com/diary/tmp/one.webp"))).thenReturn(List.of(image));

        DiarySummaryVo created = diaryService.create(ACTOR, request);

        assertThat(created.title()).isEqualTo("新标题");
        assertThat(created.summary()).isEqualTo("今天很好。");
        verify(diaryMapper).insertDiary(any(DiaryEntry.class));
        verify(diaryMapper).markImagesPermanent(List.of(100L), LocalDateTime.of(2026, 5, 17, 20, 0));
        verify(diaryMapper).replaceImageReferences(eq(created.id()), any());
    }

    @Test
    void createRejectsUnregisteredMarkdownImageUrl() {
        DiaryCreateDto request = new DiaryCreateDto(
                "# 外部图片\n\n![图](https://evil.example.com/not-registered.png)",
                LocalDate.of(2026, 5, 19),
                "happy",
                "shared",
                null
        );
        when(diaryMapper.existsActiveDiaryForRoleAndDate("girlfriend", LocalDate.of(2026, 5, 19), null)).thenReturn(false);
        when(diaryMapper.findImagesByUrls(List.of("https://evil.example.com/not-registered.png"))).thenReturn(List.of());

        assertThatThrownBy(() -> diaryService.create(ACTOR, request))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("DIARY_IMAGE_FORBIDDEN")
                )
                .hasMessageContaining("不能引用这张图片");

        verify(diaryMapper, never()).insertDiary(any(DiaryEntry.class));
        verify(diaryMapper, never()).replaceImageReferences(any(), any());
    }

    @Test
    void createRejectsTemporaryImageUploadedByAnotherUser() {
        DiaryCreateDto request = new DiaryCreateDto(
                "# 别人的临时图\n\n![图](https://cdn.example.com/diary/tmp/other.webp)",
                LocalDate.of(2026, 5, 19),
                "happy",
                "shared",
                null
        );
        when(diaryMapper.existsActiveDiaryForRoleAndDate("girlfriend", LocalDate.of(2026, 5, 19), null)).thenReturn(false);
        when(diaryMapper.findImagesByUrls(List.of("https://cdn.example.com/diary/tmp/other.webp")))
                .thenReturn(List.of(image(200L, 2L, "https://cdn.example.com/diary/tmp/other.webp", true)));

        assertThatThrownBy(() -> diaryService.create(ACTOR, request))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("DIARY_IMAGE_FORBIDDEN")
                )
                .hasMessageContaining("不能引用这张图片");

        verify(diaryMapper, never()).insertDiary(any(DiaryEntry.class));
        verify(diaryMapper, never()).replaceImageReferences(any(), any());
    }

    @Test
    void createStoresOnlyRegisteredImageReferencesWithNonNullUploadId() {
        DiaryCreateDto request = new DiaryCreateDto(
                "# 合法图片\n\n![图](https://cdn.example.com/diary/tmp/own.webp)",
                LocalDate.of(2026, 5, 19),
                "happy",
                "shared",
                null
        );
        when(diaryMapper.existsActiveDiaryForRoleAndDate("girlfriend", LocalDate.of(2026, 5, 19), null)).thenReturn(false);
        when(diaryMapper.findImagesByUrls(List.of("https://cdn.example.com/diary/tmp/own.webp")))
                .thenReturn(List.of(image(201L, 1L, "https://cdn.example.com/diary/tmp/own.webp", true)));

        DiarySummaryVo created = diaryService.create(ACTOR, request);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<DiaryImageReference>> referencesCaptor = ArgumentCaptor.forClass(List.class);
        verify(diaryMapper).replaceImageReferences(eq(created.id()), referencesCaptor.capture());
        assertThat(referencesCaptor.getValue()).hasSize(1);
        assertThat(referencesCaptor.getValue().get(0).getUploadId()).isEqualTo(201L);
        assertThat(referencesCaptor.getValue().get(0).getImageUrl()).isEqualTo("https://cdn.example.com/diary/tmp/own.webp");
    }

    @Test
    void createFallsBackToLatestHomeLocationWhenWeatherSnapshotMissing() {
        HomeLocation location = new HomeLocation();
        location.setRole("girlfriend");
        location.setProvince("示例地区 A");
        location.setCity("示例城市 A");
        location.setDistrict("示例街区 A");
        location.setWeather("多云");
        location.setTemperature(21.0);
        location.setLatitude(52.52);
        location.setLongitude(13.41);
        when(homeMapper.findLocationByRole("girlfriend")).thenReturn(location);
        when(diaryMapper.existsActiveDiaryForRoleAndDate("girlfriend", LocalDate.of(2026, 5, 18), null)).thenReturn(false);
        when(diaryMapper.findImagesByUrls(List.of())).thenReturn(List.of());

        diaryService.create(ACTOR, new DiaryCreateDto("# 兜底位置\n\n正文", LocalDate.of(2026, 5, 18), "calm", "private", null));

        verify(diaryMapper).insertDiary(any(DiaryEntry.class));
    }

    @Test
    void updateKeepsDateAuthorAndDeletesOnlyUnreferencedImages() {
        DiaryEntry existing = diary(10L, 1L, "girlfriend", "shared", false);
        existing.setEntryDate(LocalDate.of(2026, 5, 1));
        when(diaryMapper.findDiaryById(10L)).thenReturn(existing);
        when(diaryMapper.findImagesByUrls(List.of())).thenReturn(List.of());
        when(diaryMapper.findImagesReferencedByDiary(10L)).thenReturn(List.of(image(100L, 1L, "https://cdn.example.com/old.webp", false)));
        when(diaryMapper.countActiveReferencesForUpload(100L)).thenReturn(0);

        DiaryDetailVo updated = diaryService.update(ACTOR, 10L, new DiaryUpdateDto("# 改过标题\n\n正文", "sweet", "private"));

        assertThat(updated.title()).isEqualTo("改过标题");
        assertThat(updated.entryDate()).isEqualTo(LocalDate.of(2026, 5, 1));
        verify(diaryMapper).updateDiary(any(DiaryEntry.class));
        verify(imageStorageService).delete("diary/final/one.webp");
        verify(diaryMapper).markUploadDeleted(100L, LocalDateTime.of(2026, 5, 17, 20, 0));
    }

    @Test
    void updateRejectsUnregisteredMarkdownImageUrl() {
        DiaryEntry existing = diary(10L, 1L, "girlfriend", "shared", false);
        when(diaryMapper.findDiaryById(10L)).thenReturn(existing);
        when(diaryMapper.findImagesReferencedByDiary(10L)).thenReturn(List.of());
        when(diaryMapper.findImagesByUrls(List.of("https://evil.example.com/edit.png"))).thenReturn(List.of());

        assertThatThrownBy(() -> diaryService.update(
                ACTOR,
                10L,
                new DiaryUpdateDto("# 编辑\n\n![图](https://evil.example.com/edit.png)", "sweet", "shared")
        ))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("DIARY_IMAGE_FORBIDDEN")
                )
                .hasMessageContaining("不能引用这张图片");

        verify(diaryMapper, never()).updateDiary(any(DiaryEntry.class));
        verify(diaryMapper, never()).replaceImageReferences(any(), any());
    }

    @Test
    void updateRejectsDeletedRegisteredImage() {
        DiaryEntry existing = diary(10L, 1L, "girlfriend", "shared", false);
        DiaryImage image = image(202L, 1L, "https://cdn.example.com/deleted.webp", false);
        image.setDeleted(true);
        when(diaryMapper.findDiaryById(10L)).thenReturn(existing);
        when(diaryMapper.findImagesReferencedByDiary(10L)).thenReturn(List.of());
        when(diaryMapper.findImagesByUrls(List.of("https://cdn.example.com/deleted.webp"))).thenReturn(List.of(image));

        assertThatThrownBy(() -> diaryService.update(
                ACTOR,
                10L,
                new DiaryUpdateDto("# 编辑\n\n![图](https://cdn.example.com/deleted.webp)", "sweet", "shared")
        ))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("DIARY_IMAGE_FORBIDDEN")
                )
                .hasMessageContaining("不能引用这张图片");

        verify(diaryMapper, never()).updateDiary(any(DiaryEntry.class));
        verify(diaryMapper, never()).replaceImageReferences(any(), any());
    }

    @Test
    void deleteIsSoftDeleteAndRequiresAuthor() {
        when(diaryMapper.findDiaryById(10L)).thenReturn(diary(10L, 2L, "boyfriend", "shared", false));
        assertThatThrownBy(() -> diaryService.delete(ACTOR, 10L))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("DIARY_FORBIDDEN")
                );

        when(diaryMapper.findDiaryById(11L)).thenReturn(diary(11L, 1L, "girlfriend", "shared", false));
        when(diaryMapper.findImagesReferencedByDiary(11L)).thenReturn(List.of(image(100L, 1L, "https://cdn.example.com/old.webp", false)));
        when(diaryMapper.countActiveReferencesForUpload(100L)).thenReturn(0);

        diaryService.delete(ACTOR, 11L);

        verify(diaryMapper).softDeleteDiary(11L, LocalDateTime.of(2026, 5, 17, 20, 0));
        verify(imageStorageService).delete("diary/final/one.webp");
    }

    @Test
    void uploadValidatesImageTypeAndSizeThenStoresTemporaryImage() {
        MockMultipartFile file = new MockMultipartFile("file", "note.png", MediaType.IMAGE_PNG_VALUE, "png".getBytes());
        when(imageStorageService.uploadTemporary(file, 1L)).thenReturn(new ObjectStore.StoredObject(
                "diary/tmp/1/one.png",
                "https://cdn.example.com/diary/tmp/1/one.png",
                MediaType.IMAGE_PNG_VALUE,
                3L
        ));

        assertThat(diaryService.uploadImage(ACTOR, file).url()).isEqualTo("https://cdn.example.com/diary/tmp/1/one.png");
        verify(diaryMapper).insertImage(any(DiaryImage.class));

        MockMultipartFile badType = new MockMultipartFile("file", "note.txt", MediaType.TEXT_PLAIN_VALUE, "text".getBytes());
        assertThatThrownBy(() -> diaryService.uploadImage(ACTOR, badType))
                .isInstanceOfSatisfying(
                        ApplicationFailure.class,
                        failure -> assertThat(failure.code()).isEqualTo("DIARY_IMAGE_TYPE_INVALID")
                );
    }

    @Test
    void uploadAcceptsMiniProgramImageWhenFilenameOrContentTypeIsWeak() {
        when(imageStorageService.uploadTemporary(any(MockMultipartFile.class), eq(1L)))
                .thenAnswer(invocation -> {
                    MockMultipartFile file = invocation.getArgument(0);
                    return new ObjectStore.StoredObject(
                            "diary/tmp/1/wx.png",
                            "https://cdn.example.com/diary/tmp/1/wx.png",
                            file.getContentType(),
                            file.getSize()
                    );
                });

        MockMultipartFile noExtension = new MockMultipartFile("file", "tmp", MediaType.IMAGE_PNG_VALUE, pngBytes());
        MockMultipartFile octetStream = new MockMultipartFile("file", "tmp.png", MediaType.APPLICATION_OCTET_STREAM_VALUE, pngBytes());
        MockMultipartFile weakMetadata = new MockMultipartFile("file", "tmp", MediaType.APPLICATION_OCTET_STREAM_VALUE, pngBytes());

        assertThat(diaryService.uploadImage(ACTOR, noExtension).url()).contains("/diary/tmp/1/wx.png");
        assertThat(diaryService.uploadImage(ACTOR, octetStream).url()).contains("/diary/tmp/1/wx.png");
        assertThat(diaryService.uploadImage(ACTOR, weakMetadata).url()).contains("/diary/tmp/1/wx.png");
    }

    @Test
    void cleanupExpiredTemporaryImagesDeletesOnlyUnreferencedUploads() {
        DiaryImage expired = image(200L, 1L, "https://cdn.example.com/diary/tmp/old.png", true);
        expired.setObjectName("diary/tmp/1/old.png");
        DiaryImage referenced = image(201L, 1L, "https://cdn.example.com/diary/tmp/referenced.png", true);
        referenced.setObjectName("diary/tmp/1/referenced.png");
        when(diaryMapper.findExpiredTemporaryImages(LocalDateTime.of(2026, 5, 17, 14, 0))).thenReturn(List.of(expired, referenced));
        when(diaryMapper.countActiveReferencesForUpload(200L)).thenReturn(0);
        when(diaryMapper.countActiveReferencesForUpload(201L)).thenReturn(1);

        diaryService.cleanupExpiredTemporaryImages();

        verify(imageStorageService).delete("diary/tmp/1/old.png");
        verify(diaryMapper).markUploadDeleted(200L, LocalDateTime.of(2026, 5, 17, 20, 0));
    }

    private DiaryEntry diary(Long id, Long authorUserId, String role, String visibility, boolean deleted) {
        DiaryEntry diary = new DiaryEntry();
        diary.setId(id);
        diary.setRole(role);
        diary.setAuthorUserId(authorUserId);
        diary.setAuthorName(authorUserId.equals(1L) ? "伴侣 B" : "伴侣 A");
        diary.setContentMarkdown("# 今天的光\n\n今天很好。");
        diary.setTitle("今天的光");
        diary.setSummary("今天很好。");
        diary.setVisibility(visibility);
        diary.setMoodKey("happy");
        diary.setEntryDate(LocalDate.of(2026, 5, 17));
        diary.setWeather("晴");
        diary.setRawWeather("晴");
        diary.setTemperature(22.0);
        diary.setWindDirection("东风");
        diary.setWindPower("≤3");
        diary.setHumidity("60");
        diary.setProvince("示例地区 A");
        diary.setCity("示例城市 A");
        diary.setDistrict("示例街区 A");
        diary.setLocationName("示例街区 A");
        diary.setLatitude(52.52);
        diary.setLongitude(13.41);
        diary.setCreatedAt(LocalDateTime.of(2026, 5, 17, 18, 0));
        diary.setUpdatedAt(LocalDateTime.of(2026, 5, 17, 18, 0));
        diary.setDeleted(deleted);
        return diary;
    }

    private DiaryImage image(Long id, Long userId, String url, boolean temporary) {
        DiaryImage image = new DiaryImage();
        image.setId(id);
        image.setUploaderUserId(userId);
        image.setUrl(url);
        image.setObjectName(temporary ? "diary/tmp/one.webp" : "diary/final/one.webp");
        image.setContentType("image/webp");
        image.setSizeBytes(1024L);
        image.setTemporary(temporary);
        image.setDeleted(false);
        image.setCreatedAt(LocalDateTime.of(2026, 5, 17, 18, 0));
        return image;
    }

    private DiaryImageReference imageReference(Long diaryId, String url) {
        DiaryImageReference reference = new DiaryImageReference();
        reference.setDiaryId(diaryId);
        reference.setImageUrl(url);
        return reference;
    }

    private byte[] pngBytes() {
        return new byte[] {
                (byte) 0x89, 0x50, 0x4e, 0x47,
                0x0d, 0x0a, 0x1a, 0x0a,
                0x00, 0x00, 0x00, 0x0d
        };
    }
}
