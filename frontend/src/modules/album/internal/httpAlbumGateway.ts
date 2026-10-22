import {
  RequestFailure,
  createSessionRequest,
  sessionRequest,
  type HttpAdapter
} from '../../../http/sessionRequest';
import type {
  AlbumApiErrorCode,
  AlbumEditData,
  AlbumCurrentDraftData,
  AlbumDetailData,
  AlbumDraftData,
  AlbumLikeData,
  AlbumPageData,
  AlbumDraftImage,
  AlbumUnlockData,
  AlbumViewData
} from '../model';
import type { AlbumGateway, AlbumPrivateAccessStore } from './ports';

type AlbumGatewayOptions = {
  adapter?: HttpAdapter;
  privateAccessStore: AlbumPrivateAccessStore;
};

const TOKEN_ERROR_CODES: AlbumApiErrorCode[] = [
  'PRIVATE_ALBUM_TOKEN_EXPIRED',
  'PRIVATE_ALBUM_TOKEN_INVALID'
];

const ALBUM_FAILURE = {
  message: '相册请求失败',
  networkMessage: '相册数据加载失败',
  responseMessage: 'prefer'
} as const;

const CANCEL_DRAFT_FAILURE = {
  ...ALBUM_FAILURE,
  networkMessage: '相册请求失败'
} as const;

export function createHttpAlbumGateway({
  adapter,
  privateAccessStore
}: AlbumGatewayOptions): AlbumGateway {
  const request = adapter ? createSessionRequest({ adapter }) : sessionRequest;

  async function withPrivateAccessCleanup<T>(
    albumId: number,
    operation: () => Promise<T>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof RequestFailure &&
        TOKEN_ERROR_CODES.includes(error.code as AlbumApiErrorCode)
      ) {
        privateAccessStore.clear(albumId);
      }
      throw error;
    }
  }

  return {
    fetchPage(params = {}) {
      const query = new URLSearchParams();
      query.set('page', String(params.page ?? 1));
      query.set('size', String(params.size ?? 5));
      query.set('previewLimit', String(params.previewLimit ?? 9));
      return request.json<AlbumPageData>({
        path: `/api/albums?${query.toString()}`,
        failure: ALBUM_FAILURE
      });
    },

    fetchCurrentDraft() {
      return request.json<AlbumCurrentDraftData>({
        path: '/api/drafts/album',
        failure: ALBUM_FAILURE
      });
    },

    createDraft(payload) {
      return request.json<AlbumDraftData>({
        path: '/api/drafts/album',
        method: 'PUT',
        body: { kind: 'json', value: { fields: draftFields(payload) } },
        failure: ALBUM_FAILURE
      });
    },

    uploadDraftPhoto(original, preview, metadata) {
      const form = new FormData();
      form.append('original', original);
      form.append('preview', preview);
      const { sortOrder: _order, ...fields } = metadata;
      form.append('metadata', JSON.stringify(fields));

      return request.json<AlbumDraftImage>({
        path: '/api/drafts/album/images',
        method: 'POST',
        body: { kind: 'form', value: form },
        failure: ALBUM_FAILURE
      });
    },

    publishDraft(fields, privatePassword, imageOrder) {
      return request.json<AlbumDetailData>({
        path: '/api/drafts/album/publish',
        method: 'POST',
        body: { kind: 'json', value: { fields: draftFields(fields), privatePassword, imageOrder } },
        failure: ALBUM_FAILURE
      });
    },

    cancelDraft() {
      return request.noContent({
        path: '/api/drafts/album',
        method: 'DELETE',
        failure: CANCEL_DRAFT_FAILURE
      });
    },

    removeDraftPhoto(imageId) {
      return request.noContent({
        path: `/api/drafts/album/images/${encodeURIComponent(imageId)}`,
        method: 'DELETE', failure: CANCEL_DRAFT_FAILURE
      });
    },

    startEdit(albumId) {
      return request.json<AlbumEditData>({ path: `/api/albums/${albumId}/edit`, method: 'POST', failure: ALBUM_FAILURE });
    },
    uploadEditPhoto(albumId, original, preview, metadata) {
      const form = new FormData();
      form.append('original', original); form.append('preview', preview);
      const { sortOrder: _order, ...fields } = metadata;
      form.append('metadata', JSON.stringify(fields));
      return request.json<AlbumDraftImage>({ path: `/api/albums/${albumId}/edit/photos`, method: 'POST', body: { kind: 'form', value: form }, failure: ALBUM_FAILURE });
    },
    removeEditPhoto(albumId, draftImageId) {
      return request.noContent({ path: `/api/albums/${albumId}/edit/photos/${encodeURIComponent(draftImageId)}`, method: 'DELETE', failure: ALBUM_FAILURE });
    },
    cancelEdit(albumId, keepalive = false) {
      return request.noContent({ path: `/api/albums/${albumId}/edit`, method: 'DELETE', keepalive, failure: ALBUM_FAILURE });
    },
    saveAlbum(albumId, payload) {
      const { privatePassword, ...fields } = payload;
      return request.json<AlbumDetailData>({ path: `/api/albums/${albumId}`, method: 'PUT', body: { kind: 'json', value: { ...fields, ...(privatePassword?.trim() ? { privatePassword } : {}) } }, failure: ALBUM_FAILURE });
    },
    deleteAlbum(albumId) {
      return request.noContent({ path: `/api/albums/${albumId}`, method: 'DELETE', failure: ALBUM_FAILURE });
    },
    reorderDraftPhotos(ids) {
      return request.json<AlbumDraftData>({ path: '/api/drafts/album/images/order', method: 'PUT', body: { kind: 'json', value: { ids } }, failure: ALBUM_FAILURE });
    },

    fetchDetail(albumId, privateAccessToken) {
      return withPrivateAccessCleanup(albumId, () =>
        request.json<AlbumDetailData>({
          path: `/api/albums/${albumId}`,
          headers: privateAccessHeaders(privateAccessToken),
          failure: ALBUM_FAILURE
        })
      );
    },

    unlock(albumId, password) {
      return request.json<AlbumUnlockData>({
        path: `/api/albums/${albumId}/unlock`,
        method: 'POST',
        body: { kind: 'json', value: { password } },
        failure: ALBUM_FAILURE
      });
    },

    like(albumId) {
      return request.json<AlbumLikeData>({
        path: `/api/albums/${albumId}/like`,
        method: 'POST',
        failure: ALBUM_FAILURE
      });
    },

    recordView(albumId, privateAccessToken) {
      return withPrivateAccessCleanup(albumId, () =>
        request.json<AlbumViewData>({
          path: `/api/albums/${albumId}/view`,
          method: 'POST',
          headers: privateAccessHeaders(privateAccessToken),
          failure: ALBUM_FAILURE
        })
      );
    }
  };
}

function privateAccessHeaders(
  privateAccessToken: string | undefined
): Record<string, string> | undefined {
  return privateAccessToken
    ? { 'X-Album-Access-Token': privateAccessToken }
    : undefined;
}

function draftFields(payload: import('../model').AlbumDraftFields) {
  const { title, description, eventDate, location, visibility, pinned } = payload;
  // A cleared date input is "not set yet": the server accepts a missing date, not an empty one.
  return { title, description, ...(eventDate ? { eventDate } : {}), location, visibility, pinned };
}
