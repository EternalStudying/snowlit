<script setup lang="ts">
import { IMAGE_ACCEPT, pickImages, type PickedImages } from '../../../imageFiles';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, type InputHTMLAttributes } from 'vue';
import {
  Bold,
  CalendarDays,
  ChevronDown,
  CloudSun,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  LockKeyhole,
  MapPin,
  Minus,
  Quote,
  UsersRound
} from 'lucide-vue-next';
import { NAlert, NButton, NDatePicker, NInput, NSelect, NUpload, type SelectOption, type UploadFileInfo } from 'naive-ui';
import diaryEditorBackground from '../assets/diary-editor-background.webp';
import type {
  DiaryEditorValue,
  DiaryImageUploadDto,
  DiaryMoodKey,
  DiaryVisibility
} from '../model';
import { DIARY_MOODS } from '../moods';
import {
  deriveDiaryTitle,
  diaryMarkdownCharacterCount,
  ensureDiaryTitleMarkdown,
  renderDiaryMarkdown,
  stripLeadingDiaryTitle
} from '../internal/markdown';
import { useModalWheelGuard } from '../../../composables/useModalWheelGuard';

interface DiaryDraft extends DiaryEditorValue {
  savedAt?: string;
}

const props = defineProps<{
  mode: 'create' | 'edit';
  initialValue: DiaryEditorValue;
  draftKey: string;
  uploadImage: (file: File) => Promise<DiaryImageUploadDto>;
  saving?: boolean;
  error?: string;
}>();

const imagePickError = ref('');
const editorWheelGuardActive = ref(true);
useModalWheelGuard(editorWheelGuardActive);

const emit = defineEmits<{
  close: [];
  save: [value: DiaryEditorValue];
}>();

const form = reactive<DiaryEditorValue>({
  title: props.initialValue.title,
  content: ensureDiaryTitleMarkdown(props.initialValue.content, props.initialValue.title),
  date: props.initialValue.date,
  moodKey: props.initialValue.moodKey,
  location: props.initialValue.location,
  weather: props.initialValue.weather,
  visibility: props.initialValue.visibility
});

const textarea = ref<HTMLTextAreaElement | null>(null);
const imageUploadHost = ref<HTMLElement | null>(null);
const diaryPopupPortal = ref<HTMLElement>();
const imageFileList = ref<UploadFileInfo[]>([]);
const pendingDraft = ref<DiaryDraft | null>(null);
const hasTouched = ref(false);
const isMoodPickerOpen = ref(false);
let draftTimer: number | undefined;
const visibilityOptions: SelectOption[] = [
  { label: '共同可见', value: 'shared' },
  { label: '私密标记', value: 'private' }
];
const diaryImageInputProps = {
  'data-diary-image-input': '',
  accept: IMAGE_ACCEPT,
  multiple: true
} as unknown as InputHTMLAttributes;

const previewHtml = computed(() =>
  renderDiaryMarkdown(stripLeadingDiaryTitle(form.content))
);
const wordCount = computed(() =>
  diaryMarkdownCharacterCount(stripLeadingDiaryTitle(form.content))
);
const activeMood = computed(() => DIARY_MOODS.find((mood) => mood.key === form.moodKey) ?? DIARY_MOODS[0]);
const isLocationLocked = computed(() => Boolean(props.initialValue.location.trim()));
const isWeatherLocked = computed(() => Boolean(props.initialValue.weather.trim()));

function markTouched() {
  hasTouched.value = true;
}

function getCurrentValue(): DiaryEditorValue {
  return {
    title: deriveDiaryTitle(form.content, form.title),
    content: form.content,
    date: form.date,
    moodKey: form.moodKey,
    location: form.location,
    weather: form.weather,
    visibility: form.visibility
  };
}

function loadDraft() {
  const rawDraft = localStorage.getItem(props.draftKey);

  if (!rawDraft) {
    return;
  }

  try {
    pendingDraft.value = JSON.parse(rawDraft) as DiaryDraft;
  } catch {
    localStorage.removeItem(props.draftKey);
  }
}

function writeDraft() {
  if (!hasTouched.value || pendingDraft.value) {
    return;
  }

  localStorage.setItem(
    props.draftKey,
    JSON.stringify({
      ...getCurrentValue(),
      savedAt: new Date().toISOString()
    })
  );
}

function applyValue(value: DiaryEditorValue) {
  form.title = value.title;
  form.content = ensureDiaryTitleMarkdown(value.content, value.title);
  form.date = value.date;
  form.moodKey = value.moodKey;
  form.location = value.location;
  form.weather = value.weather;
  form.visibility = value.visibility;
}

