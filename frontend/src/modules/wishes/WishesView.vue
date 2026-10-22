<script setup lang="ts">
import { IMAGE_ACCEPT, pickImages } from '../../imageFiles';
import './wishes.css';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type InputHTMLAttributes } from 'vue';
import { NAlert, NButton, NDatePicker, NInput, NModal, NUpload, type UploadFileInfo } from 'naive-ui';
import { ImageOff, ListPlus } from 'lucide-vue-next';
import PageLoader from '../../components/PageLoader.vue';
import PostmarkStamp from '../../components/paper/PostmarkStamp.vue';
import StickerButton from '../../components/paper/StickerButton.vue';
import { WISH_MARK_PATH } from './internal/useWishBoardMotion';
import { useModalWheelGuard } from '../../composables/useModalWheelGuard';
import { createCloseOnce } from '../../motion';
import { useWishBoardMotion } from './internal/useWishBoardMotion';
import { useWishLifecycle } from './internal/useWishLifecycle';
import type {
  WishCategory,
  WishItem,
  WishLaneKey,
  WishLaneTransition
} from './model';

interface WishBoardDefinition {
  laneKey: WishLaneKey;
  title: string;
  legend: string;
}

interface WishBoardGroup extends WishBoardDefinition {
  items: WishItem[];
  loading: boolean;
  hasMore: boolean;
}

const wishPageRef = ref<HTMLElement | null>(null);
const wishLifecycle = useWishLifecycle();
const wishBoardLoaded = wishLifecycle.state.loaded;
const wishBoardError = wishLifecycle.state.loadError;
const wishActionError = wishLifecycle.state.actionError;
const canManageWishes = wishLifecycle.state.canManage;
const isCreatingWish = wishLifecycle.state.creating;
const wishCreateError = wishLifecycle.state.createError;
const selectedWish = wishLifecycle.state.selectedWish;
const createWishDialogOpen = ref(false);
const isCreateWishClosing = ref(false);
const createWishCategory = ref<WishCategory>('want_go');
const createWishForm = ref({
  title: '',
  description: '',
  locationName: '',
  expectedCompletedAt: '',
  note: ''
});
const completionImageInputProps = {
  'data-wish-complete-image': '',
  accept: IMAGE_ACCEPT
} as unknown as InputHTMLAttributes;
const wishTitleInputProps = {
  'data-wish-title-input': '',
  required: true
} as unknown as InputHTMLAttributes;
const isWishDetailDialogVisible = ref(false);
const isImagePreviewOpen = ref(false);
const isCompletionAnimating = ref(false);
const completionImageError = ref('');
const wishDetailBackdropRef = ref<HTMLElement | null>(null);
const wishDetailDialogRef = ref<HTMLElement | null>(null);
const wishDetailImageRef = ref<HTMLImageElement | null>(null);
const imagePreviewRef = ref<HTMLElement | null>(null);
const imagePreviewImageRef = ref<HTMLImageElement | null>(null);
const completionBadgeRef = ref<HTMLButtonElement | null>(null);
const completionUploadHostRef = ref<HTMLElement | null>(null);
const completionImageFileList = ref<UploadFileInfo[]>([]);
const createWishBackdropRef = ref<HTMLElement | null>(null);
const createWishDialogRef = ref<HTMLFormElement | null>(null);
const wishCreatePopupPortal = ref<HTMLElement>();
const boardMotion = useWishBoardMotion({
  wishPageRef,
  wishDetailBackdropRef,
  wishDetailDialogRef,
  wishDetailImageRef,
  imagePreviewRef,
  imagePreviewImageRef,
  completionBadgeRef,
  createWishBackdropRef,
  createWishDialogRef
});
const isWishDetailAnimating = boardMotion.detailAnimating;
const isImagePreviewAnimating = boardMotion.imagePreviewAnimating;
const wishGsapMotionAttr = boardMotion.animated ? 'true' : undefined;
const wishDetailClose = createCloseOnce();
const createWishClose = createCloseOnce();
const imagePreviewClose = createCloseOnce();

