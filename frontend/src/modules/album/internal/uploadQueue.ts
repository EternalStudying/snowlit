import { computed, ref } from 'vue';
import { MAX_ALBUM_PHOTOS } from '../model';
import type { AlbumDraftImage, AlbumPhotoUploadMetadata } from '../model';
import { encodeCanvasWebpPreview } from './canvasWebpPreviewEncoder';
import type { AlbumPreviewGenerator } from './ports';
import { errorMessage } from '../../../display';
import { pickImages } from '../../../imageFiles';

export type AlbumUploadStatus = 'waiting' | 'generating' | 'uploading' | 'success' | 'failed';

export interface AlbumUploadItem {
  id: string;
  file: File;
  status: AlbumUploadStatus;
  message: string;
  progress: number;
  uploadedPhoto: AlbumDraftImage | null;
  previewFile: File | null;
  metadata: AlbumPhotoUploadMetadata | null;
}

export type AlbumPhotoUploader = (
  original: File,
  preview: File,
  metadata: AlbumPhotoUploadMetadata
) => Promise<AlbumDraftImage>;

type AlbumUploadQueueOptions = {
  generatePreview?: AlbumPreviewGenerator;
  isMobileUpload?: () => boolean;
  now?: () => Date;
};

const MAX_FILES = MAX_ALBUM_PHOTOS;
export function createAlbumUploadQueue({
  generatePreview = encodeCanvasWebpPreview,
  isMobileUpload = detectMobileUpload,
  now = () => new Date()
}: AlbumUploadQueueOptions) {
  const items = ref<AlbumUploadItem[]>([]);
  const error = ref('');
  const uploading = ref(false);

  const successCount = computed(() => items.value.filter((item) => item.status === 'success').length);
  const blockingCount = computed(() => items.value.filter((item) => item.status !== 'success').length);

  /** Queues the acceptable images; files that break the image rule are left out and named in `error`. */
  function addFiles(files: File[] | FileList, existingCount = 0) {
    const { accepted: selected, rejection } = pickImages(files);
    error.value = rejection;

    if (selected.length + items.value.length + existingCount > MAX_FILES) {
      error.value = '最多选择 50 张照片';
      return false;
    }

    if (!selected.length) {
      return false;
    }

    items.value.push(
      ...selected.map((file, index) => ({
        id: `${now().getTime()}-${index}-${file.name}`,
        file,
        status: 'waiting' as const,
        message: '等待上传',
        progress: 0,
        uploadedPhoto: null,
        previewFile: null,
        metadata: null
      }))
    );
    return true;
  }

  async function start(uploadPhoto: AlbumPhotoUploader) {
    if (uploading.value) {
      return;
    }
    uploading.value = true;
    error.value = '';
    const concurrency = isMobileUpload() ? 2 : 4;
    const workers = Array.from({ length: concurrency }, () => runNext(uploadPhoto));
    await Promise.all(workers);
    uploading.value = false;
  }

  async function retry(itemId: string, uploadPhoto: AlbumPhotoUploader) {
    const item = items.value.find((candidate) => candidate.id === itemId);
    if (!item || item.status !== 'failed') {
      return;
    }
    await processItem(item, uploadPhoto);
  }

  function remove(itemId: string) {
    items.value = items.value.filter(
      (item) => item.id !== itemId || item.status === 'uploading' || item.status === 'generating'
    );
  }

  function clear() {
    items.value = [];
    error.value = '';
    uploading.value = false;
  }

  async function runNext(uploadPhoto: AlbumPhotoUploader) {
    while (true) {
      const item = items.value.find((candidate) => candidate.status === 'waiting');
      if (!item) {
        return;
      }
      await processItem(item, uploadPhoto);
    }
  }

  async function processItem(item: AlbumUploadItem, uploadPhoto: AlbumPhotoUploader) {
    try {
      updateItem(item.id, {
        status: 'generating',
        message: '生成 WebP 预览中'
      });
      const generated = await generatePreview(item.file);
      const metadata: AlbumPhotoUploadMetadata = {
        caption: stripExtension(item.file.name) || '未命名照片',
        takenAt: now().toISOString().slice(0, 10),
        location: '地球',
        width: generated.width,
        height: generated.height,
        sortOrder: items.value.findIndex((candidate) => candidate.id === item.id) + 1
      };
      updateItem(item.id, {
        previewFile: generated.file,
        metadata,
        status: 'uploading',
        message: '上传中',
        progress: 50
      });
      const uploadedPhoto = await uploadPhoto(item.file, generated.file, metadata);
      updateItem(item.id, {
        uploadedPhoto,
        status: 'success',
        message: '已上传',
        progress: 100
      });
    } catch (error) {
      updateItem(item.id, {
        status: 'failed',
        message: errorMessage(error, '上传失败'),
        progress: 0
      });
    }
  }

  function updateItem(itemId: string, patch: Partial<AlbumUploadItem>) {
    items.value = items.value.map((item) =>
      item.id === itemId ? { ...item, ...patch } : item
    );
  }

  return {
    items,
    error,
    uploading,
    successCount,
    blockingCount,
    addFiles,
    start,
    retry,
    remove,
    clear
  };
}

function stripExtension(name: string) {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(0, index) : name;
}

function detectMobileUpload() {
  return window.matchMedia?.('(pointer: coarse)').matches;
}