function restoreDraft() {
  if (!pendingDraft.value) {
    return;
  }

  applyValue(pendingDraft.value);
  pendingDraft.value = null;
  hasTouched.value = true;
}

function discardDraft() {
  localStorage.removeItem(props.draftKey);
  pendingDraft.value = null;
}

function toggleMoodPicker() {
  isMoodPickerOpen.value = !isMoodPickerOpen.value;
}

function closeMoodPicker() {
  isMoodPickerOpen.value = false;
}

function focusTitleLine() {
  void nextTick(() => {
    const target = textarea.value;

    if (!target) {
      return;
    }

    target.focus();

    if (props.mode === 'create' && form.content.startsWith('# ')) {
      target.setSelectionRange(2, 2);
    }
  });
}

function closeEditor() {
  emit('close');
}

function submitEditor() {
  emit('save', getCurrentValue());
}

function getCursorRange() {
  const target = textarea.value;

  if (!target) {
    return {
      start: form.content.length,
      end: form.content.length
    };
  }

  return {
    start: target.selectionStart,
    end: target.selectionEnd
  };
}

function insertMarkdown(snippet: string) {
  const { start, end } = getCursorRange();
  form.content = `${form.content.slice(0, start)}${snippet}${form.content.slice(end)}`;
  markTouched();

  void nextTick(() => {
    const target = textarea.value;

    if (!target) {
      return;
    }

    const nextPosition = start + snippet.length;
    target.focus();
    target.setSelectionRange(nextPosition, nextPosition);
  });
}

function insertInline(prefix: string, suffix: string, placeholder: string) {
  const { start, end } = getCursorRange();
  const selected = form.content.slice(start, end) || placeholder;
  insertMarkdown(`${prefix}${selected}${suffix}`);
}

function insertBlock(snippet: string) {
  const prefix = form.content && !form.content.endsWith('\n') ? '\n\n' : '';
  insertMarkdown(`${prefix}${snippet}`);
}

function openImagePicker() {
  imageUploadHost.value?.querySelector<HTMLInputElement>('input[data-diary-image-input]')?.click();
}

async function insertImageFiles({ accepted, rejection }: PickedImages) {
  imagePickError.value = rejection;
  for (const file of accepted) {
    const uploaded = await props.uploadImage(file);
    insertBlock(`![图片说明](${uploaded.url})\n\n`);
  }
}

function selectMood(key: DiaryMoodKey) {
  form.moodKey = key;
  isMoodPickerOpen.value = false;
  markTouched();
}

function onImageInput(payload: Event | { fileList: UploadFileInfo[] }) {
  void insertImageFiles(pickImages('fileList' in payload ? payload.fileList : (payload.target as HTMLInputElement).files));
  imageFileList.value = [];
  if ('target' in payload) {
    (payload.target as HTMLInputElement).value = '';
  }
}

function updateVisibility(value: string) {
  form.visibility = value as DiaryVisibility;
  markTouched();
}

function updateVisibilityFromNative(event: Event) {
  updateVisibility((event.target as HTMLSelectElement).value);
}

function updateDate(value: string | null) {
  form.date = value ?? '';
  markTouched();
}

function updateDateFromNative(event: Event) {
  updateDate((event.target as HTMLInputElement).value);
}

function onTextareaPaste(event: ClipboardEvent) {
  const picked = pickImages(event.clipboardData?.files);

  if (!picked.accepted.length && !picked.rejection) {
    return;
  }

  event.preventDefault();
  void insertImageFiles(picked);
}

function onTextareaDrop(event: DragEvent) {
  const picked = pickImages(event.dataTransfer?.files);

  if (!picked.accepted.length && !picked.rejection) {
    return;
  }

  event.preventDefault();
  void insertImageFiles(picked);
}

onMounted(() => {
  loadDraft();
  focusTitleLine();
  draftTimer = window.setInterval(writeDraft, 1000);
});

watch(
  () => [props.initialValue.location, props.initialValue.weather] as const,
  ([location, weather]) => {
    if (props.mode !== 'create' || pendingDraft.value) {
      return;
    }

    if (!form.location.trim() && location.trim()) {
      form.location = location;
    }

    if (!form.weather.trim() && weather.trim()) {
      form.weather = weather;
    }
  }
);

onBeforeUnmount(() => {
  if (draftTimer) {
    window.clearInterval(draftTimer);
  }
});
</script>

