import type { SupportGateway } from '../../internal/ports';
import type {
  FeedbackSubmission,
  UpdateNoticeEnvelope
} from '../../model';

export interface MemorySupportGatewayOptions {
  notice?: UpdateNoticeEnvelope;
  overrides?: Partial<SupportGateway>;
}

export function createMemorySupportGateway({
  notice = {
    shouldShow: false,
    notice: null
  },
  overrides = {}
}: MemorySupportGatewayOptions = {}): SupportGateway {
  return {
    async fetchUpdateNotice() {
      return overrides.fetchUpdateNotice
        ? overrides.fetchUpdateNotice()
        : structuredClone(notice);
    },

    async muteUpdateNoticeToday() {
      return overrides.muteUpdateNoticeToday
        ? overrides.muteUpdateNoticeToday()
        : { mutedUntil: '2026-05-17T23:59:59' };
    },

    async uploadFeedbackScreenshot(file) {
      return overrides.uploadFeedbackScreenshot
        ? overrides.uploadFeedbackScreenshot(file)
        : {
            url: `memory://feedback/${encodeURIComponent(file.name)}`
          };
    },

    async submitFeedback(
      submission: FeedbackSubmission
    ) {
      return overrides.submitFeedback
        ? overrides.submitFeedback(submission)
        : {
            id: 1,
            status: 'pending' as const,
            createdAt: '2026-05-17T20:30:00'
          };
    }
  };
}
