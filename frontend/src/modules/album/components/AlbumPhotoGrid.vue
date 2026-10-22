<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Sortable from 'sortablejs';

const props = defineProps<{
  items: { key: string; src: string; caption?: string; status: string; message: string; itemId?: string }[];
  disabled: boolean;
}>();
const emit = defineEmits<{ reorder: [from: number, to: number]; remove: [index: number]; retry: [item: {id: string}] }>();
const root = ref<HTMLElement>();
let sortable: Sortable;
onMounted(() => {
  sortable = new Sortable(root.value!, {
    animation: 150, draggable: '.album-photo-grid__item', handle: '.album-photo-grid__image',
    delay: 180, delayOnTouchOnly: true, disabled: props.disabled,
    onEnd(event) {
      const from = event.oldIndex!; const to = event.newIndex!;
      // Restore Vue's DOM order before it applies the reordered keyed array.
      if (from !== to) {
        event.from.removeChild(event.item);
        event.from.insertBefore(event.item, event.from.children[from] ?? null);
        emit('reorder', from, to);
      }
    }
  });
});
watch(() => props.disabled, value => sortable?.option('disabled', value));
onBeforeUnmount(() => sortable.destroy());
</script>

<template>
  <ul ref="root" class="album-photo-grid" aria-label="相册照片顺序">
    <li v-for="(item, index) in items" :key="item.key" class="album-photo-grid__item" :data-photo-key="item.key" :data-upload-status="item.status">
      <img class="album-photo-grid__image" :src="item.src" :alt="item.caption || '未命名照片'" draggable="false" />
      <span v-if="index === 0" class="album-photo-grid__cover">封面</span>
      <span class="album-photo-grid__caption">{{ item.caption || '未命名照片' }}</span>
      <small data-album-upload-status>{{ item.message }}</small>
      <div class="album-photo-grid__actions">
        <button v-if="index > 0" type="button" :disabled="disabled" @click="emit('reorder', index, 0)">设为封面</button>
        <button type="button" :disabled="disabled || item.status === 'generating' || item.status === 'uploading'" @click="emit('remove', index)">移除</button>
        <button v-if="item.status === 'failed' && item.itemId" type="button" @click="emit('retry', {id:item.itemId})">重试上传</button>
      </div>
    </li>
  </ul>
</template>
