import type {
  FeedbackScreenshotReceipt,
  FeedbackSubmission,
  FeedbackSubmissionReceipt,
  UpdateNotice,
  UpdateNoticeEnvelope,
  UpdateNoticeMuteReceipt
} from '../model';

export interface SupportGateway {
  fetchUpdateNotice(): Promise<UpdateNoticeEnvelope>;
  muteUpdateNoticeToday(): Promise<UpdateNoticeMuteReceipt>;
  uploadFeedbackScreenshot(
    file: File
  ): Promise<FeedbackScreenshotReceipt>;
  submitFeedback(
    submission: FeedbackSubmission
  ): Promise<FeedbackSubmissionReceipt>;
}

export interface NoticeDismissalStore {
  isDismissed(notice: UpdateNotice): boolean;
  remember(notice: UpdateNotice): void;
}
