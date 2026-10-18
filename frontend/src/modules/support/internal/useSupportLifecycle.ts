import {
  onMounted,
  reactive,
  ref,
  type Ref
} from 'vue';
import type {
  FeedbackDraft,
  UpdateNotice
} from '../model';
import { createBrowserNoticeDismissalStore } from './browserNoticeDismissalStore';
import { createHttpSupportGateway } from './httpSupportGateway';
import type {
  NoticeDismissalStore,
  SupportGateway
} from './ports';
import { errorMessage } from '../../../display';

interface FeedbackPageContext {
  pageUrl: string;
  userAgent: string;
}

export interface SupportLifecycleState {
  notice: Readonly<Ref<UpdateNotice | null>>;
  noticeVisible: Readonly<Ref<boolean>>;
  noticeError: Readonly<Ref<string>>;
  feedbackVisible: Readonly<Ref<boolean>>;
  feedbackError: Readonly<Ref<string>>;
  feedbackForm: FeedbackDraft;
  uploadedScreenshots: Readonly<Ref<string[]>>;
  uploadingScreenshot: Readonly<Ref<boolean>>;
  submittingFeedback: Readonly<Ref<boolean>>;
}

export interface SupportLifecycle {
  state: SupportLifecycleState;
  initialize(): Promise<void>;
  dismissNotice(): void;
  muteNoticeToday(): Promise<boolean>;
  openFeedback(): void;
  closeFeedback(): void;
  uploadScreenshots(files: File[]): Promise<void>;
  submitFeedback(): Promise<boolean>;
}

export interface SupportLifecycleOptions {
  gateway?: SupportGateway;
  noticeDismissals?: NoticeDismissalStore;
  readPageContext?: () => FeedbackPageContext;
}

export function createSupportLifecycle({
  gateway: providedGateway,
  noticeDismissals: providedNoticeDismissals,
  readPageContext = defaultPageContext
}: SupportLifecycleOptions = {}): SupportLifecycle {
  const gateway =
    providedGateway ?? createHttpSupportGateway();
  const noticeDismissals =
    providedNoticeDismissals ??
    createBrowserNoticeDismissalStore();
  const notice = ref<UpdateNotice | null>(null);
  const noticeVisible = ref(false);
  const noticeError = ref('');
  const feedbackVisible = ref(false);
  const feedbackError = ref('');
  const feedbackForm = reactive<FeedbackDraft>({
    type: 'bug',
    title: '',
    content: '',
    contact: ''
  });
  const uploadedScreenshots = ref<string[]>([]);
  const uploadingScreenshot = ref(false);
  const submittingFeedback = ref(false);

  async function initialize(): Promise<void> {
    try {
      const response = await gateway.fetchUpdateNotice();
      if (!response.shouldShow || !response.notice) {
        return;
      }
      if (noticeDismissals.isDismissed(response.notice)) {
        notice.value = null;
        noticeVisible.value = false;
        return;
      }
      notice.value = response.notice;
      noticeVisible.value = true;
    } catch {
      noticeVisible.value = false;
    }
  }

  function dismissNotice(): void {
    if (notice.value) {
      noticeDismissals.remember(notice.value);
    }
    noticeVisible.value = false;
    noticeError.value = '';
  }

  async function muteNoticeToday(): Promise<boolean> {
    noticeError.value = '';
    try {
      await gateway.muteUpdateNoticeToday();
      dismissNotice();
      return true;
    } catch (error) {
      noticeError.value = errorMessage(
        error,
        '今日不再提示设置失败'
      );
      return false;
    }
  }

  function openFeedback(): void {
    feedbackVisible.value = true;
    feedbackError.value = '';
    clearFeedbackScreenshots();
  }

  function closeFeedback(): void {
    feedbackVisible.value = false;
    feedbackError.value = '';
    clearFeedbackScreenshots();
  }

  async function uploadScreenshots(
    files: File[]
  ): Promise<void> {
    if (!files.length) {
      return;
    }
    if (
      uploadedScreenshots.value.length + files.length >
      3
    ) {
      feedbackError.value = '最多只能上传 3 张截图';
      return;
    }

    uploadingScreenshot.value = true;
    feedbackError.value = '';
    try {
      for (const file of files) {
        const response =
          await gateway.uploadFeedbackScreenshot(file);
        uploadedScreenshots.value.push(response.url);
      }
    } catch (error) {
      feedbackError.value = errorMessage(
        error,
        '截图上传失败'
      );
    } finally {
      uploadingScreenshot.value = false;
    }
  }

  async function submitFeedback(): Promise<boolean> {
    const title = feedbackForm.title.trim();
    const content = feedbackForm.content.trim();
    if (!title || !content) {
      feedbackError.value = '请填写反馈标题和内容';
      return false;
    }
    if (submittingFeedback.value) {
      return false;
    }

    submittingFeedback.value = true;
    feedbackError.value = '';
    try {
      const pageContext = readPageContext();
      await gateway.submitFeedback({
        type: feedbackForm.type,
        title,
        content,
        contact: feedbackForm.contact.trim(),
        imageUrls: [...uploadedScreenshots.value],
        pageUrl: pageContext.pageUrl,
        userAgent: pageContext.userAgent
      });
      resetFeedbackForm();
      closeFeedback();
      return true;
    } catch (error) {
      feedbackError.value = errorMessage(
        error,
        '反馈提交失败'
      );
      return false;
    } finally {
      submittingFeedback.value = false;
    }
  }

  function clearFeedbackScreenshots(): void {
    uploadedScreenshots.value = [];
  }

  function resetFeedbackForm(): void {
    feedbackForm.type = 'bug';
    feedbackForm.title = '';
    feedbackForm.content = '';
    feedbackForm.contact = '';
    uploadedScreenshots.value = [];
  }

  return {
    state: {
      notice,
      noticeVisible,
      noticeError,
      feedbackVisible,
      feedbackError,
      feedbackForm,
      uploadedScreenshots,
      uploadingScreenshot,
      submittingFeedback
    },
    initialize,
    dismissNotice,
    muteNoticeToday,
    openFeedback,
    closeFeedback,
    uploadScreenshots,
    submitFeedback
  };
}

export function useSupportLifecycle(
  options: SupportLifecycleOptions = {}
): SupportLifecycle {
  const lifecycle = createSupportLifecycle(options);
  onMounted(() => {
    void lifecycle.initialize();
  });
  return lifecycle;
}

function defaultPageContext(): FeedbackPageContext {
  return {
    pageUrl: window.location.href,
    userAgent: navigator.userAgent
  };
}
