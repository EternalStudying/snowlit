<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { NSpin } from 'naive-ui';

const props = withDefaults(
  defineProps<{
    loading?: boolean;
  }>(),
  {
    loading: true
  }
);

const isVisible = ref(props.loading);
const isComplete = ref(false);
let completeTimer: ReturnType<typeof setTimeout> | undefined;

function clearCompleteTimer() {
  if (completeTimer) {
    clearTimeout(completeTimer);
    completeTimer = undefined;
  }
}

watch(
  () => props.loading,
  (loading) => {
    clearCompleteTimer();

    if (loading) {
      isVisible.value = true;
      isComplete.value = false;
      return;
    }

    if (!isVisible.value) {
      return;
    }

    isComplete.value = true;
    completeTimer = setTimeout(() => {
      isVisible.value = false;
      completeTimer = undefined;
    }, 540);
  },
  { immediate: true }
);

onBeforeUnmount(clearCompleteTimer);
</script>

<template>
  <div
    v-if="isVisible"
    class="page-loader"
    :class="{ 'page-loader--complete': isComplete }"
    role="status"
    aria-label="页面数据加载中"
  >
    <div class="page-loader__progress" role="progressbar" aria-label="页面加载进度">
      <span class="page-loader__progress-bar"></span>
    </div>
    <NSpin class="page-loader__spinner" aria-hidden="true" :size="26" />
  </div>
</template>
