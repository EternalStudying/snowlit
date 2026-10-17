import {
  createSessionRequest,
  sessionRequest,
  type HttpAdapter
} from '../../../http/sessionRequest';
import type {
  FeedbackScreenshotReceipt,
  FeedbackSubmission,
  FeedbackSubmissionReceipt,
  UpdateNoticeEnvelope,
  UpdateNoticeMuteReceipt
} from '../model';
import type { SupportGateway } from './ports';

export interface HttpSupportGatewayOptions {
  adapter?: HttpAdapter;
}

export function createHttpSupportGateway({
  adapter
}: HttpSupportGatewayOptions = {}): SupportGateway {
  const request = adapter
    ? createSessionRequest({ adapter })
    : sessionRequest;

  return {
    fetchUpdateNotice() {
      return request.json<UpdateNoticeEnvelope>({
        path: '/api/update-notice',
        failure: {
          message: '更新公告暂时不可用',
          responseMessage: 'ignore'
        }
      });
    },

    muteUpdateNoticeToday() {
      return request.json<UpdateNoticeMuteReceipt>({
        path: '/api/update-notice/mute-today',
        method: 'POST',
        failure: {
          message: '今日不再提示设置失败',
          responseMessage: 'ignore'
        }
      });
    },

    uploadFeedbackScreenshot(file) {
      const formData = new FormData();
      formData.append('file', file);
      return request.json<FeedbackScreenshotReceipt>({
        path: '/api/feedback/screenshots',
        method: 'POST',
        body: { kind: 'form', value: formData },
        failure: {
          message: '截图上传失败',
          responseMessage: 'prefer'
        }
      });
    },

    submitFeedback(submission: FeedbackSubmission) {
      return request.json<FeedbackSubmissionReceipt>({
        path: '/api/feedback',
        method: 'POST',
        body: { kind: 'json', value: submission },
        failure: {
          message: '反馈提交失败',
          responseMessage: 'prefer'
        }
      });
    }
  };
}
