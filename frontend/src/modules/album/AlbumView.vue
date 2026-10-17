<script setup lang="ts">
import './album.css';
import {
  computed,
  onMounted,
  ref,
  type InputHTMLAttributes
} from 'vue';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Heart,
  Images,
  LockKeyhole,
  MapPin,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X
} from 'lucide-vue-next';
import {
  NButton,
  NInput,
  NUpload,
  type UploadFileInfo
} from 'naive-ui';
import PageLoader from '../../components/PageLoader.vue';
import { formatLocalCalendarDate } from '../../calendarDate';
import { useModalWheelGuard } from '../../composables/useModalWheelGuard';
import AlbumCollectionEnterTransition from './components/AlbumCollectionEnterTransition.vue';
import AlbumImmersiveGallery from './components/AlbumImmersiveGallery.vue';
import albumCreateDialogBackground from './assets/album-create-dialog-background.webp';
import albumCreateEntry from './assets/album-create-entry.webp';
import albumCreateUploadIllustration from './assets/album-create-upload-illustration.webp';
import albumCreateUploadPanel from './assets/album-create-upload-panel.webp';
import dryFlowerTaped from './assets/dry-flower-taped.webp';
import heartSketchRed from './assets/heart-sketch-red.webp';
import heroRedUnderline from './assets/hero-red-underline.webp';
import lovePostmarkLarge from './assets/love-postmark-large.webp';
import { useAlbumCatalogPresentation } from './internal/useAlbumCatalogPresentation';
import { useAlbumDialogMotion } from './internal/useAlbumDialogMotion';
import { useAlbumImmersiveSession } from './internal/useAlbumImmersiveSession';
import { useAlbumLifecycle } from './internal/useAlbumLifecycle';
import type {
  AlbumCollection,
  AlbumCreatePayload
} from './model';

const ALBUM_UPLOAD_DETAIL_LIMIT = 6;
const reducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const albumLifecycle = useAlbumLifecycle();
const {
  collections: collectionCards,
  loaded,
  loadingMore,
  catalogError,
  catalogNotice,
  canManage: canManageAlbums,
  currentDraft,
  workingDraft: draftAlbum,
  draftNotice,
  draftSaving,
  draftPublishing,
  uploadItems: albumUploadItems,
  uploadError: albumUploadError,
  uploading: albumUploading,
  uploadSuccessCount
} = albumLifecycle.state;

const createDialogOpen = ref(false);
const albumDraftFileList = ref<UploadFileInfo[]>([]);
const draftForm = ref<AlbumCreatePayload>({
  title: '',
  description: '',
  eventDate: formatLocalCalendarDate(),
  location: '',
  visibility: 'public',
  privatePassword: ''
});

const shouldShowAlbumUploadProgress = computed(
  () => albumUploadItems.value.length > ALBUM_UPLOAD_DETAIL_LIMIT
);
const albumUploadProgressPercent = computed(() => {
  const total = albumUploadItems.value.length;
  return total
    ? Math.round((uploadSuccessCount.value / total) * 100)
    : 0;
});
const albumUploadProgressText = computed(
  () =>
    `${uploadSuccessCount.value}/${albumUploadItems.value.length}`
);
const albumUnlockInputProps = {
  'data-album-unlock-input': '',
  autocomplete: 'off'
} as unknown as InputHTMLAttributes;
const albumTitleInputProps = {
  'data-album-title-input': '',
  required: true,
  maxlength: 120
} as unknown as InputHTMLAttributes;
const albumPrivatePasswordInputProps = computed(
  () =>
    ({
      'data-album-private-password-input': '',
      autocomplete: 'off',
      required:
        draftForm.value.visibility === 'private' && !draftAlbum.value
    }) as unknown as InputHTMLAttributes
);

const {
  pageInnerRef: albumPageInnerRef,
  gsapMotionAttr: albumGsapMotionAttr,
  activeCardId: activeAlbumCardId,
  isCardVisible: isAlbumCardVisible,
  setCardRef: setAlbumCardRef,
  getCardStyle: getAlbumCardStyle,
  getPreviewCellStyle: getAlbumPreviewCellStyle,
  setActiveCard: setActiveAlbumCard,
  clearActiveCard: clearActiveAlbumCard,
  handleCardPointerMove: handleAlbumCardPointerMove
} = useAlbumCatalogPresentation({
  collections: collectionCards,
  loaded,
  reducedMotion,
  loadNextPage: albumLifecycle.loadNextPage
});

