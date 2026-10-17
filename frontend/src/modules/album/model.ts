export type AlbumVisibility = 'public' | 'private';

export type AlbumPhotoData = {
  id: number;
  albumId: number;
  previewUrl: string;
  originalUrl: string | null;
  caption: string;
  description: string;
  takenAt: string;
  location: string;
  sortOrder: number;
  width: number;
  height: number;
};

export type AlbumData = {
  id: number;
  title: string;
  description: string;
  coverPhotoUrl: string;
  authorName: string;
  createdAt: string;
  eventDate: string;
  location: string;
  photoCount: number;
  viewCount: number;
  likeCount: number;
  likedToday: boolean;
  visibility: AlbumVisibility;
  locked: boolean;
  pinned: boolean;
  sortOrder: number;
  previewPhotos: AlbumPhotoData[];
};

export type AlbumPageData = {
  items: AlbumData[];
  total: number;
  page: number;
  size: number;
  hasMore: boolean;
  canManage: boolean;
};

export type AlbumDetailData = {
  album: AlbumData;
  photos: AlbumPhotoData[];
};

export type AlbumUnlockData = {
  privateAccessToken: string;
  expiresAt: string;
};

export type AlbumLikeData = {
  albumId: number;
  likeCount: number;
  likedToday: boolean;
};

export type AlbumViewData = {
  albumId: number;
  viewCount: number;
  counted: boolean;
};

export type AlbumDraftData = {
  album: AlbumData;
  photos: AlbumPhotoData[];
};

export type AlbumCurrentDraftData = {
  draft: AlbumDraftData | null;
};

export type AlbumCreatePayload = {
  title: string;
  description: string;
  eventDate: string;
  location: string;
  visibility: AlbumVisibility;
  privatePassword?: string;
};

export type AlbumPhotoUploadMetadata = {
  caption: string;
  takenAt: string;
  location: string;
  width: number;
  height: number;
  sortOrder: number;
};

export type AlbumPrivateToken = {
  token: string;
  expiresAt: string;
};

export type AlbumApiErrorCode =
  | 'PRIVATE_ALBUM_LOCKED'
  | 'PRIVATE_ALBUM_PASSWORD_INVALID'
  | 'PRIVATE_ALBUM_UNLOCK_LOCKED'
  | 'PRIVATE_ALBUM_TOKEN_EXPIRED'
  | 'PRIVATE_ALBUM_TOKEN_INVALID';

export type AlbumPhoto = AlbumPhotoData & {
  cardId: string;
  source: 'api';
  url: string;
  date: string;
};

export type AlbumCollection = {
  id: string;
  albumId: number;
  title: string;
  description: string;
  author: string;
  avatarLabel: string;
  date: string;
  location: string;
  views: number;
  likes: number;
  likedToday: boolean;
  photoCount: number;
  visibility: AlbumVisibility;
  locked: boolean;
  isPrivate: boolean;
  pinned: boolean;
  sortOrder: number;
  coverPhotoUrl: string;
  photos: AlbumPhoto[];
  previewPhotos: AlbumPhoto[];
  remainingCount: number;
};

export type AlbumImmersivePhase = 'idle' | 'entering' | 'active' | 'leaving';
