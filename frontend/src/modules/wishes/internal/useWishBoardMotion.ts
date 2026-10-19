import { nextTick, onBeforeUnmount, ref, type Ref } from 'vue';
import { gsap } from 'gsap';
import { shouldSkipMotion, useMotionSlots } from '../../../motion';
import type { WishLaneKey, WishLaneTransition } from '../model';

export interface WishBoardElements {
  wishPageRef: Ref<HTMLElement | null>;
  wishDetailBackdropRef: Ref<HTMLElement | null>;
  wishDetailDialogRef: Ref<HTMLElement | null>;
  wishDetailImageRef: Ref<HTMLImageElement | null>;
  imagePreviewRef: Ref<HTMLElement | null>;
  imagePreviewImageRef: Ref<HTMLImageElement | null>;
  completionBadgeRef: Ref<HTMLButtonElement | null>;
  createWishBackdropRef: Ref<HTMLElement | null>;
  createWishDialogRef: Ref<HTMLFormElement | null>;
}

const wishLaneMoveTweenDefaults = {
  autoRound: false,
  force3D: true,
  overwrite: 'auto'
} as const;

/**
 * The Wishes board choreography. It decides nothing: the view changes state through the wish lifecycle and
 * asks this module to animate changes that already happened (or, for a lane move, that `commit` makes).
 * Everything it starts is stopped when the owning component unmounts.
 */