useModalWheelGuard(createWishDialogOpen);

const wishBoardDefinitions: WishBoardDefinition[] = [
  {
    laneKey: 'wantToGo',
    title: '想去',
    legend: '想去：去看世界'
  },
  {
    laneKey: 'wantToDo',
    title: '想做',
    legend: '想做：一起成长'
  },
  {
    laneKey: 'done',
    title: '已完成',
    legend: '已完成：回忆收藏'
  }
];

const wishBoardGroups = computed<WishBoardGroup[]>(() =>
  wishBoardDefinitions.map((group) => {
    const lane = wishLifecycle.state.lanes[group.laneKey];
    return {
      ...group,
      items: lane.items.value,
      loading: lane.loading.value,
      hasMore: lane.hasMore.value
    };
  })
);
const wishLegendGroups = wishBoardDefinitions.map(({ laneKey, title, legend }) => ({
  laneKey,
  title,
  legend
}));
const isWishPageReady = computed(() => wishBoardLoaded.value);
const wishPageError = computed(() => wishBoardError.value);
const wishLaneKeys: WishLaneKey[] = ['wantToGo', 'wantToDo', 'done'];
const underfilledListTolerance = 4;
const selectedWishTimeLabel = computed(() =>
  selectedWish.value?.lane === 'done' ? '完成时间' : '预计完成时间'
);
const selectedWishTimeValue = computed(() =>
  selectedWish.value?.lane === 'done'
    ? selectedWish.value.completedAt
    : selectedWish.value?.expectedCompletedAt
);
const wishActionMessage = computed(
  () => completionImageError.value || wishActionError.value
);
const isCreateWishInteractionLocked = computed(
  () => isCreatingWish.value || isCreateWishClosing.value
);

function openCreateWish(category: WishCategory = 'want_go') {
  if (
    createWishDialogOpen.value ||
    createWishClose.closing ||
    isCreateWishInteractionLocked.value
  ) {
    return;
  }

  createWishCategory.value = category;
  createWishDialogOpen.value = true;
  wishLifecycle.clearCreateError();
  createWishForm.value = {
    title: '',
    description: '',
    locationName: '',
    expectedCompletedAt: '',
    note: ''
  };
  void nextTick(() => boardMotion.openCreate());
}

function setCreateWishCategory(category: WishCategory) {
  createWishCategory.value = category;
}

function updateCreateWishExpectedCompletedAt(value: string | null) {
  createWishForm.value.expectedCompletedAt = value ?? '';
}

function closeCreateWish(): Promise<void> {
  if (!createWishClose.closing) {
    if (isCreatingWish.value) {
      return Promise.resolve();
    }
    wishLifecycle.clearCreateError();
    if (!createWishDialogOpen.value) {
      return Promise.resolve();
    }
  }

  return createWishClose.run(async () => {
    isCreateWishClosing.value = true;
    try {
      await boardMotion.closeCreate();
    } finally {
      createWishDialogOpen.value = false;
      isCreateWishClosing.value = false;
    }
  });
}

async function submitCreateWish() {
  if (
    !createWishDialogOpen.value ||
    isCreateWishInteractionLocked.value ||
    createWishClose.closing
  ) {
    return;
  }

  const created = await wishLifecycle.createWish({
    title: createWishForm.value.title,
    category: createWishCategory.value,
    description: createWishForm.value.description,
    locationName: createWishForm.value.locationName,
    expectedCompletedAt: createWishForm.value.expectedCompletedAt || null,
    note: createWishForm.value.note
  });

  if (created) {
    await closeCreateWish();
    await ensureWishLaneHasScrollableContent(created.lane);
  }
}

function handleWishLaneScroll(group: WishBoardGroup, event: Event) {
  const target = event.currentTarget as HTMLElement | null;
  if (!target || !group.hasMore || group.loading) {
    return;
  }

  const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
  if (distanceToBottom <= 48) {
    void wishLifecycle.loadNextPage(group.laneKey);
  }
}

