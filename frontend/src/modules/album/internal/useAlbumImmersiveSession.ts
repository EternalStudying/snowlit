import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref
} from 'vue';
import type {
  AlbumCollection,
  AlbumImmersivePhase
} from '../model';
import type { AlbumOpenResult } from './useAlbumLifecycle';

const PREVIEW_PHOTO_LIMIT = 9;
const LEAVE_DURATION = 260;
const PHOTO_DEVELOP_DURATION = 900;

type AlbumImmersiveSessionOptions = {
  catalogNotice: Ref<string>;
  reducedMotion: boolean;
  prepareOpen(
    albumId: number,
    password?: string
  ): Promise<AlbumOpenResult>;
};

export function useAlbumImmersiveSession({
  catalogNotice,
  reducedMotion,
  prepareOpen
}: AlbumImmersiveSessionOptions) {
  const selectedCollection = ref<AlbumCollection | null>(null);
  const selectedPhotoIndex = ref<number | null>(null);
  const immersivePhase = ref<AlbumImmersivePhase>('idle');
  const transitionSourceRect = ref<DOMRect | null>(null);
  const transitionPhotoRects = ref<DOMRect[]>([]);
  const privateDialogCollection = ref<AlbumCollection | null>(null);
  const privatePassword = ref('');
  const privateError = ref('');
  const unlocking = ref(false);
  const previewMotionKey = ref(0);
  const isPhotoPreviewSwitching = ref(false);

  let returnScrollY = 0;
  let closeCollectionTimer: number | undefined;
  let photoPreviewMotionTimer: number | undefined;
  let pendingEnteredCallback: (() => Promise<void>) | undefined;

  const selectedPhoto = computed(() => {
    if (!selectedCollection.value || selectedPhotoIndex.value === null) {
      return null;
    }

    return (
      selectedCollection.value.photos[selectedPhotoIndex.value] ?? null
    );
  });
  const currentPreviewPosition = computed(() =>
    selectedPhotoIndex.value === null
      ? 0
      : selectedPhotoIndex.value + 1
  );
  const isImmersiveOpen = computed(
    () =>
      immersivePhase.value === 'entering' ||
      immersivePhase.value === 'active'
  );
  const shouldShowCollectionList = computed(
    () =>
      !selectedCollection.value ||
      immersivePhase.value === 'entering' ||
      immersivePhase.value === 'leaving'
  );
  const shouldShowEnterTransition = computed(
    () =>
      immersivePhase.value === 'entering' &&
      selectedCollection.value !== null
  );
  const shouldShowImmersiveGallery = computed(
    () =>
      immersivePhase.value === 'active' &&
      selectedCollection.value !== null
  );
  const immersiveRootClass = computed(() => ({
    'album-page--immersive-leaving':
      immersivePhase.value === 'leaving'
  }));

  watch(
    isImmersiveOpen,
    (isOpen) => {
      document.body.classList.toggle('is-album-immersive', isOpen);
    },
    { immediate: true }
  );

  function getCollectionElement(event?: Event): HTMLElement | null {
    const target = event?.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    return (
      target.closest<HTMLElement>('.album-collection-card') ?? target
    );
  }

  function getCollectionSourceRect(event?: Event): DOMRect | null {
    return getCollectionElement(event)?.getBoundingClientRect() ?? null;
  }

  function getCollectionPhotoRects(event?: Event): DOMRect[] {
    const collectionElement = getCollectionElement(event);
    if (!collectionElement) {
      return [];
    }

    return Array.from(
      collectionElement.querySelectorAll<HTMLElement>(
        '.album-collection-preview__cell'
      )
    )
      .slice(0, PREVIEW_PHOTO_LIMIT)
      .map((cell) => cell.getBoundingClientRect());
  }

  async function openCollection(
    collection: AlbumCollection,
    event?: Event
  ) {
    if (immersivePhase.value !== 'idle') {
      return;
    }

    catalogNotice.value = '';
    const sourceRect = getCollectionSourceRect(event);
    const photoRects = getCollectionPhotoRects(event);
    const result = await prepareOpen(collection.albumId);

    if (result.kind === 'opened') {
      pendingEnteredCallback = result.entered;
      startCollection(result.collection, sourceRect, photoRects);
    } else if (result.kind === 'password-required') {
      openPrivateDialog(collection, result.message);
    } else {
      catalogNotice.value = result.message;
    }
  }

  function startCollection(
    collection: AlbumCollection,
    sourceRect: DOMRect | null,
    photoRects: DOMRect[]
  ) {
    returnScrollY = window.scrollY;
    selectedPhotoIndex.value = null;
    selectedCollection.value = collection;
    transitionSourceRect.value = sourceRect;
    transitionPhotoRects.value = photoRects;
    immersivePhase.value = 'entering';
  }

  function openPrivateDialog(
    collection: AlbumCollection,
    message: string
  ) {
    privateDialogCollection.value = collection;
    privatePassword.value = '';
    privateError.value = message;
  }

  async function submitPrivateUnlock() {
    const collection = privateDialogCollection.value;
    if (!collection || unlocking.value) {
      return;
    }

    unlocking.value = true;
    privateError.value = '';
    try {
      const result = await prepareOpen(
        collection.albumId,
        privatePassword.value
      );
      if (result.kind === 'opened') {
        pendingEnteredCallback = result.entered;
        privateDialogCollection.value = null;
        startCollection(result.collection, null, []);
      } else {
        privateError.value = result.message;
      }
    } finally {
      unlocking.value = false;
    }
  }

  function closePrivateDialog() {
    privateDialogCollection.value = null;
    privatePassword.value = '';
    privateError.value = '';
  }

  function handleCollectionKeydown(
    event: KeyboardEvent,
    collection: AlbumCollection
  ) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    void openCollection(collection, event);
  }

  function activateImmersiveGallery() {
    if (!selectedCollection.value) {
      immersivePhase.value = 'idle';
      transitionSourceRect.value = null;
      transitionPhotoRects.value = [];
      return;
    }

    transitionPhotoRects.value = [];
    immersivePhase.value = 'active';
    const entered = pendingEnteredCallback;
    pendingEnteredCallback = undefined;
    void entered?.();
  }

  function restoreReturnScrollPosition() {
    if (typeof window === 'undefined') {
      return;
    }

    const top = returnScrollY;
    const restore = () => {
      if (!navigator.userAgent.toLowerCase().includes('jsdom')) {
        window.scrollTo({ left: 0, top, behavior: 'auto' });
      }
    };

    window.requestAnimationFrame(restore);
  }

  function clearPhotoPreviewMotionTimer() {
    if (photoPreviewMotionTimer === undefined) {
      return;
    }

    window.clearTimeout(photoPreviewMotionTimer);
    photoPreviewMotionTimer = undefined;
  }

  function triggerPhotoPreviewDevelop() {
    previewMotionKey.value += 1;

    if (reducedMotion) {
      isPhotoPreviewSwitching.value = false;
      return;
    }

    clearPhotoPreviewMotionTimer();
    isPhotoPreviewSwitching.value = true;
    photoPreviewMotionTimer = window.setTimeout(() => {
      isPhotoPreviewSwitching.value = false;
      photoPreviewMotionTimer = undefined;
    }, PHOTO_DEVELOP_DURATION);
  }

  async function closeCollection() {
    closePhotoPreview();

    if (closeCollectionTimer !== undefined) {
      window.clearTimeout(closeCollectionTimer);
      closeCollectionTimer = undefined;
    }

    if (!selectedCollection.value) {
      immersivePhase.value = 'idle';
      transitionSourceRect.value = null;
      transitionPhotoRects.value = [];
      restoreReturnScrollPosition();
      return;
    }

    immersivePhase.value = 'leaving';
    await nextTick();
    closeCollectionTimer = window.setTimeout(() => {
      selectedCollection.value = null;
      transitionSourceRect.value = null;
      transitionPhotoRects.value = [];
      immersivePhase.value = 'idle';
      restoreReturnScrollPosition();
      closeCollectionTimer = undefined;
    }, LEAVE_DURATION);
  }

  function openPhotoPreview(index: number) {
    if (!selectedCollection.value?.photos[index]) {
      return;
    }

    selectedPhotoIndex.value = index;
    triggerPhotoPreviewDevelop();
  }

  function closePhotoPreview() {
    selectedPhotoIndex.value = null;
    isPhotoPreviewSwitching.value = false;
    clearPhotoPreviewMotionTimer();
  }

  function showPhotoByOffset(offset: number) {
    if (
      !selectedCollection.value ||
      selectedPhotoIndex.value === null ||
      selectedCollection.value.photos.length === 0
    ) {
      return;
    }

    selectedPhotoIndex.value =
      (selectedPhotoIndex.value +
        offset +
        selectedCollection.value.photos.length) %
      selectedCollection.value.photos.length;
    triggerPhotoPreviewDevelop();
  }

  function showPreviousPhoto() {
    showPhotoByOffset(-1);
  }

  function showNextPhoto() {
    showPhotoByOffset(1);
  }

  function handlePhotoPreviewKeydown(event: KeyboardEvent) {
    if (selectedPhoto.value) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePhotoPreview();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPreviousPhoto();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        showNextPhoto();
      }
      return;
    }

    if (
      event.key === 'Escape' &&
      shouldShowImmersiveGallery.value
    ) {
      event.preventDefault();
      void closeCollection();
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handlePhotoPreviewKeydown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handlePhotoPreviewKeydown);
    clearPhotoPreviewMotionTimer();
    if (closeCollectionTimer !== undefined) {
      window.clearTimeout(closeCollectionTimer);
    }
    document.body.classList.remove('is-album-immersive');
  });

  return {
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
    immersiveRootClass,
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
  };
}