export function useWishBoardMotion(elements: WishBoardElements) {
  const {
    wishPageRef,
    wishDetailBackdropRef,
    wishDetailDialogRef,
    wishDetailImageRef,
    imagePreviewRef,
    imagePreviewImageRef,
    completionBadgeRef,
    createWishBackdropRef,
    createWishDialogRef
  } = elements;
  const skip = shouldSkipMotion();
  const slots = useMotionSlots<'enter' | 'detail' | 'create' | 'preview' | 'stamp' | 'laneMove'>();
  const detailAnimating = ref(false);
  const imagePreviewAnimating = ref(false);
  let wishDetailTimeline: gsap.core.Timeline | undefined;
  let createWishTimeline: gsap.core.Timeline | undefined;
  let imagePreviewTimeline: gsap.core.Timeline | undefined;
  let wishLaneMoveTimeline: gsap.core.Timeline | undefined;
  let wishLaneMoveGhost: HTMLElement | null = null;
  let wishLaneMoveCleanupFrames: number[] = [];
  let hasPlayedWishBoardEnter = false;

  function laneList(lane: WishLaneKey) {
    return wishPageRef.value?.querySelector<HTMLElement>(
      `.wish-lane-list[data-wish-lane="${lane}"]`
    ) ?? null;
  }

  function enterBoard() {
    if (hasPlayedWishBoardEnter) {
      return;
    }

    slots.stop('enter');

    if (!wishPageRef.value) {
      return;
    }

    const hasRenderedList = wishPageRef.value.querySelector('.wish-board');
    if (!hasRenderedList) {
      return;
    }

    hasPlayedWishBoardEnter = true;

    slots.hold('enter', gsap.context(() => {
      const find = gsap.utils.selector(wishPageRef.value);
      const heroSheet = find('.list-hero__sheet');
      const heroBanner = find('.list-hero__banner');
      const heroCopy = find('.list-hero__label, .list-hero__title, .list-hero__subtitle');
      const noteCard = find('.list-note-card');
      const noteAsset = find('.list-note-card__asset');
      const noteLines = find('.list-note-card__title, .list-note-card__copy p:last-child');
      const boards = find('.wish-board');
      const boardAssets = find('.wish-board__asset');
      const boardContents = find('.wish-board__content');
      const rows = find('.wish-lane-item');
      const legendItems = find('.list-legend span');
      const createEntry = find('.wish-create-fab');
      const animatedTargets = [
        heroSheet,
        heroBanner,
        heroCopy,
        noteCard,
        noteAsset,
        noteLines,
        boards,
        boardAssets,
        boardContents,
        rows,
        legendItems,
        createEntry
      ].flat();

      if (skip) {
        gsap.set(animatedTargets, { clearProps: 'all' });
        return;
      }

      const timeline = gsap.timeline({
        defaults: {
          ease: 'power3.out',
          overwrite: 'auto'
        },
        onComplete: () => {
          gsap.set(animatedTargets, { clearProps: 'transform,opacity,visibility' });
          gsap.set(animatedTargets, { clearProps: 'willChange' });
        }
      });

      timeline
        .from(
          heroSheet,
          {
            autoAlpha: 0,
            y: 18,
            scale: 0.985,
            rotate: -0.8,
            duration: 0.5,
            willChange: 'transform, opacity'
          },
          0
        )
        .from(
          heroBanner,
          {
            autoAlpha: 0,
            scale: 1.018,
            duration: 0.42,
            willChange: 'transform, opacity'
          },
          0.04
        )
        .from(
          heroCopy,
          {
            autoAlpha: 0,
            y: 12,
            duration: 0.34,
            stagger: 0.055,
            willChange: 'transform, opacity'
          },
          0.14
        )
        .from(
          noteCard,
          {
            autoAlpha: 0,
            y: 22,
            scale: 0.96,
            rotate: 2.4,
            duration: 0.5,
            ease: 'back.out(1.22)',
            willChange: 'transform, opacity'
          },
          0.18
        )
        .from(
          noteAsset,
          {
            autoAlpha: 0,
            scale: 0.94,
            rotate: -2,
            duration: 0.42,
            willChange: 'transform, opacity'
          },
          '<0.08'
        )
        .from(
          noteLines,
          {
            autoAlpha: 0,
            y: 8,
            duration: 0.28,
            stagger: 0.05,
            willChange: 'transform, opacity'
          },
          '<0.08'
        )
        .from(
          boards,
          {
            autoAlpha: 0,
            y: 34,
            scale: 0.94,
            rotate: (index) => [-2.1, 1.6, -1.1][index % 3],
            duration: 0.56,
            stagger: 0.1,
            ease: 'back.out(1.45)',
            willChange: 'transform, opacity'
          },
          0.14
        )
        .from(
          boardAssets,
          {
            autoAlpha: 0,
            y: 14,
            scale: 0.975,
            rotate: (index) => [-0.8, 0.6, -0.4][index % 3],
            duration: 0.44,
            stagger: 0.08,
            willChange: 'transform, opacity'
          },
          0.24
        )
        .from(
          boardContents,
          {
            autoAlpha: 0,
            y: 12,
            scale: 0.985,
            duration: 0.34,
            stagger: 0.075,
            willChange: 'transform, opacity'
          },
          0.34
        )
        .from(
          rows,
          {
            autoAlpha: 0,
            y: 10,
            scale: 0.98,
            duration: 0.22,
            stagger: {
              amount: 0.22,
              from: 'start'
            },
            ease: 'power2.out'
          },
          0.44
        )
        .from(
          legendItems,
          {
            autoAlpha: 0,
            y: 8,
            duration: 0.24,
            stagger: 0.035,
            willChange: 'transform, opacity'
          },
          0.52
        );

      if (createEntry.length > 0) {
        timeline.from(
          createEntry,
          {
            autoAlpha: 0,
            y: 26,
            scale: 0.84,
            rotate: -8,
            duration: 0.44,
            ease: 'back.out(1.45)',
            clearProps: 'transform,opacity,visibility',
            willChange: 'transform, opacity'
          },
          0.62
        );
      }
    }, wishPageRef.value));
  }

  function getWishLaneItem(wishId: number) {
    return wishPageRef.value?.querySelector<HTMLElement>(`[data-wish-id="${wishId}"]`) ?? null;
  }

  function getWishLaneItems(laneKey: WishLaneKey) {
    const list = laneList(laneKey);

    return Array.from(list?.querySelectorAll<HTMLElement>('[data-wish-id]') ?? []);
  }

  function getWishIdFromItem(item: HTMLElement) {
    const id = Number(item.dataset.wishId);

    return Number.isFinite(id) ? id : null;
  }

  function snapshotRows(rows: HTMLElement[]) {
    const snapshots = new Map<number, DOMRect>();

    rows.forEach((row) => {
      const id = getWishIdFromItem(row);

      if (id !== null) {
        snapshots.set(id, row.getBoundingClientRect());
      }
    });

    return snapshots;
  }

  function setRowsFromSnapshots(rows: HTMLElement[], snapshots: Map<number, DOMRect>) {
    return rows.filter((row) => {
      const id = getWishIdFromItem(row);
      const previousRect = id === null ? undefined : snapshots.get(id);

      if (!previousRect) {
        return false;
      }

      const currentRect = row.getBoundingClientRect();
      const offsetY = previousRect.top - currentRect.top;

      if (Math.abs(offsetY) > 0.5) {
        prepareWishLaneMoveStyles([row]);
        gsap.set(row, { y: offsetY });
      }

      return true;
    });
  }

  function getWishLaneItemTilt(row: HTMLElement) {
    const tilt = Number.parseFloat(
      getComputedStyle(row).getPropertyValue('--wish-lane-item-tilt') || '-0.12'
    );

    return Number.isFinite(tilt) ? tilt : -0.12;
  }

  function prepareWishLaneMoveStyles(rows: HTMLElement[]) {
    if (rows.length === 0) {
      return;
    }

    rows.forEach((row) => {
      gsap.set(row, {
        transition: 'none',
        willChange: 'transform, opacity',
        rotation: getWishLaneItemTilt(row),
        force3D: true
      });
    });
  }

  function clearWishLaneMoveStyles(rows: HTMLElement[]) {
    if (rows.length === 0) {
      return;
    }

    gsap.set(rows, { clearProps: 'transform,opacity,visibility' });
    scheduleWishLaneTransitionRestore(rows);
  }

  function scheduleWishLaneTransitionRestore(rows: HTMLElement[]) {
    const paintFrame = requestAnimationFrame(() => {
      wishLaneMoveCleanupFrames = wishLaneMoveCleanupFrames.filter((frameId) => frameId !== paintFrame);

      const restoreFrame = requestAnimationFrame(() => {
        wishLaneMoveCleanupFrames = wishLaneMoveCleanupFrames.filter((frameId) => frameId !== restoreFrame);
        gsap.set(rows, { clearProps: 'transition,willChange' });
      });

      wishLaneMoveCleanupFrames.push(restoreFrame);
    });

    wishLaneMoveCleanupFrames.push(paintFrame);
  }

  function scheduleWishLaneMoveGhostRemoval(onRemoved?: () => void) {
    const paintFrame = requestAnimationFrame(() => {
      wishLaneMoveCleanupFrames = wishLaneMoveCleanupFrames.filter((frameId) => frameId !== paintFrame);
      removeWishLaneMoveGhost();
      onRemoved?.();
    });

    wishLaneMoveCleanupFrames.push(paintFrame);
  }

  function removeWishLaneMoveGhost() {
    if (!wishLaneMoveGhost) {
      return;
    }

    gsap.killTweensOf(wishLaneMoveGhost);
    wishLaneMoveGhost.remove();
    wishLaneMoveGhost = null;
  }

  function createWishLaneMoveGhost(sourceRow: HTMLElement) {
    const sourceRect = sourceRow.getBoundingClientRect();
    const ghost = sourceRow.cloneNode(true) as HTMLElement;

    removeWishLaneMoveGhost();
    ghost.classList.add('wish-lane-move-ghost');
    ghost.removeAttribute('data-wish-id');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.tabIndex = -1;
    Object.assign(ghost.style, {
      left: `${sourceRect.left}px`,
      top: `${sourceRect.top}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`
    });

    wishPageRef.value?.appendChild(ghost);
    wishLaneMoveGhost = ghost;

    gsap.set(ghost, {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      autoAlpha: 1,
      transition: 'none',
      willChange: 'transform, opacity',
      rotation: getWishLaneItemTilt(sourceRow),
      transformOrigin: '50% 50%',
      force3D: true
    });

    return { ghost, sourceRect };
  }

  function openDetail() {
    const backdrop = wishDetailBackdropRef.value;
    const dialog = wishDetailDialogRef.value;

    if (!backdrop || !dialog) {
      return Promise.resolve();
    }

    slots.stop('detail');

    if (skip) {
      gsap.set(backdrop, { autoAlpha: 1, clearProps: 'transform' });
      gsap.set(dialog, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotate: 0 });
      return Promise.resolve();
    }

    detailAnimating.value = true;

    return new Promise<void>((resolve) => {
      const finish = () => {
        detailAnimating.value = false;
        resolve();
      };
      wishDetailTimeline = slots.hold('detail', gsap
        .timeline({
          onComplete: finish,
          onInterrupt: finish
        })
        .set(backdrop, { autoAlpha: 0 })
        .set(dialog, { autoAlpha: 0, y: 20, scale: 0.94, rotate: -0.7, transformOrigin: '50% 56%' })
        .to(backdrop, { autoAlpha: 1, duration: 0.24, ease: 'power2.out' }, 0)
        .to(dialog, { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 0.32, ease: 'back.out(1.55)' }, 0.02));
    });
  }

  function closeDetail() {
    const backdrop = wishDetailBackdropRef.value;
    const dialog = wishDetailDialogRef.value;

    if (!backdrop || !dialog || skip) {
      return Promise.resolve();
    }

    slots.stop('detail');

    return new Promise<void>((resolve) => {
      wishDetailTimeline = slots.hold('detail', gsap
        .timeline({ onComplete: resolve, onInterrupt: resolve })
        .to(dialog, { autoAlpha: 0, y: 16, scale: 0.96, rotate: 0.4, duration: 0.26, ease: 'power2.inOut' }, 0)
        .to(backdrop, { autoAlpha: 0, duration: 0.26, ease: 'power2.inOut' }, 0));
    });
  }

  function openCreate() {
    const backdrop = createWishBackdropRef.value;
    const dialog = createWishDialogRef.value;

    if (!backdrop || !dialog) {
      return Promise.resolve();
    }

    const background = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-dialog__background'));
    const content = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-dialog__content'));
    const fields = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-field'));
    const categoryButtons = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-dialog__category button'));
    const divider = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-dialog__divider'));
    const actions = Array.from(dialog.querySelectorAll<HTMLElement>('.wish-create-dialog__actions button'));
    const animatedTargets = [dialog, ...background, ...content, ...fields, ...categoryButtons, ...divider, ...actions];
    slots.stop('create');

    if (skip) {
      gsap.set(backdrop, { autoAlpha: 1, clearProps: 'transform' });
      gsap.set(dialog, { autoAlpha: 1, x: 0, y: 0, scale: 1, rotate: 0 });
      gsap.set(fields, { autoAlpha: 1, y: 0 });
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const finish = () => {
        gsap.set([backdrop, dialog], { clearProps: 'willChange' });
        gsap.set(animatedTargets, { clearProps: 'willChange' });
        resolve();
      };
      createWishTimeline = slots.hold('create', gsap
        .timeline({
          defaults: { ease: 'power2.out' },
          onComplete: finish,
          onInterrupt: finish
        })
        .set(backdrop, { autoAlpha: 0 })
        .set(dialog, {
          autoAlpha: 0,
          y: 28,
          scale: 0.965,
          rotate: -0.45,
          transformOrigin: '50% 46%',
          willChange: 'transform, opacity'
        })
        .set(background, { autoAlpha: 0, scale: 1.016, willChange: 'transform, opacity' })
        .set(content, { autoAlpha: 0, y: 12, willChange: 'transform, opacity' })
        .set(fields, { autoAlpha: 0, y: 10, willChange: 'transform, opacity' })
        .set(categoryButtons, { autoAlpha: 0, y: 6, scale: 0.96, willChange: 'transform, opacity' })
        .set(divider, { autoAlpha: 0, scaleY: 0.72, transformOrigin: 'center center', willChange: 'transform, opacity' })
        .set(actions, { autoAlpha: 0, y: 12, scale: 0.98, willChange: 'transform, opacity' })
        .to(backdrop, { autoAlpha: 1, duration: 0.22, ease: 'power2.out' }, 0)
        .to(dialog, { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 0.42, ease: 'back.out(1.25)' }, 0.02)
        .to(background, { autoAlpha: 1, scale: 1, duration: 0.34, ease: 'power2.out' }, 0.08)
        .to(content, { autoAlpha: 1, y: 0, duration: 0.28, ease: 'power3.out' }, 0.13)
        .to(divider, { autoAlpha: 1, scaleY: 1, duration: 0.24, ease: 'power2.out' }, 0.18)
        .to(fields, { autoAlpha: 1, y: 0, duration: 0.24, stagger: 0.035, ease: 'power2.out' }, 0.19)
        .to(
          categoryButtons,
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.22, stagger: { each: 0.03, from: 'start' }, ease: 'back.out(1.35)' },
          0.21
        )
        .to(
          actions,
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.25, stagger: { each: 0.03, from: 'start' }, ease: 'power2.out' },
          0.34
        ));
    });
  }

  function closeCreate() {
    const backdrop = createWishBackdropRef.value;
    const dialog = createWishDialogRef.value;

    if (!backdrop || !dialog || skip) {
      return Promise.resolve();
    }

    slots.stop('create');
    const closingItems = Array.from(
      dialog.querySelectorAll<HTMLElement>('.wish-create-field, .wish-create-dialog__category button, .wish-create-dialog__actions button')
    );

    return new Promise<void>((resolve) => {
      const finish = () => {
        gsap.set([backdrop, dialog, ...closingItems], { clearProps: 'transform,opacity,visibility' });
        gsap.set([backdrop, dialog, ...closingItems], { clearProps: 'willChange' });
        resolve();
      };
      createWishTimeline = slots.hold('create', gsap
        .timeline({
          onComplete: finish,
          onInterrupt: finish
        })
        .set(dialog, { willChange: 'transform, opacity' })
        .to(
          closingItems,
          { autoAlpha: 0, y: -6, duration: 0.14, stagger: { each: 0.012, from: 'end' }, ease: 'power1.in' },
          0
        )
        .to(dialog, { autoAlpha: 0, y: -14, scale: 0.982, rotate: 0.35, duration: 0.22, ease: 'power2.inOut' }, 0.04)
        .to(backdrop, { autoAlpha: 0, duration: 0.22, ease: 'power2.inOut' }, 0));
    });
  }

  function openImagePreview(sourceRect: DOMRect | null) {
    const preview = imagePreviewRef.value;
    const image = imagePreviewImageRef.value;

    if (!preview || !image) {
      return Promise.resolve();
    }

    slots.stop('preview');

    if (skip) {
      gsap.set(preview, { autoAlpha: 1 });
      gsap.set(image, { autoAlpha: 1, x: 0, y: 0, scale: 1 });
      return Promise.resolve();
    }

    const targetRect = image.getBoundingClientRect();
    const hasSourceRect = Boolean(sourceRect && targetRect.width > 0 && targetRect.height > 0);
    const sourceLeft = sourceRect?.left ?? targetRect.left;
    const sourceTop = sourceRect?.top ?? targetRect.top;
    const sourceWidth = sourceRect?.width ?? targetRect.width;
    const sourceHeight = sourceRect?.height ?? targetRect.height;

    imagePreviewAnimating.value = true;

    return new Promise<void>((resolve) => {
      const finish = () => {
        imagePreviewAnimating.value = false;
        resolve();
      };
      imagePreviewTimeline = slots.hold('preview', gsap
        .timeline({
          onComplete: finish,
          onInterrupt: finish
        })
        .set(preview, { autoAlpha: 0 })
        .set(image, {
          autoAlpha: hasSourceRect ? 0.92 : 0,
          x: hasSourceRect ? sourceLeft - targetRect.left : 0,
          y: hasSourceRect ? sourceTop - targetRect.top : 10,
          scaleX: hasSourceRect ? sourceWidth / targetRect.width : 0.94,
          scaleY: hasSourceRect ? sourceHeight / targetRect.height : 0.94,
          transformOrigin: 'top left'
        })
        .to(preview, { autoAlpha: 1, duration: 0.2, ease: 'power2.out' }, 0)
        .to(image, { autoAlpha: 1, x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.42, ease: 'power3.out' }, 0.03));
    });
  }

  function closeImagePreview() {
    const preview = imagePreviewRef.value;
    const image = imagePreviewImageRef.value;

    if (!preview || !image || skip) {
      return Promise.resolve();
    }

    slots.stop('preview');
    const sourceRect = wishDetailImageRef.value?.getBoundingClientRect() ?? null;
    const targetRect = image.getBoundingClientRect();
    const hasSourceRect = Boolean(sourceRect && targetRect.width > 0 && targetRect.height > 0);
    const sourceLeft = sourceRect?.left ?? targetRect.left;
    const sourceTop = sourceRect?.top ?? targetRect.top;
    const sourceWidth = sourceRect?.width ?? targetRect.width;
    const sourceHeight = sourceRect?.height ?? targetRect.height;

    imagePreviewAnimating.value = true;

    return new Promise<void>((resolve) => {
      const finish = () => {
        imagePreviewAnimating.value = false;
        resolve();
      };
      imagePreviewTimeline = slots.hold('preview', gsap
        .timeline({
          onComplete: finish,
          onInterrupt: finish
        })
        .to(
          image,
          {
            autoAlpha: 0.35,
            x: hasSourceRect ? sourceLeft - targetRect.left : 0,
            y: hasSourceRect ? sourceTop - targetRect.top : 10,
            scaleX: hasSourceRect ? sourceWidth / targetRect.width : 0.96,
            scaleY: hasSourceRect ? sourceHeight / targetRect.height : 0.96,
            duration: 0.28,
            ease: 'power2.inOut'
          },
          0
        )
        .to(preview, { autoAlpha: 0, duration: 0.24, ease: 'power2.inOut' }, 0.04));
    });
  }

  function stampCompletion() {
    const badge = completionBadgeRef.value;
    if (!badge || skip) {
      return Promise.resolve();
    }

    const host = badge.parentElement;
    if (!host) {
      return Promise.resolve();
    }

    const wave = document.createElement('span');
    wave.className = 'wish-completion-wave';
    host.appendChild(wave);

    const particles = Array.from({ length: 12 }, (_, index) => {
      const particle = document.createElement('span');
      particle.className = 'wish-completion-particle';
      particle.style.setProperty('--particle-hue', index % 2 === 0 ? 'var(--list-gold)' : 'var(--list-red)');
      host.appendChild(particle);
      return particle;
    });

    return new Promise<void>((resolve) => {
      const finish = () => {
        wave.remove();
        particles.forEach((particle) => particle.remove());
        resolve();
      };
      const timeline = slots.hold('stamp', gsap.timeline({ onComplete: finish, onInterrupt: finish }));

      timeline
        .to(badge, { y: 9, scale: 0.82, rotate: -10, duration: 0.08, ease: 'power2.in' }, 0)
        .to(badge, { y: -6, scale: 1.18, rotate: -4, duration: 0.16, ease: 'back.out(2.4)' }, 0.08)
        .to(badge, { y: 0, scale: 1, rotate: -7, duration: 0.22, ease: 'elastic.out(1, 0.46)' }, 0.24)
        .fromTo(
          wave,
          { autoAlpha: 0.58, scale: 0.42 },
          { autoAlpha: 0, scale: 1.75, duration: 0.42, ease: 'power2.out' },
          0.12
        )
        .to(wishDetailDialogRef.value, { x: 3, duration: 0.04, yoyo: true, repeat: 3, ease: 'power1.inOut' }, 0.12);

      particles.forEach((particle, index) => {
        const angle = (Math.PI * 2 * index) / particles.length - Math.PI / 2;
        const distance = 28 + (index % 4) * 8;
        timeline.fromTo(
          particle,
          { autoAlpha: 1, x: 0, y: 0, scale: 0.4, rotate: 0 },
          {
            autoAlpha: 0,
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            scale: 1,
            rotate: index % 2 === 0 ? 120 : -120,
            duration: 0.48,
            ease: 'power2.out'
          },
          0.14 + index * 0.008
        );
      });
    });
  }

  async function moveWish(transition: WishLaneTransition, commit: () => boolean) {
    const sourceRows = getWishLaneItems(transition.fromLane);
    const sourceIndex = sourceRows.findIndex((row) => getWishIdFromItem(row) === transition.wishId);
    if (sourceIndex < 0 || transition.fromLane === transition.toLane || skip) {
      commit();
      await nextTick();
      return;
    }

    const targetRows = getWishLaneItems(transition.toLane);
    const sourceRow = getWishLaneItem(transition.wishId);
    const sourceFollowerSnapshots = snapshotRows(sourceRows.slice(sourceIndex + 1));
    const targetSnapshots = snapshotRows(targetRows);

    slots.stop('laneMove');
    const ghostMove = sourceRow ? createWishLaneMoveGhost(sourceRow) : null;

    if (sourceRow) {
      sourceRow.style.visibility = 'hidden';
    }

    const didMove = commit();

    if (!didMove) {
      if (sourceRow) {
        sourceRow.style.visibility = '';
      }

      removeWishLaneMoveGhost();
      return;
    }

    await nextTick();

    const updatedSourceRows = setRowsFromSnapshots(
      getWishLaneItems(transition.fromLane),
      sourceFollowerSnapshots
    );
    const updatedTargetRows = getWishLaneItems(transition.toLane);
    const shiftedTargetRows = setRowsFromSnapshots(
      updatedTargetRows.filter(
        (row) => getWishIdFromItem(row) !== transition.wishId
      ),
      targetSnapshots
    );
    const movedRow = getWishLaneItem(transition.wishId);
    const targetRect = movedRow?.getBoundingClientRect() ?? null;
    const animatedRows = [...updatedSourceRows, ...shiftedTargetRows];

    if (movedRow) {
      movedRow.style.visibility = 'hidden';
    }

    prepareWishLaneMoveStyles(animatedRows);

    await new Promise<void>((resolve) => {
      const revealMovedRow = () => {
        if (movedRow) {
          movedRow.style.visibility = '';
        }
      };

      wishLaneMoveTimeline = slots.hold('laneMove', gsap.timeline({
        defaults: wishLaneMoveTweenDefaults,
        onComplete: () => {
          revealMovedRow();
          clearWishLaneMoveStyles(animatedRows);
          scheduleWishLaneMoveGhostRemoval(resolve);
        }
      }));

      const rowsToSettle = [...updatedSourceRows, ...shiftedTargetRows];
      let hasTween = false;

      if (rowsToSettle.length > 0) {
        hasTween = true;
        wishLaneMoveTimeline.to(
          rowsToSettle,
          {
            y: 0,
            duration: 0.32,
            ease: 'power1.in'
          },
          0
        );
      }

      if (ghostMove && targetRect) {
        const { ghost, sourceRect } = ghostMove;

        hasTween = true;
        wishLaneMoveTimeline.to(
          ghost,
          {
            x: targetRect.left - sourceRect.left,
            y: targetRect.top - sourceRect.top,
            scaleX: targetRect.width / sourceRect.width,
            scaleY: targetRect.height / sourceRect.height,
            duration: 0.46,
            ease: 'power1.in'
          },
          0
        );
      }

      if (!hasTween) {
        revealMovedRow();
        removeWishLaneMoveGhost();
        resolve();
      }
    });
  }

  onBeforeUnmount(() => {
    wishLaneMoveCleanupFrames.forEach((frame) => cancelAnimationFrame(frame));
    wishLaneMoveCleanupFrames = [];
    removeWishLaneMoveGhost();
  });

  return {
    animated: !skip,
    detailAnimating,
    imagePreviewAnimating,
    laneList,
    enterBoard,
    openDetail,
    closeDetail,
    openCreate,
    closeCreate,
    openImagePreview,
    closeImagePreview,
    stampCompletion,
    moveWish
  };
}
