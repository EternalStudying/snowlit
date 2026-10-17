<script setup lang="ts">
import {
  ref,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes
} from 'vue';
import {
  NAlert,
  NButton,
  NInput,
  NModal,
  NSelect,
  NUpload,
  useMessage,
  type SelectOption,
  type UploadFileInfo
} from 'naive-ui';
import TopbarTooltip from '../../components/TopbarTooltip.vue';
import { useSupportLifecycle } from './internal/useSupportLifecycle';

const support = useSupportLifecycle();
const {
  notice,
  noticeVisible,
  noticeError,
  feedbackVisible,
  feedbackError,
  feedbackForm,
  uploadedScreenshots,
  uploadingScreenshot,
  submittingFeedback
} = support.state;
const closeNotice = support.dismissNotice;
const muteToday = support.muteNoticeToday;
const screenshotFileList = ref<UploadFileInfo[]>([]);
const message = useMessage();
const feedbackTypeOptions: SelectOption[] = [
  { label: 'Bug 反馈', value: 'bug' },
  { label: '功能建议', value: 'feature' },
  { label: '体验问题', value: 'experience' },
  { label: '其他', value: 'other' }
];
const feedbackTitleInputProps = {
  'data-testid': 'feedback-title',
  placeholder: '一句话说清楚问题'
} as unknown as InputHTMLAttributes;
const feedbackContentInputProps = {
  'data-testid': 'feedback-content',
  placeholder: '把你遇到的情况、页面和期望结果写下来'
} as unknown as TextareaHTMLAttributes;
const feedbackContactInputProps = {
  'data-testid': 'feedback-contact',
  placeholder: '微信、邮箱或其他联系方式（可不填）'
} as unknown as InputHTMLAttributes;
const feedbackIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path fill="currentColor" d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></g></svg>';

function openFeedback() {
  screenshotFileList.value = [];
  support.openFeedback();
}

function closeFeedback() {
  screenshotFileList.value = [];
  support.closeFeedback();
}

async function uploadScreenshotFiles(files: File[]) {
  try {
    await support.uploadScreenshots(files);
  } finally {
    screenshotFileList.value = [];
  }
}

async function handleScreenshotChange(options: { fileList: UploadFileInfo[] }) {
  await uploadScreenshotFiles(
    options.fileList
      .map((item) => item.file)
      .filter((file): file is File => Boolean(file))
  );
}

function handleNativeScreenshotChange(event: Event) {
  const input = event.target as HTMLInputElement;
  void uploadScreenshotFiles(Array.from(input.files ?? []));
  input.value = '';
}

async function submitCurrentFeedback() {
  if (await support.submitFeedback()) {
    screenshotFileList.value = [];
    message.success('反馈已提交');
  }
}
</script>

<template>
  <NModal
    v-if="noticeVisible && notice"
    :show="true"
    to="body"
    :z-index="5000"
    :block-scroll="true"
    :trap-focus="true"
    :mask-closable="false"
    :close-on-esc="true"
    display-directive="if"
    @esc="closeNotice"
  >
    <section
      class="update-notice-dialog"
      data-testid="update-notice-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-notice-title"
    >
      <div class="update-notice-dialog__panel">
        <p class="update-notice-dialog__eyebrow">{{ notice.version }}</p>
        <h2 id="update-notice-title">{{ notice.title }}</h2>
        <ul>
          <li v-for="item in notice.items" :key="item">{{ item }}</li>
        </ul>
        <NAlert v-if="noticeError" class="app-floating-error" type="error" :show-icon="false">
          {{ noticeError }}
        </NAlert>
        <footer>
          <NButton data-testid="update-notice-mute" secondary @click="muteToday">今日不再提示</NButton>
          <NButton type="primary" data-testid="update-notice-confirm" @click="closeNotice">确认</NButton>
        </footer>
      </div>
    </section>
  </NModal>

  <TopbarTooltip label="反馈">
    <NButton class="feedback-entry app-topbar__feedback-entry" data-testid="feedback-entry" quaternary circle aria-label="打开反馈" @click="openFeedback">
      <span class="app-topbar__entry-icon" aria-hidden="true" v-html="feedbackIcon"></span>
    </NButton>
  </TopbarTooltip>

  <NModal
    :show="feedbackVisible"
    to="body"
    :z-index="5000"
    :block-scroll="true"
    :trap-focus="false"
    :mask-closable="false"
    :close-on-esc="true"
    display-directive="if"
    @esc="closeFeedback"
  >
    <section class="feedback-dialog" data-testid="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <div class="feedback-dialog__panel">
        <header>
          <p>Feedback</p>
          <h2 id="feedback-title">告诉我们哪里需要调整</h2>
          <NButton quaternary circle aria-label="关闭反馈" @click="closeFeedback">×</NButton>
        </header>
        <label>
          类型
          <NSelect v-model:value="feedbackForm.type" data-testid="feedback-type" :options="feedbackTypeOptions" placeholder="选择反馈类型" :to="false" />
        </label>
        <label>
          标题
          <NInput
            v-model:value="feedbackForm.title"
            maxlength="80"
            placeholder="一句话说清楚问题"
            :input-props="feedbackTitleInputProps"
          />
        </label>
        <label>
          内容
          <NInput
            v-model:value="feedbackForm.content"
            type="textarea"
            :autosize="{ minRows: 5, maxRows: 7 }"
            placeholder="把你遇到的情况、页面和期望结果写下来"
            :input-props="feedbackContentInputProps"
          />
        </label>
        <label>
          联系方式
          <NInput
            v-model:value="feedbackForm.contact"
            maxlength="120"
            placeholder="微信、邮箱或其他联系方式（可不填）"
            :input-props="feedbackContactInputProps"
          />
        </label>
        <div class="feedback-dialog__upload">
          <span>截图</span>
          <NUpload
            v-model:file-list="screenshotFileList"
            class="feedback-dialog__screenshot-picker"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            :max="3"
            :disabled="uploadingScreenshot || uploadedScreenshots.length >= 3"
            :default-upload="false"
            :show-file-list="false"
            :input-props="{ accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', multiple: true }"
            @change="handleScreenshotChange"
          >
            <NButton secondary :loading="uploadingScreenshot" :disabled="uploadingScreenshot || uploadedScreenshots.length >= 3">
              {{ uploadingScreenshot ? '上传中...' : '选择截图' }}
            </NButton>
          </NUpload>
          <input
            class="visually-hidden"
            data-testid="feedback-screenshot-input"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            :disabled="uploadingScreenshot || uploadedScreenshots.length >= 3"
            @change="handleNativeScreenshotChange"
          />
        </div>
        <div v-if="uploadedScreenshots.length" class="feedback-dialog__screenshots">
          <span v-for="url in uploadedScreenshots" :key="url">{{ url.split('/').pop() }}</span>
        </div>
        <NAlert v-if="feedbackError" class="app-floating-error" type="error" :show-icon="false">
          {{ feedbackError }}
        </NAlert>
        <footer>
          <NButton secondary @click="closeFeedback">取消</NButton>
          <NButton type="primary" data-testid="feedback-submit" :disabled="uploadingScreenshot || submittingFeedback" :loading="submittingFeedback" @click="submitCurrentFeedback">
            {{ submittingFeedback ? '提交中...' : '提交反馈' }}
          </NButton>
        </footer>
      </div>
    </section>
  </NModal>
</template>
