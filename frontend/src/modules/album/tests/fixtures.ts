import type {
  AlbumDetailData,
  AlbumDraftData,
  AlbumPageData,
  AlbumPhotoData
} from '../model';

export const publicPhoto: AlbumPhotoData = {
  id: 101,
  albumId: 1,
  previewUrl: 'https://example.com/album-101.jpg',
  originalUrl: 'https://example.com/album-101-original.jpg',
  caption: '海边日落',
  description: '傍晚的风很轻。',
  takenAt: '2026-04-16',
  location: '法国·尼斯',
  sortOrder: 10,
  width: 1600,
  height: 1067
};

export const privatePhoto: AlbumPhotoData = {
  id: 201,
  albumId: 2,
  previewUrl: 'https://example.com/private-201.jpg',
  originalUrl: null,
  caption: '只属于我们',
  description: '悄悄收起来的一天。',
  takenAt: '2026-05-10',
  location: '示例地区 B·示例城市 B',
  sortOrder: 10,
  width: 1600,
  height: 1067
};

export const firstPage: AlbumPageData = {
  items: [
    {
      id: 1,
      title: '见面出游',
      description: '把见面那几天的光都收好。',
      coverPhotoUrl: '/album-assets/meeting-cover.jpg',
      authorName: '伴侣 B',
      createdAt: '2026-05-16T20:00:00',
      eventDate: '2026-04-16',
      location: '法国·尼斯',
      photoCount: 14,
      viewCount: 21,
      likeCount: 0,
      likedToday: true,
      visibility: 'public',
      locked: false,
      pinned: true,
      sortOrder: 10,
      previewPhotos: [publicPhoto]
    },
    {
      id: 2,
      title: '锁定专辑',
      description: '已锁定',
      coverPhotoUrl: '/album-assets/private-locked-cover.png',
      authorName: '',
      createdAt: '2026-05-10T20:00:00',
      eventDate: '2026-05-10',
      location: '地球',
      photoCount: 8,
      viewCount: 7,
      likeCount: 3,
      likedToday: false,
      visibility: 'private',
      locked: true,
      pinned: false,
      sortOrder: 100,
      previewPhotos: []
    }
  ],
  total: 6,
  page: 1,
  size: 5,
  hasMore: true,
  canManage: true
};

export const secondPage: AlbumPageData = {
  items: [
    {
      ...firstPage.items[0],
      id: 3,
      title: '日常碎片',
      photoCount: 2,
      viewCount: 4,
      likeCount: 1,
      likedToday: false,
      previewPhotos: [
        {
          ...publicPhoto,
          id: 301,
          albumId: 3,
          caption: '午后咖啡'
        }
      ]
    }
  ],
  total: 6,
  page: 2,
  size: 5,
  hasMore: false,
  canManage: true
};

export const publicDetail: AlbumDetailData = {
  album: {
    ...firstPage.items[0],
    previewPhotos: []
  },
  photos: [
    publicPhoto,
    {
      ...publicPhoto,
      id: 102,
      caption: '风里合照',
      location: '法国·尼斯'
    }
  ]
};

export const privateDetail: AlbumDetailData = {
  album: {
    ...firstPage.items[1],
    title: '私密时光',
    description: '只属于我们。',
    coverPhotoUrl: '/album-assets/private-cover.jpg',
    authorName: '伴侣 A',
    location: '示例地区 B·示例城市 B',
    locked: false,
    previewPhotos: []
  },
  photos: [privatePhoto]
};

export const draftPhoto = {
  id: 'opaque-photo', url: publicPhoto.previewUrl, originalUrl: publicPhoto.originalUrl ?? undefined,
  caption: publicPhoto.caption, takenAt: publicPhoto.takenAt, location: publicPhoto.location,
  width: publicPhoto.width, height: publicPhoto.height
};

export const currentDraft: AlbumDraftData = {
  kind: 'album',
  fields: { title: '未完成相册', description: '', eventDate: '2026-05-20', location: '', visibility: 'public' },
  images: [draftPhoto], createdAt: '2026-05-20T12:00:00', updatedAt: '2026-05-20T12:01:00'
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    resolve,
    reject
  };
}
