<script setup lang="ts">
import { errorMessage } from '../../../display';
import { IMAGE_ACCEPT, pickImages } from '../../../imageFiles';
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { gsap } from 'gsap';
import { isInstantMotion, prefersReducedMotion, shouldSkipMotion, useMotionSlots } from '../../../motion';
import { CalendarDays, Coffee, Gift, Heart, ImagePlus, Loader2, Luggage, MapPin, Pencil, Star, Trash2 } from 'lucide-vue-next';
import { NAlert, NButton, NDatePicker, NInput, NUpload, type UploadFileInfo } from 'naive-ui';
import {
  STORY_CATEGORY_LABELS,
  STORY_CATEGORY_OPTIONS,
  type StoryCategory,
  type StoryDraftLocation,
  type StoryMoment,
  type StoryMomentInput
} from '../model';
import {
  getLoadedAmapSdk,
  searchAmapLocations,
  type AMapLocationSuggestion as LocationSuggestion
} from '../internal/amapSdk';

const props = defineProps<{
  open: boolean;
  mode: 'create' | 'edit';
  moment: StoryMoment | null;
  draftLocation: StoryDraftLocation | null;
  saving: boolean;
  error: string;
  uploadImage: (file: File) => Promise<string>;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'save', input: StoryMomentInput): void;
  (event: 'location-change', location: StoryDraftLocation): void;
}>();

const form = reactive({
  title: '',
  content: '',
  eventTime: '',
  endTime: '',
  locationName: '',
  address: '',
  longitude: '',
  latitude: '',
  category: 'daily' as StoryCategory,
  images: [] as string[]
});

const localError = ref('');
const isUploading = ref(false);
const imageFileList = ref<UploadFileInfo[]>([]);
const locationSuggestions = ref<LocationSuggestion[]>([]);
const locationStatus = ref('');
const isSearchingLocation = ref(false);
const isEditorRendered = ref(props.open);
const editorRoot = ref<HTMLFormElement | null>(null);
let locationSearchTimer: ReturnType<typeof window.setTimeout> | null = null;
let editorContext: gsap.Context | undefined;
let editorOpenTl: gsap.core.Timeline | undefined;
let editorCloseTl: gsap.core.Timeline | undefined;
const slots = useMotionSlots<'editorContext' | 'editorOpenTl' | 'editorCloseTl'>();

const categoryOptions = computed(() =>
  STORY_CATEGORY_OPTIONS.filter((option): option is { key: StoryCategory; label: string } => option.key !== 'all')
);
const canAddImage = computed(() => form.images.length < 3 && !isUploading.value);
const contentLength = computed(() => form.content.length);
const photoSlots = computed(() => Array.from({ length: 3 }, (_, index) => ({ index, image: form.images[index] ?? '' })));
const editorPositionStyle = computed(() => {
  const viewportWidth = window.innerWidth || 1024;
  const viewportHeight = window.innerHeight || 768;
  const width = Math.min(500, viewportWidth - 16, (viewportHeight - 24) * (1024 / 1536));

  return {
    '--moment-editor-left': `${viewportWidth / 2}px`,
    '--moment-editor-top': `${viewportHeight / 2}px`,
    '--moment-editor-width': `${width}px`
  };
});
const categoryIconMap = {
  daily: Coffee,
  date: Heart,
  travel: Luggage,
  anniversary: Gift,
  surprise: Star
} as const;

watch(
  () => [props.open, props.mode, props.moment?.id] as const,
  () => {
    if (!props.open) {
      return;
    }
    resetForm();
  },
  { immediate: true }
);

watch(
  () => props.open,
  async (open) => {
    if (open) {
      isEditorRendered.value = true;
      await nextTick();
      playEditorOpen();
      return;
    }
    playEditorClose();
  },
  { immediate: true, flush: 'post' }
);

watch(
  () => props.draftLocation,
  (location) => {
    if (!props.open || !location) {
      return;
    }
    applyLocation(location);
  }
);

