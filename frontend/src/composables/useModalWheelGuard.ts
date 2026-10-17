import { onBeforeUnmount, watch, type Ref } from 'vue';

const wheelGuardOptions: AddEventListenerOptions = { capture: true, passive: false };
const wheelGuardRemoveOptions: EventListenerOptions = { capture: true };

export function useModalWheelGuard(isActive: Ref<boolean>) {
  let listening = false;

  function start() {
    if (listening || typeof window === 'undefined') {
      return;
    }

    window.addEventListener('wheel', handleWheel, wheelGuardOptions);
    window.addEventListener('touchmove', handleTouchMove, wheelGuardOptions);
    listening = true;
  }

  function stop() {
    if (!listening || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('wheel', handleWheel, wheelGuardRemoveOptions);
    window.removeEventListener('touchmove', handleTouchMove, wheelGuardRemoveOptions);
    listening = false;
  }

  function handleWheel(event: WheelEvent) {
    if (!canScrollLocalTarget(event)) {
      event.preventDefault();
    }
  }

  function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
  }

  watch(isActive, (active) => (active ? start() : stop()), { immediate: true });
  onBeforeUnmount(stop);
}

function canScrollLocalTarget(event: WheelEvent) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  let current: Element | null = target;
  while (current && current !== document.body && current !== document.documentElement) {
    if (canScrollElement(current as HTMLElement, event.deltaY)) {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

function canScrollElement(element: HTMLElement, deltaY: number) {
  const style = window.getComputedStyle(element);
  if (!/(auto|scroll|overlay)/.test(style.overflowY)) {
    return false;
  }

  const maxScrollTop = element.scrollHeight - element.clientHeight;
  if (maxScrollTop <= 1) {
    return false;
  }

  return deltaY < 0 ? element.scrollTop > 0 : element.scrollTop < maxScrollTop - 1;
}
