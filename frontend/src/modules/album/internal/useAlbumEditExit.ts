import { onBeforeUnmount, onMounted } from 'vue';

export function useAlbumEditExit(cancel: () => void) {
  onMounted(() => window.addEventListener('beforeunload', cancel));
  onBeforeUnmount(() => { window.removeEventListener('beforeunload', cancel); cancel(); });
}
