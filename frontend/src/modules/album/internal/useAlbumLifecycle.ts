import { computed, ref } from 'vue';
import type {
  AlbumCollection,
  AlbumCreatePayload,
  AlbumData,
  AlbumDetailData,
  AlbumDraftData,
  AlbumPhoto,
  AlbumPhotoData,
  AlbumPhotoUploadMetadata
} from '../model';
import { createHttpAlbumGateway } from './httpAlbumGateway';
import { createBrowserPrivateAccessStore } from './browserPrivateAccessStore';
import type { HttpAdapter } from '../../../http/sessionRequest';
import type { AlbumPreviewGenerator } from './ports';
import { createAlbumUploadQueue } from './uploadQueue';

const PAGE_SIZE = 5;
const PREVIEW_PHOTO_LIMIT = 9;

export type AlbumOpenResult =
  | {
      kind: 'opened';
      collection: AlbumCollection;
      entered(): Promise<void>;
    }
  | {
      kind: 'password-required';
      albumId: number;
      message: string;
    }
  | {
      kind: 'failed';
      message: string;
    };

export type AlbumLifecycleOptions = {
  adapter?: HttpAdapter;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  now?: () => Date;
  generatePreview?: AlbumPreviewGenerator;
  isMobileUpload?: () => boolean;
};