onBeforeUnmount(() => {
  if (locationSearchTimer) {
    window.clearTimeout(locationSearchTimer);
  }
});

function resetForm() {
  const moment = props.moment;
  localError.value = '';
  locationSuggestions.value = [];
  locationStatus.value = '';

  const initialEventTime = moment?.eventTime ?? new Date().toISOString();

  form.title = moment?.title ?? '';
  form.content = moment?.content ?? '';
  form.eventTime = toDateInput(initialEventTime);
  form.endTime = toDateInput(moment?.endTime || initialEventTime);
  form.locationName = moment?.locationName ?? '';
  form.address = moment?.address ?? '';
  form.longitude = typeof moment?.longitude === 'number' ? String(moment.longitude) : '';
  form.latitude = typeof moment?.latitude === 'number' ? String(moment.latitude) : '';
  form.category = moment?.category ?? 'daily';
  form.images = [...(moment?.images ?? [])].slice(0, 3);

  if (!moment && props.draftLocation) {
    applyLocation(props.draftLocation);
  }
}

function toDateInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeEventTime(value: string) {
  if (value.length === 10) {
    return `${value}T00:00:00`;
  }
  return value.length === 16 ? `${value}:00` : value;
}

function applyLocation(location: StoryDraftLocation) {
  form.locationName = location.locationName;
  form.address = location.address;
  form.longitude = String(Number(location.longitude.toFixed(6)));
  form.latitude = String(Number(location.latitude.toFixed(6)));
  locationSuggestions.value = [];
  locationStatus.value = '';
}

function clearLocationSearchTimer() {
  if (!locationSearchTimer) {
    return;
  }
  window.clearTimeout(locationSearchTimer);
  locationSearchTimer = null;
}

function validateInput(): StoryMomentInput | null {
  localError.value = '';
  const longitude = Number(form.longitude);
  const latitude = Number(form.latitude);

  if (!form.title.trim()) {
    localError.value = '请填写点滴标题';
    return null;
  }
  if (!form.eventTime) {
    localError.value = '请选择开始日期';
    return null;
  }
  if (!form.locationName.trim() || !form.longitude.trim() || !form.latitude.trim() || !Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
    localError.value = '请先点击地图或搜索地点';
    return null;
  }

  return {
    title: form.title.trim(),
    content: form.content.trim(),
    eventTime: normalizeEventTime(form.eventTime),
    endTime: form.endTime ? normalizeEventTime(form.endTime) : null,
    locationName: form.locationName.trim(),
    address: form.address.trim(),
    longitude,
    latitude,
    category: form.category,
    images: form.images.slice(0, 3)
  };
}

function submitForm() {
  const input = validateInput();
  if (!input) {
    return;
  }
  emit('save', input);
}

function selectCategory(category: StoryCategory) {
  form.category = category;
}

function updateLocationFromFields() {
  const longitude = Number(form.longitude);
  const latitude = Number(form.latitude);
  if (form.longitude.trim() && form.latitude.trim() && Number.isFinite(longitude) && Number.isFinite(latitude)) {
    emit('location-change', {
      longitude,
      latitude,
      locationName: form.locationName.trim() || '自定义地点',
      address: form.address.trim()
    });
  }
}

function handleLocationInput() {
  localError.value = '';
  locationStatus.value = '';
  locationSuggestions.value = [];
  form.longitude = '';
  form.latitude = '';

  clearLocationSearchTimer();

  const keyword = form.locationName.trim();
  if (keyword.length < 2) {
    return;
  }

  locationSearchTimer = window.setTimeout(() => {
    searchLocationSuggestions(keyword);
  }, 260);
}