function isWishLaneUnderfilled(list: HTMLElement) {
  return list.clientHeight > 0 && list.scrollHeight <= list.clientHeight + underfilledListTolerance;
}

async function ensureWishLaneHasScrollableContent(laneKey: WishLaneKey) {
  const lane = wishLifecycle.state.lanes[laneKey];
  let consecutiveNonAdvancingLoads = 0;
  while (true) {
    await nextTick();
    const list = boardMotion.laneList(laneKey);
    if (
      !list ||
      !lane.loaded.value ||
      !lane.hasMore.value ||
      !isWishLaneUnderfilled(list)
    ) {
      return;
    }

    const previousPage = lane.page.value;
    const loadedPage = await wishLifecycle.loadNextPage(laneKey);
    if (!loadedPage) {
      return;
    }
    if (lane.page.value <= previousPage) {
      consecutiveNonAdvancingLoads += 1;
      if (consecutiveNonAdvancingLoads > 1) {
        return;
      }
      continue;
    }
    consecutiveNonAdvancingLoads = 0;
  }
}

function ensureUnderfilledWishLanesCanLoadMore() {
  wishLaneKeys.forEach((laneKey) => {
    void ensureWishLaneHasScrollableContent(laneKey);
  });
}

async function openWishDetail(wish: WishItem) {
  if (isWishDetailAnimating.value || isCompletionAnimating.value) {
    return;
  }

  completionImageError.value = '';
  wishLifecycle.clearActionError();
  const detail = await wishLifecycle.selectWish(wish.id);
  if (!detail) {
    return;
  }

  isWishDetailDialogVisible.value = true;
  isImagePreviewOpen.value = false;
  await nextTick();
  await boardMotion.openDetail();
  ensureUnderfilledWishLanesCanLoadMore();
}

function closeWishDetail(): Promise<void> {
  if (!wishDetailClose.closing && (!selectedWish.value || !isWishDetailDialogVisible.value)) {
    return Promise.resolve();
  }

  return wishDetailClose.run(async () => {
    if (isImagePreviewOpen.value) {
      await closeImagePreview();
    }

    isWishDetailAnimating.value = true;
    try {
      await boardMotion.closeDetail();
    } finally {
      isWishDetailAnimating.value = false;
      isWishDetailDialogVisible.value = false;
      isImagePreviewOpen.value = false;
      completionImageError.value = '';
      wishLifecycle.clearSelectedWish();
    }
  });
}

async function openImagePreview() {
  if (!selectedWish.value || isImagePreviewOpen.value || isImagePreviewAnimating.value) {
    return;
  }

  const sourceRect = wishDetailImageRef.value?.getBoundingClientRect() ?? null;
  isImagePreviewOpen.value = true;
  await nextTick();
  await boardMotion.openImagePreview(sourceRect);
}

function closeImagePreview(): Promise<void> {
  if (!imagePreviewClose.closing && !isImagePreviewOpen.value) {
    return Promise.resolve();
  }

  return imagePreviewClose.run(async () => {
    try {
      await boardMotion.closeImagePreview();
    } finally {
      isImagePreviewOpen.value = false;
    }
  });
}

async function requestWishCompletionImage() {
  const wish = selectedWish.value;

  if (!wish || wish.lane === 'done' || isCompletionAnimating.value) {
    return;
  }

  completionImageError.value = '';
  wishLifecycle.clearActionError();
  completionUploadHostRef.value?.querySelector<HTMLInputElement>('input[data-wish-complete-image]')?.click();
}

async function handleCompletionImageSelected(options: { fileList: UploadFileInfo[] }) {
  const picked = pickImages(options.fileList.slice(-1));
  completionImageFileList.value = [];
  const image = picked.accepted[0];

  if (!image) {
    completionImageError.value = picked.rejection || '请先选择一张完成图片';
    return;
  }
  await completeSelectedWishWithImage(image);
}