export function useAlbumLifecycle({
  adapter,
  storage,
  now = () => new Date(),
  generatePreview,
  isMobileUpload
}: AlbumLifecycleOptions = {}) {
  const privateAccessStore = createBrowserPrivateAccessStore(storage, () => now().getTime());
  const gateway = createHttpAlbumGateway({ adapter, privateAccessStore });

  const albums = ref<AlbumData[]>([]);
  const loaded = ref(false);
  const loading = ref(false);
  const loadingMore = ref(false);
  const page = ref(1);
  const hasMore = ref(false);
  const catalogError = ref('');
  const catalogNotice = ref('');
  const canManage = ref(false);
  const pendingLikeAlbumIds = ref<Set<number>>(new Set());

  const currentDraft = ref<AlbumDraftData | null>(null);
  const workingDraft = ref<AlbumDraftData | null>(null);
  const draftPhotos = ref<AlbumPhotoData[]>([]);
  const draftNotice = ref('');
  const draftSaving = ref(false);
  const draftPublishing = ref(false);
  let catalogGeneration = 0;

  const uploadQueue = createAlbumUploadQueue({
    generatePreview,
    isMobileUpload,
    now
  });

  const collections = computed<AlbumCollection[]>(() => albums.value.map((album) => toCollection(album)));

  async function loadInitialCatalog() {
    const generation = ++catalogGeneration;
    await loadPage(1, generation, true);
  }

  async function loadNextPage() {
    if (!hasMore.value || loading.value || loadingMore.value) {
      return;
    }
    await loadPage(page.value + 1, catalogGeneration, false);
  }

  async function loadPage(targetPage: number, generation: number, loadDraft: boolean) {
    const isFirstPage = targetPage === 1;
    loading.value = isFirstPage;
    loadingMore.value = !isFirstPage;
    catalogError.value = '';

    try {
      const response = await gateway.fetchPage({
        page: targetPage,
        size: PAGE_SIZE,
        previewLimit: PREVIEW_PHOTO_LIMIT
      });
      if (generation !== catalogGeneration) {
        return;
      }
      albums.value = isFirstPage ? response.items : [...albums.value, ...response.items];
      canManage.value = response.canManage;
      page.value = response.page;
      hasMore.value = response.hasMore;
      loaded.value = true;
      if (loadDraft && isFirstPage && response.canManage) {
        void loadCurrentDraft(generation);
      }
    } catch (error) {
      if (generation !== catalogGeneration) {
        return;
      }
      catalogError.value = errorMessage(error, '相册数据加载失败');
      loaded.value = true;
    } finally {
      if (generation === catalogGeneration) {
        loading.value = false;
        loadingMore.value = false;
      }
    }
  }

  async function loadCurrentDraft(generation: number) {
    try {
      const response = await gateway.fetchCurrentDraft();
      if (generation === catalogGeneration) {
        currentDraft.value = response.draft;
      }
    } catch (error) {
      if (generation === catalogGeneration) {
        catalogNotice.value = errorMessage(error, '相册草稿加载失败');
      }
    }
  }

  async function prepareOpen(albumId: number, password?: string): Promise<AlbumOpenResult> {
    catalogNotice.value = '';
    const album = albums.value.find((candidate) => candidate.id === albumId);
    if (!album) {
      return { kind: 'failed', message: '相册不存在或尚未加载' };
    }

    let privateAccessToken: string | undefined;
    if (album.locked) {
      privateAccessToken = privateAccessStore.get(albumId) ?? undefined;

      if (!privateAccessToken && password === undefined) {
        return {
          kind: 'password-required',
          albumId,
          message: '请输入私密相册密码'
        };
      }

      if (!privateAccessToken && password !== undefined) {
        try {
          const unlocked = await gateway.unlock(albumId, password);
          privateAccessStore.set(albumId, {
            token: unlocked.privateAccessToken,
            expiresAt: unlocked.expiresAt
          });
          privateAccessToken = unlocked.privateAccessToken;
        } catch (error) {
          return {
            kind: 'password-required',
            albumId,
            message: errorMessage(error, '私密相册密码不正确')
          };
        }
      }
    }

    try {
      const detail = await gateway.fetchDetail(albumId, privateAccessToken);
      const collection = collectionFromDetail(detail);
      return {
        kind: 'opened',
        collection,
        async entered() {
          try {
            const response = await gateway.recordView(albumId, privateAccessToken);
            collection.views = response.viewCount;
            updateAlbumCounts(albumId, { viewCount: response.viewCount });
          } catch (error) {
            catalogNotice.value = errorMessage(error, '浏览计数失败');
          }
        }
      };
    } catch (error) {
      const message = errorMessage(error, album.locked ? '请输入私密相册密码' : '相册数据加载失败');
      return album.locked
        ? { kind: 'password-required', albumId, message }
        : { kind: 'failed', message };
    }
  }

  async function toggleLike(albumId: number) {
    if (isLikePending(albumId)) {
      return;
    }

    setLikePending(albumId, true);
    try {
      const response = await gateway.like(albumId);
      updateAlbumCounts(albumId, {
        likeCount: response.likeCount,
        likedToday: response.likedToday
      });
    } catch (error) {
      catalogNotice.value = errorMessage(error, '喜欢失败，请稍后再试');
    } finally {
      setLikePending(albumId, false);
    }
  }

  function isLikePending(albumId: number) {
    return pendingLikeAlbumIds.value.has(albumId);
  }

  function setLikePending(albumId: number, pending: boolean) {
    const next = new Set(pendingLikeAlbumIds.value);
    if (pending) {
      next.add(albumId);
    } else {
      next.delete(albumId);
    }
    pendingLikeAlbumIds.value = next;
  }

  function updateAlbumCounts(
    albumId: number,
    counts: Partial<Pick<AlbumData, 'viewCount' | 'likeCount' | 'likedToday'>>
  ) {
    albums.value = albums.value.map((album) =>
      album.id === albumId ? { ...album, ...counts } : album
    );
  }

  function beginNewDraft() {
    workingDraft.value = null;
    draftPhotos.value = [];
    draftNotice.value = '';
    uploadQueue.clear();
  }

  function resumeCurrentDraft() {
    const draft = currentDraft.value;
    if (!draft) {
      return null;
    }
    workingDraft.value = draft;
    draftPhotos.value = [...draft.photos];
    draftNotice.value = '';
    uploadQueue.clear();
    return draft;
  }

  function queueFiles(files: File[] | FileList | null | undefined) {
    if (!files || files.length === 0) {
      return false;
    }
    return uploadQueue.addFiles(files);
  }

  async function saveAndUpload(payload: AlbumCreatePayload) {
    if (draftSaving.value || uploadQueue.uploading.value) {
      return;
    }
    draftNotice.value = '';
    if (!workingDraft.value && uploadQueue.items.value.length === 0) {
      draftNotice.value = '请先选择至少 1 张照片';
      return;
    }

    draftSaving.value = true;
    try {
      if (!workingDraft.value) {
        workingDraft.value = await gateway.createDraft({
          ...payload,
          description: payload.description || '',
          location: payload.location || '地球',
          privatePassword: payload.visibility === 'private' ? payload.privatePassword : undefined
        });
        currentDraft.value = workingDraft.value;
        draftPhotos.value = [...workingDraft.value.photos];
      }
      const draftId = workingDraft.value.album.id;
      await uploadQueue.start(createDraftPhotoUploader(draftId));
    } catch (error) {
      draftNotice.value = errorMessage(error, '相册草稿保存失败');
    } finally {
      draftSaving.value = false;
    }
  }

  async function retryUpload(itemId: string) {
    const draft = workingDraft.value;
    if (!draft) {
      return;
    }
    await uploadQueue.retry(itemId, createDraftPhotoUploader(draft.album.id));
  }

  async function publishDraft() {
    const draft = workingDraft.value;
    if (!draft || draftPublishing.value) {
      return false;
    }
    draftNotice.value = '';
    if (draftPhotos.value.length < 1 && uploadQueue.successCount.value < 1) {
      draftNotice.value = '发布前至少需要 1 张已成功上传的照片';
      return false;
    }
    if (uploadQueue.blockingCount.value > 0) {
      draftNotice.value = '还有照片未处理完成，请等待、重试或移除失败项';
      return false;
    }

    draftPublishing.value = true;
    try {
      await gateway.publishDraft(draft.album.id);
      currentDraft.value = null;
      await refreshCatalogAfterPublish();
      workingDraft.value = null;
      draftPhotos.value = [];
      uploadQueue.clear();
      return true;
    } catch (error) {
      draftNotice.value = errorMessage(error, '发布相册失败');
      return false;
    } finally {
      draftPublishing.value = false;
    }
  }

  async function cancelDraft() {
    const draft = workingDraft.value;
    if (!draft) {
      return true;
    }

    draftNotice.value = '';
    try {
      await gateway.cancelDraft(draft.album.id);
      currentDraft.value = null;
      return true;
    } catch (error) {
      draftNotice.value = errorMessage(error, '取消草稿失败');
      return false;
    }
  }

  function clearDraftPendingState() {
    draftSaving.value = false;
    draftPublishing.value = false;
  }

  async function refreshCatalogAfterPublish() {
    const generation = ++catalogGeneration;
    catalogNotice.value = '';
    loadingMore.value = false;
    await loadPage(1, generation, false);
    if (catalogError.value) {
      catalogNotice.value = '相册已发布，但列表刷新失败，请稍后刷新页面';
      catalogError.value = '';
    }
  }

  function createDraftPhotoUploader(draftId: number) {
    return async (
      original: File,
      preview: File,
      metadata: AlbumPhotoUploadMetadata
    ) => {
      const uploaded = await gateway.uploadDraftPhoto(draftId, original, preview, metadata);
      if (workingDraft.value?.album.id === draftId) {
        draftPhotos.value.push(uploaded);
      }
      return uploaded;
    };
  }

  return {
    state: {
      collections,
      loaded,
      loading,
      loadingMore,
      hasMore,
      catalogError,
      catalogNotice,
      canManage,
      currentDraft,
      workingDraft,
      draftPhotos,
      draftNotice,
      draftSaving,
      draftPublishing,
      uploadItems: uploadQueue.items,
      uploadError: uploadQueue.error,
      uploading: uploadQueue.uploading,
      uploadSuccessCount: uploadQueue.successCount,
      uploadBlockingCount: uploadQueue.blockingCount
    },
    loadInitialCatalog,
    loadNextPage,
    prepareOpen,
    toggleLike,
    isLikePending,
    beginNewDraft,
    resumeCurrentDraft,
    queueFiles,
    saveAndUpload,
    retryUpload,
    removeUpload: uploadQueue.remove,
    publishDraft,
    cancelDraft,
    clearDraftPendingState
  };
}

