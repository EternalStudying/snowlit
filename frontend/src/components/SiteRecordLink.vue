<script setup lang="ts">
import { ExternalLink, Landmark } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    variant?: 'paper' | 'night';
  }>(),
  {
    variant: 'paper'
  }
);

const recordNumber = '湘ICP备2026020612号';
const recordUrl = 'https://beian.miit.gov.cn/#/Integrated/index';
</script>

<template>
  <a
    class="site-record-link"
    :class="`site-record-link--${variant}`"
    :href="recordUrl"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="`${recordNumber}，在新标签页打开工信部备案管理系统`"
  >
    <span class="site-record-link__icon" aria-hidden="true">
      <Landmark :size="15" :stroke-width="1.9" />
    </span>
    <span class="site-record-link__text">{{ recordNumber }}</span>
    <ExternalLink class="site-record-link__external" :size="13" :stroke-width="1.8" aria-hidden="true" />
  </a>
</template>