async function completeSelectedWishWithImage(image: File) {
  const wish = selectedWish.value;

  if (!wish || wish.lane === 'done' || isCompletionAnimating.value) {
    return;
  }

  isCompletionAnimating.value = true;
  completionImageError.value = '';
  wishLifecycle.clearActionError();

  try {
    const transition = await wishLifecycle.completeWish(wish.id, image);
    if (!transition) {
      return;
    }
    await boardMotion.stampCompletion();
    await closeWishDetail();
    await moveWishToLane(transition);
    ensureUnderfilledWishLanesCanLoadMore();
  } finally {
    isCompletionAnimating.value = false;
  }
}

async function reopenSelectedWish() {
  const wish = selectedWish.value;

  if (!wish || wish.lane !== 'done' || isCompletionAnimating.value) {
    return;
  }

  isCompletionAnimating.value = true;
  completionImageError.value = '';
  wishLifecycle.clearActionError();

  try {
    const transition = await wishLifecycle.reopenWish(wish.id);
    if (!transition) {
      return;
    }
    await closeWishDetail();
    await moveWishToLane(transition);
    ensureUnderfilledWishLanesCanLoadMore();
  } finally {
    isCompletionAnimating.value = false;
  }
}

function moveWishToLane(transition: WishLaneTransition) {
  return boardMotion.moveWish(transition, () => wishLifecycle.commitLaneTransition(transition));
}

function handleWishDetailKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return;
  }

  if (isImagePreviewOpen.value) {
    void closeImagePreview();
    return;
  }

  if (selectedWish.value) {
    void closeWishDetail();
  }
}

watch(
  wishBoardLoaded,
  (hasLoadedWishBoard) => {
    if (hasLoadedWishBoard) {
      nextTick(() => {
        boardMotion.enterBoard();
        ensureUnderfilledWishLanesCanLoadMore();
      });
    }
  },
  { immediate: true }
);

onMounted(() => {
  void wishLifecycle.loadInitial();
  window.addEventListener('keydown', handleWishDetailKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWishDetailKeydown);
});
</script>

