export type FeedbackType =
  | 'bug'
  | 'feature'
  | 'experience'
  | 'other';

export interface FeedbackDraft {
  type: FeedbackType;
  title: string;
  content: string;
  contact: string;
}

export interface FeedbackSubmission extends FeedbackDraft {
  imageUrls: string[];
  pageUrl: string;
  userAgent: string;
}

export interface FeedbackScreenshotReceipt {
  url: string;
}

export interface FeedbackSubmissionReceipt {
  id: number;
  status: 'pending';
  createdAt: string;
}

export interface UpdateNotice {
  id: number;
  title: string;
  version: string;
  publishedAt: string;
  items: string[];
}

export interface UpdateNoticeEnvelope {
  shouldShow: boolean;
  notice: UpdateNotice | null;
}

export interface UpdateNoticeMuteReceipt {
  mutedUntil: string;
}