const {
  createDialogBackdropRef,
  createDialogRef,
  isCreateDialogClosing: albumCreateDialogClosing,
  openCreateDialog: showCreateDialog,
  closeCreateDialog,
  previewTransitionHandlers: albumPreviewTransitionHandlers
} = useAlbumDialogMotion({
  isCreateDialogOpen: createDialogOpen,
  reducedMotion,
  clearDraftPendingState: albumLifecycle.clearDraftPendingState
});

const {
  selectedCollection,
  selectedPhoto,
  currentPreviewPosition,
  transitionSourceRect,
  transitionPhotoRects,
  privateDialogCollection,
  privatePassword,
  privateError,
  unlocking,
  previewMotionKey,
  isPhotoPreviewSwitching,
  shouldShowCollectionList,
  shouldShowEnterTransition,
  shouldShowImmersiveGallery,
  immersiveRootClass: albumImmersiveRootClass,
  openCollection,
  submitPrivateUnlock,
  closePrivateDialog,
  handleCollectionKeydown,
  activateImmersiveGallery,
  closeCollection,
  openPhotoPreview,
  closePhotoPreview,
  showPreviousPhoto,
  showNextPhoto
} = useAlbumImmersiveSession({
  catalogNotice,
  reducedMotion,
  prepareOpen: albumLifecycle.prepareOpen
});

useModalWheelGuard(createDialogOpen);

function resetDraftForm() {
  draftForm.value = {
    title: '',
    description: '',
    eventDate: formatLocalCalendarDate(),
    location: '',
    visibility: 'public',
    privatePassword: ''
  };
  albumDraftFileList.value = [];
  albumLifecycle.beginNewDraft();
}

function openCreateDialog() {
  resetDraftForm();
  showCreateDialog();
}

function openDraftDialog() {
  const draft = albumLifecycle.resumeCurrentDraft();
  if (!draft) {
    return;
  }

  draftForm.value = {
    title: draft.album.title,
    description: draft.album.description,
    eventDate: draft.album.eventDate,
    location: draft.album.location,
    visibility: draft.album.visibility,
    privatePassword: ''
  };
  showCreateDialog();
}

function addDraftFiles(
  files: File[] | FileList | null | undefined
) {
  albumLifecycle.queueFiles(files);
}

function getUploadFiles(fileList: UploadFileInfo[]) {
  return fileList
    .map((item) => item.file)
    .filter((file): file is File => file instanceof File);
}

function handleDraftFiles(
  payload: Event | { fileList: UploadFileInfo[] }
) {
  if ('fileList' in payload) {
    addDraftFiles(getUploadFiles(payload.fileList));
    albumDraftFileList.value = [];
    return;
  }

  const input = payload.target as HTMLInputElement | null;
  addDraftFiles(input?.files);
  if (input) {
    input.value = '';
  }
}

function handleDraftDrop(event: DragEvent) {
  addDraftFiles(event.dataTransfer?.files);
}

function setDraftPrivate(value: boolean) {
  if (draftAlbum.value) {
    return;
  }

  draftForm.value.visibility = value ? 'private' : 'public';
  if (!value) {
    draftForm.value.privatePassword = '';
  }
}

async function submitDraftAndUpload() {
  await albumLifecycle.saveAndUpload(draftForm.value);
}

async function retryUploadItem(item: { id: string }) {
  await albumLifecycle.retryUpload(item.id);
}

async function publishDraftAlbum() {
  if (await albumLifecycle.publishDraft()) {
    closeCreateDialog();
  }
}

async function cancelCurrentDraft() {
  if (await albumLifecycle.cancelDraft()) {
    closeCreateDialog();
  }
}

function isAlbumLikePending(albumId: number) {
  return albumLifecycle.isLikePending(albumId);
}

async function handleLikeCollection(collection: AlbumCollection) {
  await albumLifecycle.toggleLike(collection.albumId);
}

onMounted(() => {
  void albumLifecycle.loadInitialCatalog();
});
</script>