<template>
  <main ref="wishPageRef" class="list-page" :data-wish-gsap="wishGsapMotionAttr">
    <section class="list-hero" aria-labelledby="wish-page-title">
      <div class="list-hero__sheet">
        <PostmarkStamp class="list-hero__stamp" />
        <div class="list-hero__copy">
          <h1 id="wish-page-title" class="list-hero__title">
            我们的<span class="list-hero__title-accent">共同</span>清单
          </h1>
          <p class="list-hero__subtitle">每一个小心愿，都是我们一起走过的日常。</p>
        </div>
      </div>

      <aside class="list-note-card" aria-label="一起的小约定">
        <span class="washi washi--top" aria-hidden="true"></span>
        <div class="list-note-card__copy">
          <p class="list-note-card__title">一起的小约定</p>
          <p>用心收藏每一刻。未来的我们，一定会感谢现在一起努力的自己。</p>
        </div>
      </aside>
    </section>

    <section v-if="isWishPageReady" class="list-main" aria-label="共同清单分组">
      <div v-if="wishPageError || (wishActionError && !isWishDetailDialogVisible)" class="wish-page-alerts">
        <NAlert v-if="wishPageError" type="error" :show-icon="false" role="alert">
          {{ wishPageError }}
        </NAlert>
        <NAlert
          v-if="wishActionError && !isWishDetailDialogVisible"
          type="error"
          :show-icon="false"
          role="alert"
        >
          {{ wishActionError }}
        </NAlert>
      </div>

      <div class="wish-board-grid">
        <article
          v-for="group in wishBoardGroups"
          :key="group.laneKey"
          class="wish-board"
          :data-group="group.laneKey"
          :aria-label="group.title"
        >
          <header class="wish-board__head">
            <h2 class="paper-tab wish-board__tab">{{ group.title }}</h2>
            <span class="wish-board__count">{{ group.items.length }} 项</span>
          </header>
          <div class="wish-board__content">
            <ul
              class="wish-lane-list"
              :data-wish-lane="group.laneKey"
              :aria-label="`${group.title}清单`"
              @scroll="handleWishLaneScroll(group, $event)"
            >
              <li v-for="item in group.items" :key="item.id" class="wish-lane-entry">
                <button class="wish-lane-item" type="button" :data-wish-id="item.id" @click="openWishDetail(item)">
                  <span class="wish-lane-item__title" :title="item.title">{{ item.title }}</span>
                </button>
              </li>
            </ul>
          </div>
        </article>
      </div>

      <footer class="list-legend" aria-label="清单图例">
        <span v-for="legend in wishLegendGroups" :key="legend.laneKey" :data-group="legend.laneKey">
          {{ legend.legend }}
        </span>
      </footer>
    </section>

    <PageLoader :loading="!isWishPageReady" />

    <StickerButton v-if="canManageWishes" class="wish-create-fab" data-wish-create-open tone="camellia" :tilt="-3" aria-label="新增清单" @click="openCreateWish()">
      <template #icon><ListPlus :stroke-width="1.8" /></template>
      新增清单
    </StickerButton>

    <Teleport to="body">
      <div
        v-if="isWishDetailDialogVisible && selectedWish"
        ref="wishDetailBackdropRef"
        class="wish-dialog-backdrop"
        @click.self="closeWishDetail()"
      >
        <section
          ref="wishDetailDialogRef"
          class="wish-detail-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="`wish-detail-title-${selectedWish.id}`"
          :data-wish-lane="selectedWish.lane"
        >
          <div class="wish-detail-dialog__image-panel">
            <button v-if="selectedWish.imageUrl" class="wish-detail-dialog__image-button" type="button" aria-label="查看完整图片" @click.stop="openImagePreview">
              <img ref="wishDetailImageRef" class="wish-detail-dialog__image" :src="selectedWish.imageUrl" :alt="selectedWish.title" />
            </button>
            <div v-else class="wish-detail-dialog__no-image">
              <ImageOff :size="28" :stroke-width="1.5" aria-hidden="true" />
              <span>还没有照片，完成时可以贴一张</span>
            </div>
          </div>

          <div class="wish-detail-dialog__info">
            <button class="wish-detail-dialog__close" type="button" aria-label="关闭详情弹窗" @click="closeWishDetail()">×</button>

            <div class="wish-detail-dialog__body">
              <h2 :id="`wish-detail-title-${selectedWish.id}`" class="wish-detail-dialog__title">
                {{ selectedWish.title }}
              </h2>
              <p class="wish-detail-dialog__description">{{ selectedWish.description }}</p>

              <dl class="wish-detail-dialog__details">
                <div>
                  <dt>地点</dt>
                  <dd>{{ selectedWish.location }}</dd>
                </div>
                <div>
                  <dt>创建时间</dt>
                  <dd>{{ selectedWish.createdAt }}</dd>
                </div>
                <div>
                  <dt>{{ selectedWishTimeLabel }}</dt>
                  <dd>{{ selectedWishTimeValue || '未设置' }}</dd>
                </div>
                <div>
                  <dt>备注</dt>
                  <dd>{{ selectedWish.note || '暂无备注' }}</dd>
                </div>
              </dl>

              <p v-if="wishActionMessage" class="wish-detail-dialog__error" role="alert">{{ wishActionMessage }}</p>
            </div>

            <div class="wish-detail-dialog__completion">
              <span ref="completionUploadHostRef" class="visually-hidden">
                <NUpload
                  v-model:file-list="completionImageFileList"
                  :accept="IMAGE_ACCEPT"
                  :max="1"
                  :default-upload="false"
                  :show-file-list="false"
                  :input-props="completionImageInputProps"
                  @change="handleCompletionImageSelected"
                />
              </span>
              <button
                v-if="selectedWish.lane !== 'done'"
                ref="completionBadgeRef"
                class="wish-completion-badge wish-completion-badge--pending"
                type="button"
                aria-label="标记为已完成"
                :disabled="isCompletionAnimating"
                @click="requestWishCompletionImage"
              >
                <span aria-hidden="true"><svg class="wish-completion-badge__mark" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path class="wish-completion-badge__ring" d="M20 5a15 15 0 1 1 0 30a15 15 0 1 1 0-30" stroke-width="2" /><path class="wish-completion-badge__tick" :d="WISH_MARK_PATH.pending" stroke-width="3.4" /></svg></span>
                <strong>待完成</strong>
              </button>
              <button
                v-else
                ref="completionBadgeRef"
                class="wish-completion-badge wish-completion-badge--done"
                type="button"
                aria-label="撤回完成"
                :disabled="isCompletionAnimating"
                @click="reopenSelectedWish"
              >
                <span aria-hidden="true"><svg class="wish-completion-badge__mark" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path class="wish-completion-badge__ring" d="M20 5a15 15 0 1 1 0 30a15 15 0 1 1 0-30" stroke-width="2" /><path class="wish-completion-badge__tick" :d="WISH_MARK_PATH.done" stroke-width="3.4" /></svg></span>
                <strong>撤回完成</strong>
              </button>
            </div>
          </div>
        </section>
      </div>

      <div v-if="selectedWish && isImagePreviewOpen" ref="imagePreviewRef" class="wish-image-preview" @click.self="closeImagePreview">
        <button class="wish-image-preview__close" type="button" aria-label="关闭图片预览" @click="closeImagePreview">×</button>
        <img ref="imagePreviewImageRef" class="wish-image-preview__image" :src="selectedWish.imageUrl" :alt="selectedWish.title" />
      </div>

      <NModal
        :show="createWishDialogOpen"
        :block-scroll="false"
        :trap-focus="true"
        :close-on-esc="!isCreateWishInteractionLocked"
        :mask-closable="!isCreateWishInteractionLocked"
        :z-index="5000"
        display-directive="if"
        @esc="closeCreateWish"
        @mask-click="closeCreateWish"
      >
        <div
          v-if="createWishDialogOpen"
          ref="createWishBackdropRef"
          class="wish-dialog-backdrop wish-dialog-backdrop--create"
          data-smooth-scroll-prevent
        >
          <form
            ref="createWishDialogRef"
            class="wish-create-dialog"
            data-wish-create-form
            role="dialog"
            aria-modal="true"
            aria-label="新增清单"
            @submit.prevent="submitCreateWish"
          >
            <h2 class="wish-create-dialog__title">新增清单</h2>

          <div class="wish-create-dialog__content">
            <div class="wish-create-dialog__left">
              <div class="wish-create-field wish-create-field--category">
                <span>分类</span>
                <div class="wish-create-dialog__category" aria-label="清单分类">
                  <NButton
                    data-wish-category-select="want_go"
                    attr-type="button"
                    :aria-pressed="createWishCategory === 'want_go'"
                    quaternary
                    @click="setCreateWishCategory('want_go')"
                  >
                    想去
                  </NButton>
                  <NButton
                    data-wish-category-select="want_do"
                    attr-type="button"
                    :aria-pressed="createWishCategory === 'want_do'"
                    quaternary
                    @click="setCreateWishCategory('want_do')"
                  >
                    想做
                  </NButton>
                </div>
              </div>

              <label class="wish-create-field wish-create-field--single-line">
                <span>标题 <b aria-hidden="true">*</b></span>
                <span class="wish-create-input-shell">
                  <NInput
                    v-model:value="createWishForm.title"
                    required
                    maxlength="160"
                    placeholder="给这件事起个名字吧"
                    :input-props="wishTitleInputProps"
                  />
                  <small>{{ createWishForm.title.length }}/160</small>
                </span>
              </label>

              <label class="wish-create-field wish-create-field--textarea">
                <span>描述 <b aria-hidden="true">*</b></span>
                <span class="wish-create-input-shell">
                  <NInput
                    v-model:value="createWishForm.description"
                    type="textarea"
                    maxlength="500"
                    placeholder="这一件事的具体想法、原因或期待..."
                    :autosize="{ minRows: 3, maxRows: 4 }"
                  />
                  <small>{{ createWishForm.description.length }}/500</small>
                </span>
              </label>

              <label class="wish-create-field wish-create-field--single-line">
                <span>地点</span>
                <span class="wish-create-input-shell">
                  <NInput v-model:value="createWishForm.locationName" maxlength="120" placeholder="例如：巴黎、北海道、伦敦..." />
                  <small>{{ createWishForm.locationName.length }}/120</small>
                </span>
              </label>

              <label class="wish-create-field wish-create-field--date">
                <span>预计完成时间</span>
                <span class="wish-create-input-shell" :data-empty="createWishForm.expectedCompletedAt ? undefined : 'true'">
                  <NDatePicker
                    :formatted-value="createWishForm.expectedCompletedAt || null"
                    type="date"
                    value-format="yyyy-MM-dd"
                    placeholder="选择日期"
                    clearable
                    :actions="['confirm']"
                    :to="wishCreatePopupPortal"
                    @update:formatted-value="updateCreateWishExpectedCompletedAt"
                  />
                </span>
              </label>

              <label class="wish-create-field wish-create-field--textarea wish-create-field--note">
                <span>备注</span>
                <span class="wish-create-input-shell">
                  <NInput
                    v-model:value="createWishForm.note"
                    type="textarea"
                    maxlength="500"
                    placeholder="其他想补充的内容（可不填） ..."
                    :autosize="{ minRows: 2, maxRows: 3 }"
                  />
                  <small>{{ createWishForm.note.length }}/500</small>
                </span>
              </label>
            </div>

            <div class="wish-create-dialog__divider" aria-hidden="true"></div>
            <div class="wish-create-dialog__right" aria-hidden="true">
              <article class="wish-create-preview" :data-category="createWishCategory">
                <span class="paper-tab">{{ createWishCategory === 'want_do' ? '想做' : '想去' }}</span>
                <p class="wish-create-preview__title" :data-placeholder="createWishForm.title ? undefined : 'true'">
                  {{ createWishForm.title || '给这件事起个名字吧' }}
                </p>
                <p v-if="createWishForm.description" class="wish-create-preview__body">{{ createWishForm.description }}</p>
                <div v-if="createWishForm.locationName || createWishForm.expectedCompletedAt" class="wish-create-preview__meta">
                  <span v-if="createWishForm.locationName" class="paper-chip">{{ createWishForm.locationName }}</span>
                  <span v-if="createWishForm.expectedCompletedAt" class="paper-chip">{{ createWishForm.expectedCompletedAt }}</span>
                </div>
              </article>
              <p class="wish-create-preview__hint">保存后会贴在「{{ createWishCategory === 'want_do' ? '想做' : '想去' }}」板子最上面</p>
            </div>
          </div>

          <NAlert v-if="wishCreateError" class="wish-create-dialog__error" type="error" :show-icon="false">
            {{ wishCreateError }}
          </NAlert>
          <div class="wish-create-dialog__actions">
            <NButton
              class="wish-create-dialog__cancel"
              attr-type="button"
              secondary
              :disabled="isCreateWishInteractionLocked"
              @click="closeCreateWish"
            >
              <span>取消</span>
            </NButton>
            <NButton
              class="wish-create-dialog__submit"
              attr-type="submit"
              type="primary"
              :disabled="isCreateWishInteractionLocked"
              :loading="isCreatingWish"
            >
              <span>{{ isCreatingWish ? '保存中...' : '贴到板子上' }}</span>
            </NButton>
          </div>
          <div ref="wishCreatePopupPortal" class="wish-create-popup-portal" data-smooth-scroll-prevent></div>
          </form>
        </div>
      </NModal>
    </Teleport>
  </main>
</template>
