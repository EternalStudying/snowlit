import type {
  AlbumCreatePayload,
  AlbumCurrentDraftData,
  AlbumDetailData,
  AlbumDraftData,
  AlbumLikeData,
  AlbumPageData,
  AlbumPhotoData,
  AlbumPhotoUploadMetadata,
  AlbumPrivateToken,
  AlbumUnlockData,
  AlbumViewData
} from '../model';

export type AlbumPreviewGenerator = (
  file: File
) => Promise<{ file: File; width: number; height: number }>;

export interface AlbumPrivateAccessStore {
  get(albumId: number): string | null;
  set(albumId: number, value: AlbumPrivateToken): void;
  clear(albumId: number): void;
}

export interface AlbumGateway {
  fetchPage(params?: { page?: number; size?: number; previewLimit?: number }): Promise<AlbumPageData>;
  fetchCurrentDraft(): Promise<AlbumCurrentDraftData>;
  createDraft(payload: AlbumCreatePayload): Promise<AlbumDraftData>;
  uploadDraftPhoto(
    albumId: number,
    original: File,
    preview: File,
    metadata: AlbumPhotoUploadMetadata
  ): Promise<AlbumPhotoData>;
  publishDraft(albumId: number): Promise<AlbumDraftData>;
  cancelDraft(albumId: number): Promise<void>;
  fetchDetail(albumId: number, privateAccessToken?: string): Promise<AlbumDetailData>;
  unlock(albumId: number, password: string): Promise<AlbumUnlockData>;
  like(albumId: number): Promise<AlbumLikeData>;
  recordView(albumId: number, privateAccessToken?: string): Promise<AlbumViewData>;
}