async function searchLocationSuggestions(keyword: string) {
  if (!getLoadedAmapSdk()) {
    locationStatus.value = '高德地图服务尚未加载，可先点击地图选点';
    return;
  }

  isSearchingLocation.value = true;
  try {
    const results = await searchAmapLocations(keyword);

    if (form.locationName.trim() !== keyword) {
      return;
    }

    locationSuggestions.value = results.slice(0, 5);
    locationStatus.value = results.length ? '' : '没有找到匹配地点';
  } catch (error) {
    locationStatus.value = errorMessage(error, '地点联想失败');
  } finally {
    isSearchingLocation.value = false;
  }
}

function selectLocationSuggestion(suggestion: LocationSuggestion) {
  clearLocationSearchTimer();
  const location = {
    longitude: suggestion.longitude,
    latitude: suggestion.latitude,
    locationName: suggestion.name,
    address: suggestion.address
  };
  applyLocation(location);
  emit('location-change', location);
}

function selectLocationSuggestionFromPointer(event: PointerEvent, suggestion: LocationSuggestion) {
  event.preventDefault();
  selectLocationSuggestion(suggestion);
}

function updateEventDate(value: string | null) {
  form.eventTime = value ?? '';
}

function updateEndDate(value: string | null) {
  form.endTime = value ?? '';
}

function updateEventDateFromNative(event: Event) {
  updateEventDate((event.target as HTMLInputElement).value);
}

function updateEndDateFromNative(event: Event) {
  updateEndDate((event.target as HTMLInputElement).value);
}

async function uploadImages(payload: Event | { fileList: UploadFileInfo[] }) {
  const picked = pickImages('fileList' in payload ? payload.fileList : (payload.target as HTMLInputElement).files);
  const files = picked.accepted.slice(0, Math.max(0, 3 - form.images.length));
  imageFileList.value = [];
  if ('target' in payload) {
    (payload.target as HTMLInputElement).value = '';
  }
  localError.value = picked.rejection;
  if (!files.length) {
    return;
  }

  isUploading.value = true;
  try {
    for (const file of files) {
      form.images.push(await props.uploadImage(file));
    }
  } catch (error) {
    localError.value = errorMessage(error, '图片上传失败');
  } finally {
    isUploading.value = false;
  }
}

function removeImage(image: string) {
  form.images = form.images.filter((item) => item !== image);
}

function playEditorOpen() {
  if (!editorRoot.value) {
    return;
  }
  slots.stop('editorOpenTl');
  slots.stop('editorCloseTl');
  slots.stop('editorContext');

  const root = editorRoot.value;
  editorContext = slots.hold('editorContext', gsap.context(() => {
    const fields = Array.from(root.querySelectorAll<HTMLElement>('.moment-editor__motion-field'));
    const photos = Array.from(root.querySelectorAll<HTMLElement>('.moment-editor__photo-slot'));

    if (shouldSkipMotion()) {
      gsap.set([root, ...fields, ...photos], { autoAlpha: 1, scale: 1, y: 0, rotation: 0, clearProps: 'transform,visibility' });
      return;
    }

    const isMobile = window.matchMedia?.('(max-width: 767px)').matches;
    editorOpenTl = slots.hold('editorOpenTl', gsap.timeline({ defaults: { ease: 'power3.out', overwrite: 'auto' } }));
    editorOpenTl
      .addLabel('paperIn', 0)
      .fromTo(
        root,
        { autoAlpha: 0, scale: 0.94, y: isMobile ? 8 : 14, rotation: isMobile ? 0 : -1.2 },
        { autoAlpha: 1, scale: 1, y: 0, rotation: 0, duration: isMobile ? 0.24 : 0.32, clearProps: 'transform,visibility' },
        'paperIn'
      )
      .addLabel('fieldsIn', 'paperIn+=0.12')
      .fromTo(
        fields,
        { autoAlpha: 0, y: 6 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.18,
          ease: 'power2.out',
          stagger: { each: isMobile ? 0.02 : 0.035, from: 'start' },
          clearProps: 'transform,visibility'
        },
        'fieldsIn'
      )
      .addLabel('photosIn', 'paperIn+=0.22')
      .fromTo(
        photos,
        { autoAlpha: 0, scale: 0.92 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.22,
          stagger: { each: isMobile ? 0.025 : 0.045, from: 'start' },
          clearProps: 'transform,visibility'
        },
        'photosIn'
      );
  }, root));
}