<template>
  <main class="album-page" :class="albumImmersiveRootClass" :data-album-gsap="albumGsapMotionAttr">
    <section v-if="loaded" ref="albumPageInnerRef" class="album-page__inner" aria-label="照片相册">
      <div class="album-hero-row">
        <header class="album-hero">
          <p>Photo Keepsakes</p>
          <h1>
            收藏见面与出游的闪亮瞬间
            <img class="album-title-heart" :src="heartSketchRed" alt="" draggable="false" />
          </h1>
          <span class="album-hero__copy">每一本相册，都是某段时光的入口。</span>
          <div v-if="canManageAlbums && currentDraft" class="album-hero-actions" aria-label="相册草稿">
            <button
              class="album-create-entry album-create-entry--draft"
              data-album-draft-continue
              type="button"
              @click="openDraftDialog"
            >
              <Upload :size="18" aria-hidden="true" />
              继续上传未完成相册
            </button>
          </div>
          <img class="album-hero__underline" :src="heroRedUnderline" alt="" draggable="false" />
        </header>

        <div class="album-hero-art" aria-hidden="true">
          <img class="album-asset album-postmark" :src="lovePostmarkLarge" alt="" draggable="false" />
          <img class="album-asset album-dry-flower" :src="dryFlowerTaped" alt="" draggable="false" />
        </div>
      </div>

      <Transition name="album-collection-panel" mode="out-in">
        <section
          v-if="shouldShowCollectionList"
          key="collection-list"
          class="album-collection-list"
          aria-label="相册专辑列表"
        >
          <p v-if="catalogError || catalogNotice" class="album-catalog-notice" role="status" aria-live="polite">
            {{ catalogError || catalogNotice }}
          </p>

          <div class="album-collections-grid">
            <article
              v-for="(collection, index) in collectionCards"
              :key="collection.id"
              class="album-collection-card"
              :class="{ 'album-collection-card--private': collection.locked }"
              :ref="(element) => setAlbumCardRef(collection.id, element as HTMLElement | null)"
              :data-album-id="collection.id"
              :data-album-reveal-order="index"
              :data-album-card-visible="isAlbumCardVisible(collection.id) ? 'true' : 'false'"
              :data-album-card-active="activeAlbumCardId === collection.id ? 'true' : undefined"
              :style="getAlbumCardStyle(collection, index)"
              role="button"
              tabindex="0"
              :aria-label="collection.locked ? '解锁私密相册' : `打开${collection.title}`"
              @click="openCollection(collection, $event)"
              @keydown="handleCollectionKeydown($event, collection)"
              @mouseenter="setActiveAlbumCard(collection)"
              @mouseleave="clearActiveAlbumCard(collection.id)"
              @focusin="setActiveAlbumCard(collection)"
              @focusout="clearActiveAlbumCard(collection.id)"
              @pointermove="handleAlbumCardPointerMove($event, collection)"
            >
              <header class="album-collection-card__header">
                <div class="album-collection-author">
                  <span class="album-collection-author__avatar">{{ collection.avatarLabel }}</span>
                  <span class="album-collection-author__name">{{ collection.author }}</span>
                  <time :datetime="collection.date">{{ collection.date }}</time>
                </div>

                <button
                  class="album-collection-card__open"
                  type="button"
                  :aria-label="collection.locked ? '输入私密相册密码' : `进入${collection.title}`"
                  @click.stop="openCollection(collection, $event)"
                >
                  <LockKeyhole v-if="collection.locked" :size="18" aria-hidden="true" />
                  <ArrowRight v-else :size="18" aria-hidden="true" />
                </button>
              </header>

              <h2 class="album-collection-card__title">{{ collection.title }}</h2>

              <div v-if="!collection.locked" class="album-collection-preview" aria-hidden="false">
                <button
                  v-for="(photo, photoIndex) in collection.previewPhotos"
                  :key="photo.cardId"
                  class="album-collection-preview__cell"
                  type="button"
                  :style="getAlbumPreviewCellStyle(collection, photoIndex)"
                  :aria-label="`进入${collection.title}，预览${photo.caption}`"
                  @click.stop="openCollection(collection, $event)"
                >
                  <img :src="photo.url" :alt="photo.caption" loading="lazy" />
                  <span
                    v-if="photoIndex === collection.previewPhotos.length - 1 && collection.remainingCount > 0"
                    class="album-collection-preview__more"
                  >
                    +{{ collection.remainingCount }}
                  </span>
                </button>
              </div>

              <div v-else class="album-private-panel">
                <LockKeyhole :size="44" aria-hidden="true" />
                <span>私密相册</span>
                <small>{{ collection.description }}</small>
              </div>

              <footer class="album-collection-card__footer">
                <span>
                  <MapPin :size="15" aria-hidden="true" />
                  {{ collection.location }}
                </span>
                <span>
                  <Eye :size="15" aria-hidden="true" />
                  {{ collection.views }} 浏览
                </span>
                <button
                  class="album-collection-like"
                  :class="{ 'is-liked': collection.likedToday, 'is-pending': isAlbumLikePending(collection.albumId) }"
                  type="button"
                  :data-album-like-id="collection.id"
                  :aria-pressed="collection.likedToday ? 'true' : 'false'"
                  :aria-label="`喜欢${collection.title}`"
                  :disabled="isAlbumLikePending(collection.albumId)"
                  @click.stop="handleLikeCollection(collection)"
                >
                  <Heart :size="15" aria-hidden="true" />
                  {{ collection.likes }} 喜欢
                </button>
                <span>
                  <Images :size="15" aria-hidden="true" />
                  {{ collection.photoCount }} 张照片
                </span>
              </footer>
            </article>
          </div>

          <p v-if="loadingMore" class="album-catalog-notice" role="status">正在翻到下一页...</p>
        </section>
      </Transition>

      <AlbumCollectionEnterTransition
        v-if="shouldShowEnterTransition && selectedCollection"
        :collection="selectedCollection"
        :photos="selectedCollection.previewPhotos"
        :source-rect="transitionSourceRect"
        :photo-rects="transitionPhotoRects"
        @done="activateImmersiveGallery"
      />

      <AlbumImmersiveGallery
        v-if="shouldShowImmersiveGallery && selectedCollection"
        :collection="selectedCollection"
        :photos="selectedCollection.photos"
        @close="closeCollection"
        @preview="openPhotoPreview"
      />

      <button v-if="canManageAlbums" class="album-create-fab" data-album-create-open type="button" aria-label="新增相册" @click="openCreateDialog">
        <img class="album-create-fab__image" :src="albumCreateEntry" alt="" draggable="false" />
        <span class="visually-hidden">新增相册</span>
      </button>

      <Teleport to="body">
        <Transition v-bind="albumPreviewTransitionHandlers">
          <div
            v-if="selectedPhoto && selectedCollection"
            class="album-photo-preview__backdrop"
            :data-album-preview-gsap="albumGsapMotionAttr"
            :data-preview-switching="isPhotoPreviewSwitching ? 'true' : undefined"
            @click="closePhotoPreview"
          >
            <section
              class="album-photo-preview"
              role="dialog"
              aria-modal="true"
              :aria-label="`照片预览：${selectedPhoto.caption}`"
              @click.stop
            >
              <span class="album-photo-preview__darkroom-grain" aria-hidden="true"></span>

              <button class="album-photo-preview__close" type="button" aria-label="关闭照片预览" @click="closePhotoPreview">
                <X :size="22" aria-hidden="true" />
              </button>

              <button
                class="album-photo-preview__nav album-photo-preview__prev"
                type="button"
                aria-label="上一张照片"
                @click="showPreviousPhoto"
              >
                <ChevronLeft :size="30" aria-hidden="true" />
              </button>

              <figure
                :key="previewMotionKey"
                class="album-photo-preview__paper"
                :data-preview-motion-key="previewMotionKey"
              >
                <img class="album-photo-preview__image" :src="selectedPhoto.url" :alt="selectedPhoto.caption" />
                <figcaption class="album-photo-preview__meta">
                  <span class="album-photo-preview__caption">{{ selectedPhoto.caption }}</span>
                  <span>{{ selectedCollection.title }}</span>
                  <time :datetime="selectedPhoto.date">{{ selectedPhoto.date }}</time>
                  <span>{{ selectedPhoto.location }}</span>
                </figcaption>
              </figure>

              <button
                class="album-photo-preview__nav album-photo-preview__next"
                type="button"
                aria-label="下一张照片"
                @click="showNextPhoto"
              >
                <ChevronRight :size="30" aria-hidden="true" />
              </button>

              <p class="album-photo-preview__counter">
                {{ currentPreviewPosition }} / {{ selectedCollection.photos.length }}
              </p>
            </section>
          </div>
        </Transition>
      </Teleport>

      <Teleport to="body">
        <Transition v-bind="albumPreviewTransitionHandlers">
          <div
            v-if="privateDialogCollection"
            class="album-photo-preview__backdrop"
            :data-album-preview-gsap="albumGsapMotionAttr"
            @click="closePrivateDialog"
          >
            <form
              class="album-private-unlock"
              data-album-unlock-submit
              role="dialog"
              aria-modal="true"
              aria-label="私密相册解锁"
              @submit.prevent="submitPrivateUnlock"
              @click.stop
            >
              <button class="album-photo-preview__close" type="button" aria-label="关闭私密相册解锁" @click="closePrivateDialog">
                <X :size="22" aria-hidden="true" />
              </button>
              <LockKeyhole :size="34" aria-hidden="true" />
              <h2>私密相册</h2>
              <p>{{ privateError || '请输入私密相册密码' }}</p>
              <NInput
                v-model:value="privatePassword"
                data-album-unlock-field
                type="password"
                autocomplete="off"
                placeholder="输入密码"
                show-password-on="click"
                :input-props="albumUnlockInputProps"
              />
              <NButton class="album-private-unlock__submit" attr-type="submit" type="primary" :loading="unlocking" :disabled="unlocking">
                {{ unlocking ? '解锁中...' : '进入相册' }}
              </NButton>
            </form>
          </div>
        </Transition>
      </Teleport>

      <Teleport to="body">
        <Transition :css="false">
          <div
            v-if="createDialogOpen"
            ref="createDialogBackdropRef"
            class="album-photo-preview__backdrop album-photo-preview__backdrop--create"
            data-smooth-scroll-prevent
            :data-album-create-closing="albumCreateDialogClosing ? 'true' : undefined"
            @click="closeCreateDialog"
          >
            <section
              ref="createDialogRef"
              class="album-create-dialog"
              data-album-create-dialog
              role="dialog"
              aria-modal="true"
              aria-label="新增相册"
              @click.stop
            >
              <img
                class="album-create-dialog__background"
                :src="albumCreateDialogBackground"
                alt=""
                aria-hidden="true"
                draggable="false"
                decoding="async"
              />

              <header class="album-create-dialog__header">
                <h2>{{ draftAlbum ? '继续上传未完成相册' : '新增相册' }}</h2>
              </header>

              <form class="album-create-form" @submit.prevent="submitDraftAndUpload">
                <div class="album-create-form__main">
                  <div class="album-create-form__left">
                    <label class="album-create-field">
                      <span>相册标题 <b aria-hidden="true">*</b></span>
                      <NInput
                        v-model:value="draftForm.title"
                        maxlength="120"
                        :disabled="Boolean(draftAlbum)"
                        :input-props="albumTitleInputProps"
                      />
                    </label>

                    <label class="album-create-field">
                      <span>相册描述</span>
                      <NInput
                        v-model:value="draftForm.description"
                        type="textarea"
                        maxlength="500"
                        :autosize="{ minRows: 4, maxRows: 5 }"
                        :disabled="Boolean(draftAlbum)"
                      />
                    </label>

                    <div class="album-create-options">
                      <div class="album-create-private">
                        <span class="album-create-private__label">私密相册 <i aria-hidden="true">i</i></span>
                        <button
                          class="album-create-switch"
                          type="button"
                          :aria-pressed="draftForm.visibility === 'private'"
                          :disabled="Boolean(draftAlbum)"
                          @click="setDraftPrivate(draftForm.visibility !== 'private')"
                        >
                          <span></span>
                        </button>
                      </div>

                      <label class="album-create-field album-create-field--password">
                        <span>访问密码 <i aria-hidden="true">i</i></span>
                        <span class="album-create-password">
                          <NInput
                            v-model:value="draftForm.privatePassword"
                            type="password"
                            autocomplete="off"
                            show-password-on="click"
                            :input-props="albumPrivatePasswordInputProps"
                            :disabled="Boolean(draftAlbum) || draftForm.visibility !== 'private'"
                          >
                            <template #suffix>
                              <EyeOff :size="20" aria-hidden="true" />
                            </template>
                          </NInput>
                        </span>
                      </label>
                    </div>
                  </div>

                  <div class="album-create-form__divider" aria-hidden="true"></div>

                  <div class="album-create-form__right">
                    <h3>上传照片 <b aria-hidden="true">*</b></h3>

                    <div
                      class="album-create-upload"
                      :data-upload-has-items="albumUploadItems.length ? 'true' : undefined"
                      @dragover.prevent
                      @drop.prevent="handleDraftDrop"
                    >
                      <img
                        class="album-create-upload__panel"
                        :src="albumCreateUploadPanel"
                        alt=""
                        aria-hidden="true"
                        draggable="false"
                        decoding="async"
                      />
                      <label
                        v-if="!albumUploadItems.length"
                        class="album-create-upload__content"
                        for="album-create-file-input"
                      >
                        <img
                          class="album-create-upload__illustration"
                          :src="albumCreateUploadIllustration"
                          alt=""
                          aria-hidden="true"
                          draggable="false"
                          decoding="async"
                        />
                        <span class="album-create-upload__title">点击或拖拽照片到这里上传</span>
                        <span class="album-create-upload__format">支持 JPG / PNG / WEBP</span>
                        <span class="album-create-upload__limit">单次最多 300 张</span>
                      </label>
                      <NUpload
                        v-model:file-list="albumDraftFileList"
                        class="album-create-upload__input"
                        accept="image/*"
                        multiple
                        :default-upload="false"
                        :show-file-list="false"
                        :input-props="{ accept: 'image/*', multiple: true }"
                        @change="handleDraftFiles"
                      >
                        <span class="visually-hidden">选择照片</span>
                      </NUpload>
                      <input
                        id="album-create-file-input"
                        data-album-file-input
                        type="file"
                        accept="image/*"
                        multiple
                        @change="handleDraftFiles"
                      />

                      <ul
                        v-if="albumUploadItems.length && !shouldShowAlbumUploadProgress"
                        class="album-upload-list"
                        aria-label="照片上传队列"
                      >
                        <li v-for="item in albumUploadItems" :key="item.id" class="album-upload-item" :data-upload-status="item.status">
                          <span>{{ item.file.name }}</span>
                          <small data-album-upload-status>{{ item.message }}</small>
                          <NButton
                            v-if="item.status === 'failed'"
                            attr-type="button"
                            quaternary
                            circle
                            aria-label="重试上传"
                            @click="retryUploadItem(item)"
                          >
                            <RotateCcw :size="16" aria-hidden="true" />
                          </NButton>
                          <NButton
                            v-if="item.status === 'failed' || item.status === 'waiting'"
                            attr-type="button"
                            quaternary
                            circle
                            aria-label="移除照片"
                            @click="albumLifecycle.removeUpload(item.id)"
                          >
                            <Trash2 :size="16" aria-hidden="true" />
                          </NButton>
                        </li>
                        <li class="album-upload-add-item">
                          <label class="album-upload-add" for="album-create-file-input" aria-label="继续添加照片">
                            <Plus :size="18" aria-hidden="true" />
                          </label>
                        </li>
                      </ul>

                      <div
                        v-if="albumUploadItems.length && shouldShowAlbumUploadProgress"
                        class="album-upload-progress"
                        role="status"
                        aria-label="照片上传进度"
                      >
                        <span class="album-upload-progress__count">{{ albumUploadProgressText }}</span>
                        <span class="album-upload-progress__bar" aria-hidden="true">
                          <span class="album-upload-progress__bar-fill" :style="{ width: `${albumUploadProgressPercent}%` }"></span>
                        </span>
                        <label class="album-upload-add album-upload-add--progress" for="album-create-file-input" aria-label="继续添加照片">
                          <Plus :size="18" aria-hidden="true" />
                        </label>
                      </div>
                    </div>

                    <p v-if="albumUploadError || draftNotice" class="album-create-dialog__notice" role="status">
                      {{ albumUploadError || draftNotice }}
                    </p>
                  </div>
                </div>

                <div class="album-create-dialog__actions">
                  <NButton v-if="draftAlbum" attr-type="button" class="album-create-cancel" @click="cancelCurrentDraft">取消草稿</NButton>
                  <NButton data-album-submit-draft attr-type="submit" :loading="draftSaving || albumUploading" :disabled="draftSaving || albumUploading">
                    {{ albumUploading ? '上传中...' : draftAlbum ? '上传新照片' : '保存草稿并上传' }}
                  </NButton>
                  <NButton
                    data-album-publish
                    attr-type="button"
                    type="primary"
                    :loading="draftPublishing"
                    :disabled="!draftAlbum || draftPublishing"
                    @click="publishDraftAlbum"
                  >
                    {{ draftPublishing ? '发布中...' : '发布相册' }}
                  </NButton>
                </div>
              </form>
            </section>
          </div>
        </Transition>
      </Teleport>
    </section>

    <PageLoader :loading="!loaded" />
  </main>
</template>