function toCollection(
  album: AlbumData,
  photos: AlbumPhoto[] = album.previewPhotos.map(toPhoto)
): AlbumCollection {
  const previewPhotos = album.locked ? [] : photos.slice(0, PREVIEW_PHOTO_LIMIT);
  const author = album.authorName || 'Snowlit';

  return {
    id: String(album.id),
    albumId: album.id,
    title: album.title || '未命名专辑',
    description: album.description || '',
    author,
    avatarLabel: author.slice(0, 1).toUpperCase(),
    date: album.eventDate || album.createdAt.slice(0, 10),
    location: album.location || '地球',
    views: Number.isFinite(album.viewCount) ? album.viewCount : 0,
    likes: Number.isFinite(album.likeCount) ? album.likeCount : 0,
    likedToday: Boolean(album.likedToday),
    photoCount: Number.isFinite(album.photoCount) ? album.photoCount : photos.length,
    visibility: album.visibility,
    locked: album.locked,
    isPrivate: album.visibility === 'private',
    pinned: album.pinned,
    sortOrder: album.sortOrder,
    coverPhotoUrl: album.coverPhotoUrl,
    photos: album.locked ? [] : photos,
    previewPhotos,
    remainingCount: Math.max((album.photoCount || photos.length) - previewPhotos.length, 0)
  };
}

function toPhoto(photo: AlbumPhotoData): AlbumPhoto {
  return {
    ...photo,
    cardId: `api-${photo.albumId}-${photo.id}`,
    source: 'api',
    url: photo.previewUrl,
    date: photo.takenAt
  };
}

function collectionFromDetail(detail: AlbumDetailData): AlbumCollection {
  return toCollection(
    {
      ...detail.album,
      locked: false,
      previewPhotos: detail.album.previewPhotos ?? []
    },
    detail.photos.map(toPhoto)
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback;
}