function playEditorClose() {
  slots.stop('editorOpenTl');
  slots.stop('editorCloseTl');
  if (!isEditorRendered.value) {
    return;
  }
  if (isInstantMotion() || !editorRoot.value) {
    isEditorRendered.value = false;
    slots.stop('editorContext');
    return;
  }

  const root = editorRoot.value;
  const fields = Array.from(root.querySelectorAll<HTMLElement>('.moment-editor__motion-field'));
  const finish = () => {
    isEditorRendered.value = false;
    slots.stop('editorContext');
  };

  if (prefersReducedMotion()) {
    editorCloseTl = slots.hold('editorCloseTl', gsap.timeline({ defaults: { ease: 'power1.out', overwrite: 'auto' }, onComplete: finish }));
    editorCloseTl.to(root, { autoAlpha: 0, duration: 0.08 }, 0);
    return;
  }

  editorCloseTl = slots.hold('editorCloseTl', gsap.timeline({ defaults: { ease: 'power1.out', overwrite: 'auto' }, onComplete: finish }));
  editorCloseTl
    .to(fields, { autoAlpha: 0, y: -2, duration: 0.08 }, 0)
    .to(root, { autoAlpha: 0, scale: 0.975, y: 4, duration: 0.14, clearProps: 'transform,visibility' }, 0.02);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isEditorRendered" class="moment-editor-backdrop">
      <form
        ref="editorRoot"
        class="moment-editor moment-editor--motion"
        :class="{ 'is-saving': saving || isUploading }"
        :style="editorPositionStyle"
        role="dialog"
        aria-modal="true"
        :aria-label="mode === 'create' ? '添加点滴' : '编辑点滴'"
        @submit.prevent="submitForm"
      >
        <h2 class="moment-editor__header">{{ mode === 'create' ? '添加点滴' : '编辑点滴' }}</h2>

        <div class="moment-editor__paper-content">
          <NAlert v-if="error || localError" class="moment-editor__error moment-editor__motion-field" type="error" :show-icon="false">
            {{ error || localError }}
          </NAlert>

          <label class="moment-editor__control moment-editor__title-control moment-editor__motion-field">
            <Pencil :size="16" />
            <NInput
              v-model:value="form.title"
              maxlength="40"
              placeholder="这一刻的标题"
              :input-props="{ type: 'text', maxlength: 40, required: true, placeholder: '这一刻的标题' }"
            />
          </label>

          <div class="moment-editor__categories moment-editor__motion-field" aria-label="点滴类型">
            <NButton
              v-for="option in categoryOptions"
              :key="option.key"
              attr-type="button"
              quaternary
              :class="{ 'is-active': form.category === option.key }"
              @click="selectCategory(option.key)"
            >
              <component :is="categoryIconMap[option.key]" :size="15" />
              <span>{{ STORY_CATEGORY_LABELS[option.key] }}</span>
            </NButton>
          </div>

          <div class="moment-editor__compact-row moment-editor__motion-field">
            <div class="moment-editor__control moment-editor__date-control">
              <CalendarDays :size="15" />
              <span>开始</span>
              <NDatePicker
                :formatted-value="form.eventTime"
                type="date"
                value-format="yyyy-MM-dd"
                :actions="['confirm']"
                @update:formatted-value="updateEventDate"
              />
              <input class="visually-hidden" :value="form.eventTime" type="date" required aria-label="开始日期" @input="updateEventDateFromNative" />
            </div>
            <div class="moment-editor__control moment-editor__date-control">
              <CalendarDays :size="15" />
              <span>结束</span>
              <NDatePicker
                :formatted-value="form.endTime"
                type="date"
                value-format="yyyy-MM-dd"
                :actions="['confirm']"
                @update:formatted-value="updateEndDate"
              />
              <input class="visually-hidden" :value="form.endTime" type="date" aria-label="结束日期" @input="updateEndDateFromNative" />
            </div>
          </div>

          <div class="moment-editor__location-block moment-editor__motion-field">
            <label class="moment-editor__control moment-editor__location-display">
              <MapPin :size="16" />
              <NInput
                v-model:value="form.locationName"
                placeholder="输入地点试试"
                :input-props="{
                  type: 'text',
                  placeholder: '输入地点试试',
                  autocomplete: 'off',
                  role: 'combobox',
                  'aria-expanded': locationSuggestions.length > 0,
                  'aria-controls': 'story-location-suggestions'
                }"
                @input="handleLocationInput"
                @change="updateLocationFromFields"
              />
            </label>
            <div v-if="isSearchingLocation || locationStatus || locationSuggestions.length" class="moment-editor__location-suggestions">
              <p v-if="isSearchingLocation" class="moment-editor__hint">正在查找地点...</p>
              <p v-else-if="locationStatus" class="moment-editor__hint">{{ locationStatus }}</p>
              <div v-if="locationSuggestions.length" id="story-location-suggestions" class="moment-editor__suggestion-list" role="listbox">
                <button
                  v-for="suggestion in locationSuggestions"
                  :key="suggestion.id"
                  type="button"
                  role="option"
                  @pointerdown="selectLocationSuggestionFromPointer($event, suggestion)"
                  @click="selectLocationSuggestion(suggestion)"
                >
                  <strong>{{ suggestion.name }}</strong>
                  <span>{{ suggestion.address }}</span>
                </button>
              </div>
            </div>
          </div>

          <label class="moment-editor__text-control moment-editor__motion-field">
            <NInput
              v-model:value="form.content"
              type="textarea"
              maxlength="300"
              placeholder="写下这一次的点滴..."
              :autosize="{ minRows: 4, maxRows: 4 }"
              :input-props="{ maxlength: 300, rows: 4, placeholder: '写下这一次的点滴...' }"
            />
            <span>{{ contentLength }}/300</span>
          </label>

          <section class="moment-editor__photo-section moment-editor__motion-field" aria-label="图片上传">
            <p>照片（最多3张）</p>
            <div class="moment-editor__images">
              <figure v-for="slot in photoSlots" :key="slot.index" class="moment-editor__photo-slot">
                <template v-if="slot.image">
                  <img :src="slot.image" alt="" />
                  <NButton attr-type="button" quaternary circle aria-label="移除图片" @click="removeImage(slot.image)">
                    <Trash2 :size="13" />
                  </NButton>
                </template>
                <NUpload
                  v-else
                  v-model:file-list="imageFileList"
                  class="moment-editor__upload"
                  :class="{ 'is-disabled': !canAddImage }"
                  :accept="IMAGE_ACCEPT"
                  multiple
                  :disabled="!canAddImage"
                  :default-upload="false"
                  :show-file-list="false"
                  :input-props="{ accept: IMAGE_ACCEPT, multiple: true }"
                  @change="uploadImages"
                >
                  <Loader2 v-if="isUploading" :size="18" class="story-spin" />
                  <ImagePlus v-else :size="18" />
                </NUpload>
              </figure>
            </div>
          </section>
        </div>

        <footer class="moment-editor__footer" aria-label="点滴编辑操作">
          <NButton class="moment-editor__paper-action moment-editor__paper-action--cancel" attr-type="button" @click="emit('close')">取消</NButton>
          <NButton
            class="moment-editor__paper-action moment-editor__paper-action--save"
            attr-type="submit"
            type="primary"
            :loading="saving"
            :disabled="saving || isUploading"
          >
            {{ saving ? '保存中' : mode === 'create' ? '保存点滴' : '保存修改' }}
          </NButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>
