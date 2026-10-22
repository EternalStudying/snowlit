import type {
  AlbumCreatePayload,
  AlbumEditData,
  AlbumSavePayload,
  AlbumCurrentDraftData,
  AlbumDetailData,
  AlbumDraftData,
  AlbumLikeData,
  AlbumPageData,
  AlbumDraftImage,
  AlbumDraftFields,
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
    original: File,
    preview: File,
    metadata: AlbumPhotoUploadMetadata
  ): Promise<AlbumDraftImage>;
  publishDraft(fields: AlbumDraftFields, privatePassword?: string, imageOrder?: string[]): Promise<AlbumDetailData>;
  cancelDraft(): Promise<void>;
  removeDraftPhoto(imageId: string): Promise<void>;
  startEdit(albumId: number): Promise<AlbumEditData>;
  uploadEditPhoto(albumId: number, original: File, preview: File, metadata: AlbumPhotoUploadMetadata): Promise<AlbumDraftImage>;
  removeEditPhoto(albumId: number, draftImageId: string): Promise<void>;
  cancelEdit(albumId: number, keepalive?: boolean): Promise<void>;
  saveAlbum(albumId: number, payload: AlbumSavePayload): Promise<AlbumDetailData>;
  deleteAlbum(albumId: number): Promise<void>;
  reorderDraftPhotos(ids: string[]): Promise<AlbumDraftData>;
  fetchDetail(albumId: number, privateAccessToken?: string): Promise<AlbumDetailData>;
  unlock(albumId: number, password: string): Promise<AlbumUnlockData>;
  like(albumId: number): Promise<AlbumLikeData>;
  recordView(albumId: number, privateAccessToken?: string): Promise<AlbumViewData>;
}
