import {
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type Ref
} from 'vue';
import { gsap } from 'gsap';
import { useMotionSlots } from '../../../motion';

type AlbumDialogMotionOptions = {
  isCreateDialogOpen: Ref<boolean>;
  reducedMotion: boolean;
  clearDraftPendingState(): void;
};

export function useAlbumDialogMotion({
  isCreateDialogOpen,
  reducedMotion,
  clearDraftPendingState
}: AlbumDialogMotionOptions) {
  const createDialogBackdropRef = ref<HTMLElement | null>(null);
  const createDialogRef = ref<HTMLElement | null>(null);
  const isCreateDialogClosing = ref(false);

  let createDialogMotionContext: ReturnType<typeof gsap.context> | undefined;
  let createDialogOpenTimeline: gsap.core.Timeline | undefined;
  let createDialogCloseTimeline: gsap.core.Timeline | undefined;
  let photoPreviewMotionContext: ReturnType<typeof gsap.context> | undefined;
  let photoPreviewEnterTimeline: gsap.core.Timeline | undefined;
  let photoPreviewLeaveTimeline: gsap.core.Timeline | undefined;
  const slots = useMotionSlots<'createDialogOpenTimeline' | 'createDialogCloseTimeline' | 'photoPreviewEnterTimeline' | 'photoPreviewLeaveTimeline'>();

  watch(
    isCreateDialogOpen,
    (isOpen) => {
      if (!isOpen) {
        return;
      }

      isCreateDialogClosing.value = false;
      void nextTick(playCreateDialogOpen);
    },
    { flush: 'post' }
  );

  function stopCreateDialogMotion() {
    slots.stop('createDialogOpenTimeline');
    slots.stop('createDialogCloseTimeline');
    createDialogOpenTimeline = undefined;
    createDialogCloseTimeline = undefined;
    createDialogMotionContext?.revert();
    createDialogMotionContext = undefined;
  }

  function finishCreateDialogClose() {
    isCreateDialogOpen.value = false;
    isCreateDialogClosing.value = false;
    stopCreateDialogMotion();
  }

  function playCreateDialogOpen() {
    const backdrop = createDialogBackdropRef.value;

    if (!backdrop || !createDialogRef.value || reducedMotion) {
      return;
    }

    stopCreateDialogMotion();
    createDialogMotionContext = gsap.context(() => {
      const uploadDecor = Array.from(
        backdrop.querySelectorAll<HTMLElement>(
          '.album-create-upload__illustration, .album-create-upload__title, .album-create-upload__format, .album-create-upload__limit'
        )
      );
      const uploadQueueContent = Array.from(
        backdrop.querySelectorAll<HTMLElement>(
          '.album-upload-item, .album-upload-add, .album-upload-progress'
        )
      );
      const notice = Array.from(
        backdrop.querySelectorAll<HTMLElement>(
          '.album-create-dialog__notice'
        )
      );
      createDialogOpenTimeline = slots.hold('createDialogOpenTimeline', gsap.timeline({
        defaults: {
          ease: 'power3.out',
          overwrite: 'auto'
        }
      }));

      createDialogOpenTimeline
        .fromTo(
          backdrop,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: 0.18,
            clearProps: 'visibility'
          }
        )
        .fromTo(
          '.album-create-dialog',
          {
            autoAlpha: 0,
            y: 24,
            scale: 0.975,
            rotation: -0.35
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotation: 0,
            duration: 0.5,
            ease: 'back.out(1.14)',
            clearProps: 'opacity,transform,visibility'
          },
          '<'
        )
        .from(
          '.album-create-dialog__header',
          {
            autoAlpha: 0,
            y: -12,
            duration: 0.42,
            ease: 'back.out(1.45)',
            clearProps: 'all'
          },
          '<0.12'
        )
        .from(
          '.album-create-form__divider',
          {
            autoAlpha: 0,
            scaleY: 0.72,
            transformOrigin: 'center center',
            duration: 0.34,
            clearProps: 'all'
          },
          '<0.1'
        )
        .from(
          '.album-create-form__left .album-create-field',
          {
            autoAlpha: 0,
            y: 10,
            stagger: 0.04,
            duration: 0.32,
            clearProps: 'all'
          },
          '<0.04'
        )
        .from(
          '.album-create-private, .album-create-switch, .album-create-field--password',
          {
            autoAlpha: 0,
            y: 8,
            scale: 0.98,
            stagger: 0.035,
            duration: 0.28,
            clearProps: 'all'
          },
          '<0.08'
        )
        .from(
          '.album-create-form__right h3',
          {
            autoAlpha: 0,
            y: 10,
            duration: 0.3,
            clearProps: 'all'
          },
          '<0.02'
        )
        .from(
          '.album-create-upload',
          {
            autoAlpha: 0,
            y: 12,
            scale: 0.985,
            duration: 0.36,
            clearProps: 'all'
          },
          '<0.04'
        )
        .from(
          '.album-create-dialog__actions button',
          {
            autoAlpha: 0,
            y: 10,
            scale: 0.97,
            stagger: { each: 0.035, from: 'start' },
            duration: 0.28,
            // Naive UI keeps its theme variables in the inline style, so only clear what this tween set.
            clearProps: 'opacity,visibility,transform'
          },
          '<0.06'
        );

      if (notice.length > 0) {
        createDialogOpenTimeline.from(
          notice,
          {
            autoAlpha: 0,
            y: 8,
            duration: 0.24,
            clearProps: 'all'
          },
          '<0.08'
        );
      }

      if (uploadDecor.length > 0) {
        createDialogOpenTimeline.from(
          uploadDecor,
          {
            autoAlpha: 0,
            y: 12,
            scale: 0.96,
            stagger: 0.035,
            duration: 0.3,
            clearProps: 'all'
          },
          '<0.06'
        );
      }

      if (uploadQueueContent.length > 0) {
        createDialogOpenTimeline.from(
          uploadQueueContent,
          {
            autoAlpha: 0,
            y: 8,
            scale: 0.97,
            stagger: { each: 0.025, from: 'start' },
            duration: 0.26,
            clearProps: 'all'
          },
          '<0.04'
        );
      }
    }, backdrop);
  }

  function playCreateDialogClose() {
    const backdrop = createDialogBackdropRef.value;

    if (!backdrop || !createDialogRef.value || reducedMotion) {
      finishCreateDialogClose();
      return;
    }

    stopCreateDialogMotion();
    createDialogMotionContext = gsap.context(() => {
      createDialogCloseTimeline = slots.hold('createDialogCloseTimeline', gsap.timeline({
        defaults: {
          ease: 'power1.in',
          overwrite: 'auto'
        },
        onComplete: finishCreateDialogClose
      }));

      createDialogCloseTimeline
        .to(
          '.album-create-dialog__notice, .album-create-dialog__actions button, .album-upload-add, .album-upload-item, .album-upload-progress, .album-create-upload__content, .album-create-upload, .album-create-form__right h3, .album-create-switch, .album-create-private, .album-create-field',
          {
            autoAlpha: 0,
            y: 8,
            stagger: { each: 0.014, from: 'end' },
            duration: 0.16
          }
        )
        .to(
          '.album-create-dialog',
          {
            autoAlpha: 0,
            y: 18,
            scale: 0.982,
            rotation: 0.25,
            duration: 0.22
          },
          '<0.02'
        )
        .to(
          backdrop,
          { autoAlpha: 0, duration: 0.2 },
          '<0.04'
        );
    }, backdrop);
  }

  function openCreateDialog() {
    isCreateDialogClosing.value = false;
    isCreateDialogOpen.value = true;
  }

  function closeCreateDialog() {
    if (isCreateDialogClosing.value) {
      return;
    }

    clearDraftPendingState();

    if (reducedMotion) {
      finishCreateDialogClose();
      return;
    }

    isCreateDialogClosing.value = true;
    playCreateDialogClose();
  }

  function stopPhotoPreviewMotion() {
    slots.stop('photoPreviewEnterTimeline');
    slots.stop('photoPreviewLeaveTimeline');
    photoPreviewEnterTimeline = undefined;
    photoPreviewLeaveTimeline = undefined;
    photoPreviewMotionContext?.revert();
    photoPreviewMotionContext = undefined;
  }

  function playPhotoPreviewEnter(element: Element, done: () => void) {
    const backdrop = element as HTMLElement;

    if (reducedMotion) {
      done();
      return;
    }

    stopPhotoPreviewMotion();
    photoPreviewMotionContext = gsap.context(() => {
      const previewPanel =
        backdrop.querySelector<HTMLElement>('.album-photo-preview');
      const unlockPanel =
        backdrop.querySelector<HTMLElement>('.album-private-unlock');
      const panel = previewPanel ?? unlockPanel;
      const previewControls = Array.from(
        backdrop.querySelectorAll<HTMLElement>(
          '.album-photo-preview__close, .album-photo-preview__nav, .album-photo-preview__counter'
        )
      );
      const previewPaper = Array.from(
        backdrop.querySelectorAll<HTMLElement>(
          '.album-photo-preview__paper'
        )
      );
      const previewDetails = Array.from(
        backdrop.querySelectorAll<HTMLElement>(
          '.album-photo-preview__image, .album-photo-preview__meta > *'
        )
      );
      const unlockDetails = Array.from(
        backdrop.querySelectorAll<HTMLElement>(
          '.album-private-unlock > svg, .album-private-unlock h2, .album-private-unlock p, .album-private-unlock input, .album-private-unlock__submit'
        )
      );

      photoPreviewEnterTimeline = slots.hold('photoPreviewEnterTimeline', gsap.timeline({
        defaults: {
          ease: 'power3.out',
          overwrite: 'auto'
        },
        onComplete: () => {
          photoPreviewEnterTimeline = undefined;
          done();
        }
      }));

      photoPreviewEnterTimeline.fromTo(
        backdrop,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          duration: 0.2,
          clearProps: 'visibility'
        }
      );

      if (panel) {
        photoPreviewEnterTimeline.fromTo(
          panel,
          {
            autoAlpha: 0,
            y: 18,
            scale: 0.975,
            rotation: -0.35
          },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotation: 0,
            duration: 0.42,
            ease: 'back.out(1.12)',
            clearProps: 'opacity,transform,visibility'
          },
          '<0.02'
        );
      }

      if (previewPaper.length > 0) {
        photoPreviewEnterTimeline.from(
          previewPaper,
          {
            autoAlpha: 0,
            y: 12,
            scale: 0.982,
            rotation: -1.2,
            duration: 0.38,
            ease: 'back.out(1.16)',
            clearProps: 'all'
          },
          '<0.08'
        );
      }

      if (previewDetails.length > 0) {
        photoPreviewEnterTimeline.from(
          previewDetails,
          {
            autoAlpha: 0,
            y: 8,
            scale: 0.99,
            stagger: 0.035,
            duration: 0.26,
            clearProps: 'all'
          },
          '<0.08'
        );
      }

      if (previewControls.length > 0) {
        photoPreviewEnterTimeline.from(
          previewControls,
          {
            autoAlpha: 0,
            y: 10,
            scale: 0.88,
            stagger: { each: 0.035, from: 'center' },
            duration: 0.28,
            ease: 'back.out(1.45)',
            clearProps: 'all'
          },
          '<0.04'
        );
      }

      if (unlockDetails.length > 0) {
        photoPreviewEnterTimeline.from(
          unlockDetails,
          {
            autoAlpha: 0,
            y: 10,
            scale: 0.98,
            stagger: 0.035,
            duration: 0.28,
            clearProps: 'all'
          },
          '<0.06'
        );
      }
    }, backdrop);
  }

  function playPhotoPreviewLeave(element: Element, done: () => void) {
    const backdrop = element as HTMLElement;

    if (reducedMotion) {
      done();
      return;
    }

    stopPhotoPreviewMotion();
    photoPreviewMotionContext = gsap.context(() => {
      const panel = backdrop.querySelector<HTMLElement>(
        '.album-photo-preview, .album-private-unlock'
      );
      const previewControls = Array.from(
        backdrop.querySelectorAll<HTMLElement>(
          '.album-photo-preview__close, .album-photo-preview__nav, .album-photo-preview__counter'
        )
      );
      const leavingPaper = Array.from(
        backdrop.querySelectorAll<HTMLElement>(
          '.album-photo-preview__paper, .album-private-unlock'
        )
      );

      photoPreviewLeaveTimeline = slots.hold('photoPreviewLeaveTimeline', gsap.timeline({
        defaults: {
          ease: 'power1.in',
          overwrite: 'auto'
        },
        onComplete: () => {
          done();
          stopPhotoPreviewMotion();
        }
      }));

      if (previewControls.length > 0) {
        photoPreviewLeaveTimeline.to(previewControls, {
          autoAlpha: 0,
          y: 6,
          stagger: { each: 0.012, from: 'end' },
          duration: 0.14
        });
      }

      if (leavingPaper.length > 0) {
        photoPreviewLeaveTimeline.to(
          leavingPaper,
          {
            autoAlpha: 0,
            y: 12,
            scale: 0.982,
            duration: 0.18
          },
          '<0.02'
        );
      }

      if (panel) {
        photoPreviewLeaveTimeline.to(
          panel,
          {
            autoAlpha: 0,
            y: 16,
            scale: 0.976,
            duration: 0.2
          },
          '<0.02'
        );
      }

      photoPreviewLeaveTimeline.to(
        backdrop,
        { autoAlpha: 0, duration: 0.18 },
        '<0.04'
      );
    }, backdrop);
  }

  const previewTransitionHandlers = {
    css: false,
    onEnter: playPhotoPreviewEnter,
    onLeave: playPhotoPreviewLeave
  };

  onBeforeUnmount(() => {
    stopCreateDialogMotion();
    stopPhotoPreviewMotion();
  });

  return {
    createDialogBackdropRef,
    createDialogRef,
    isCreateDialogClosing,
    openCreateDialog,
    closeCreateDialog,
    previewTransitionHandlers
  };
}