<template>
  <div class="diary-editor-backdrop" data-smooth-scroll-prevent @click.self="closeEditor">
    <section class="diary-markdown-editor-modal" role="dialog" aria-modal="true" aria-label="Markdown 手账编辑器">
      <img class="diary-markdown-editor__background" :src="diaryEditorBackground" alt="" draggable="false" />
      <form class="diary-markdown-editor__form" @submit.prevent="submitEditor">
        <div class="diary-markdown-editor__toolbar" aria-label="Markdown 手账工具栏">
          <div class="diary-markdown-editor__tool-group">
            <NButton attr-type="button" quaternary aria-label="插入标题" title="插入标题" @click="insertBlock('## 小标题\n\n')">
              <Heading2 :size="17" />
            </NButton>
            <NButton attr-type="button" quaternary aria-label="加粗" title="加粗" @click="insertInline('**', '**', '想写的话')">
              <Bold :size="17" />
            </NButton>
            <NButton attr-type="button" quaternary aria-label="斜体" title="斜体" @click="insertInline('*', '*', '想写的话')">
              <Italic :size="17" />
            </NButton>
            <NButton attr-type="button" quaternary aria-label="高亮" title="高亮" @click="insertInline('==', '==', '想标亮的片段')">
              <Highlighter :size="17" />
            </NButton>
            <span class="diary-markdown-editor__divider"></span>
            <NButton attr-type="button" quaternary aria-label="列表" title="列表" @click="insertBlock('- 一个小片段\n')">
              <List :size="17" />
            </NButton>
            <NButton attr-type="button" quaternary aria-label="引用" title="引用" @click="insertBlock('> 想留下的一句话\n\n')">
              <Quote :size="17" />
            </NButton>
            <NButton attr-type="button" quaternary aria-label="分隔线" title="分隔线" @click="insertBlock('---\n\n')">
              <Minus :size="18" />
            </NButton>
            <NButton attr-type="button" quaternary aria-label="插入图片" title="插入图片" @click="openImagePicker">
              <ImagePlus :size="17" />
            </NButton>
            <span class="diary-markdown-editor__divider"></span>
            <NButton attr-type="button" quaternary aria-label="插入日期标签" title="插入日期标签" @click="insertInline('`', '`', `日期：${form.date || '今天'}`)">
              <CalendarDays :size="17" />
            </NButton>
            <NButton attr-type="button" quaternary aria-label="插入地点标签" title="插入地点标签" @click="insertInline('`', '`', `地点：${form.location || '这里'}`)">
              <MapPin :size="17" />
            </NButton>
          </div>

          <div class="diary-markdown-editor__meta-toolbar" aria-label="日记信息">
            <div class="diary-markdown-editor__meta-field diary-markdown-editor__meta-field--mood" title="心情">
              <span>心情</span>
              <input type="hidden" name="moodKey" :value="form.moodKey" />
              <button
                class="diary-mood-select__trigger"
                type="button"
                data-mood-trigger="true"
                aria-label="心情"
                aria-haspopup="listbox"
                :aria-expanded="isMoodPickerOpen"
                @click="toggleMoodPicker"
                @keydown.esc.stop="closeMoodPicker"
              >
                <img :src="activeMood.icon" :alt="activeMood.label" />
                <span>{{ activeMood.label }}</span>
                <ChevronDown :size="14" />
              </button>
              <div v-if="isMoodPickerOpen" class="diary-mood-picker" data-mood-dropdown="true" role="listbox" aria-label="心情黄豆">
                <button
                  v-for="mood in DIARY_MOODS"
                  :key="mood.key"
                  class="diary-mood-picker__button"
                  :class="{ 'diary-mood-picker__button--active': form.moodKey === mood.key }"
                  type="button"
                  role="option"
                  :data-mood-key="mood.key"
                  :aria-selected="form.moodKey === mood.key"
                  :aria-pressed="form.moodKey === mood.key"
                  :title="mood.label"
                  @click="selectMood(mood.key)"
                >
                  <img :src="mood.icon" :alt="mood.label" />
                  <span>{{ mood.label }}</span>
                </button>
              </div>
            </div>

            <label class="diary-markdown-editor__meta-field diary-markdown-editor__meta-field--location" title="地点">
              <MapPin :size="16" />
              <span>地点</span>
              <NInput
                v-model:value="form.location"
                placeholder="地点"
                :readonly="isLocationLocked"
                :input-props="{ name: 'location', 'aria-label': '地点', placeholder: '地点', readonly: isLocationLocked }"
                @input="markTouched"
              />
            </label>

            <label class="diary-markdown-editor__meta-field diary-markdown-editor__meta-field--short" title="天气">
              <CloudSun :size="16" />
              <span>天气</span>
              <NInput
                v-model:value="form.weather"
                placeholder="天气"
                :readonly="isWeatherLocked"
                :input-props="{ name: 'weather', 'aria-label': '天气', placeholder: '天气', readonly: isWeatherLocked }"
                @input="markTouched"
              />
            </label>

            <div class="diary-markdown-editor__meta-field diary-markdown-editor__meta-field--visibility" title="可见性">
              <component :is="form.visibility === 'private' ? LockKeyhole : UsersRound" :size="16" />
              <span>可见性</span>
              <NSelect
                :value="form.visibility"
                :options="visibilityOptions"
                :consistent-menu-width="false"
                placement="bottom-end"
                :to="diaryPopupPortal"
                @update:value="updateVisibility"
              />
              <select class="visually-hidden" name="visibility" aria-label="可见性" :value="form.visibility" @change="updateVisibilityFromNative">
                <option value="shared">共同可见</option>
                <option value="private">私密标记</option>
              </select>
            </div>

            <div class="diary-markdown-editor__meta-field diary-markdown-editor__meta-field--date" title="日期">
              <CalendarDays :size="16" />
              <span>日期</span>
              <NDatePicker
                :formatted-value="form.date"
                type="date"
                value-format="yyyy-MM-dd"
                :disabled="mode === 'edit'"
                :actions="['confirm']"
                placement="bottom-end"
                :to="diaryPopupPortal"
                @update:formatted-value="updateDate"
              />
              <input
                class="visually-hidden"
                name="date"
                type="date"
                aria-label="日期"
                required
                :disabled="mode === 'edit'"
                :value="form.date"
                @input="updateDateFromNative"
              />
            </div>
          </div>

          <span ref="imageUploadHost" class="diary-markdown-editor__file-input">
            <NUpload
              v-model:file-list="imageFileList"
              :accept="IMAGE_ACCEPT"
              multiple
              :default-upload="false"
              :show-file-list="false"
              :input-props="diaryImageInputProps"
              @change="onImageInput"
            >
              <span class="visually-hidden">插入图片</span>
            </NUpload>
          </span>
        </div>

        <div class="diary-markdown-editor__book">
          <section class="diary-markdown-editor__page diary-markdown-editor__left-page" aria-label="Markdown 写作区">
            <div class="diary-markdown-editor__page-heading">
              <span>Markdown</span>
              <small>左页写作</small>
            </div>
            <textarea
              ref="textarea"
              v-model="form.content"
              class="diary-markdown-editor__textarea"
              name="content"
              aria-label="Markdown 写作区"
              placeholder="在这里写下今天。可以用工具按钮插入标题、加粗、图片和小标签。"
              @input="markTouched"
              @paste="onTextareaPaste"
              @drop="onTextareaDrop"
              @dragover.prevent
            ></textarea>
          </section>

          <section class="diary-markdown-editor__page diary-markdown-editor__right-page" aria-label="实时预览区">
            <div class="diary-markdown-editor__page-heading">
              <span>Preview</span>
              <small>右页预览</small>
            </div>
            <div class="diary-markdown-editor__preview" v-html="previewHtml"></div>
            <p v-if="!form.content.trim()" class="diary-markdown-editor__empty-preview">右页会实时预览你贴上去的文字和图片。</p>
            <p class="diary-markdown-editor__word-count">已输入 {{ wordCount }} 字</p>
          </section>
        </div>

        <NAlert v-if="error || imagePickError" class="diary-editor-error" type="error" :show-icon="false">{{ error || imagePickError }}</NAlert>

        <footer class="diary-markdown-editor__actions">
          <NButton class="diary-markdown-editor__ghost" attr-type="button" @click="closeEditor">取消</NButton>
          <NButton
            class="diary-markdown-editor__submit"
            :class="{ 'diary-markdown-editor__submit--saving': saving }"
            attr-type="submit"
            type="primary"
            :loading="saving"
            :disabled="saving"
          >
            {{ saving ? '保存中...' : '贴进时间线' }}
          </NButton>
        </footer>
      </form>
      <div v-if="pendingDraft" class="diary-draft-confirm-backdrop">
        <section class="diary-draft-confirm" role="alertdialog" aria-modal="true" aria-label="恢复草稿">
          <p class="diary-draft-confirm__eyebrow">Draft</p>
          <h3>发现一张未贴上的草稿</h3>
          <p>要把上次留下的内容放回这页手账里吗？</p>
          <div class="diary-draft-confirm__actions">
            <NButton attr-type="button" class="diary-draft-confirm__ghost" data-action="discard" @click="discardDraft">丢弃草稿</NButton>
            <NButton attr-type="button" class="diary-draft-confirm__primary" data-action="restore" type="primary" @click="restoreDraft">恢复草稿</NButton>
          </div>
        </section>
      </div>
    </section>
    <div ref="diaryPopupPortal" class="diary-editor-popup-portal" data-smooth-scroll-prevent></div>
  </div>
</template>
