import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Naive UI migration boundaries', () => {
  it('installs naive-ui and wraps the app in themed Naive providers', () => {
    const packageJson = JSON.parse(readSource('package.json')) as { dependencies?: Record<string, string> };
    const appSource = readSource('src/App.vue');
    const themePath = resolve(process.cwd(), 'src/styles/naive-theme.ts');

    expect(packageJson.dependencies).toHaveProperty('naive-ui');
    expect(existsSync(themePath)).toBe(true);
    expect(appSource).toContain("from './styles/naive-theme'");
    expect(appSource).toContain('NConfigProvider');
    expect(appSource).toContain('zhCN');
    expect(appSource).toContain('dateZhCN');
    expect(appSource).toContain(':locale="zhCN"');
    expect(appSource).toContain(':date-locale="dateZhCN"');
    expect(appSource).toContain('NMessageProvider');
    expect(appSource).toContain('NDialogProvider');
    expect(appSource).toContain('NNotificationProvider');
    expect(appSource).toContain('NGlobalStyle');
  });

  it('keeps a Snowlit paper theme instead of default Naive system styling', () => {
    const themeSource = readSource('src/styles/naive-theme.ts');

    expect(themeSource).toContain('GlobalThemeOverrides');
    expect(themeSource).toContain('snowlitNaiveTheme');
    expect(themeSource).toContain('primaryColor');
    expect(themeSource).toContain('Button');
    expect(themeSource).toContain('Input');
    expect(themeSource).toContain('Modal');
    expect(themeSource).toContain('Upload');
    expect(themeSource).toContain('Tooltip');
    expect(themeSource).toContain('#f7efe1');
    expect(themeSource).not.toContain('#18a058');
  });

  it('migrates P0 login and feedback controls to Naive UI while messages keeps the bubble wall split', () => {
    const loginSource = readSource('src/modules/login/LoginView.vue');
    const messagesSource = readSource('src/modules/messages/MessagesView.vue');
    const messageWallSource = readSource('src/modules/messages/components/MessageBubbleWall.vue');
    const messageComposerSource = readSource('src/modules/messages/components/MessageComposer.vue');
    const messageModalSource = readSource('src/modules/messages/components/MessageDetailModal.vue');
    const feedbackSource = readSource('src/modules/support/SupportCenter.vue');

    expect(loginSource).toContain('NInput');
    expect(loginSource).toContain('NButton');
    expect(loginSource).toContain('NAlert');
    expect(loginSource).not.toContain('<input v-model="username"');
    expect(loginSource).not.toContain('<input\n            v-model="password"');

    expect(messagesSource).toContain('MessageBubbleWall');
    expect(messagesSource).toContain('MessageDetailModal');
    expect(messageWallSource).toContain('MessageBubble');
    expect(messageWallSource).toContain('MessageComposer');
    expect(messageComposerSource).toContain('data-message-input');
    expect(messageComposerSource).toContain('data-message-submit');
    expect(messageModalSource).toContain('data-message-detail-modal');
    expect(messagesSource).not.toContain('NImage');
    expect(messageWallSource).not.toContain('<img');
    expect(messagesSource).not.toContain('<textarea\n        v-model="content"');

    expect(feedbackSource).toContain('NModal');
    expect(feedbackSource).toContain('NSelect');
    expect(feedbackSource).toContain('NInput');
    expect(feedbackSource).toContain('NUpload');
    expect(feedbackSource).toContain('NButton');
    expect(feedbackSource).toContain('NAlert');
    expect(feedbackSource).toContain('useMessage');
    expect(feedbackSource).toContain('default-upload="false"');
  });

  it('migrates safe P1 form controls while preserving custom visual cores', () => {
    const wishesSource = readSource('src/modules/wishes/WishesView.vue');
    const diaryViewSource = readSource('src/modules/diary/DiaryView.vue');
    const diarySource = readSource('src/modules/diary/components/DiaryMarkdownEditor.vue');
    const storyViewSource = readSource('src/modules/story/StoryView.vue');
    const storyEditorSource = readSource('src/modules/story/components/MomentEditorDialog.vue');
    const storyMapSource = readSource('src/modules/story/components/StoryMapCanvas.vue');

    expect(wishesSource).toContain('NModal');
    expect(wishesSource).toContain('NInput');
    expect(wishesSource).toContain('NDatePicker');
    expect(wishesSource).toContain('NButton');
    expect(wishesSource).toContain('NUpload');
    expect(wishesSource).toContain('data-smooth-scroll-prevent');

    expect(diarySource).toContain('NInput');
    expect(diarySource).toContain('NSelect');
    expect(diarySource).toContain('NDatePicker');
    expect(diarySource).toContain('NUpload');
    expect(diarySource).toContain('NButton');
    expect(diarySource).toContain('<textarea');
    expect(diaryViewSource).toContain('NButton');

    expect(storyViewSource).toContain('NButton');
    expect(storyEditorSource).toContain('NInput');
    expect(storyEditorSource).toContain('NDatePicker');
    expect(storyEditorSource).toContain('NUpload');
    expect(storyEditorSource).toContain('NButton');
    expect(storyEditorSource).toContain('default-upload="false"');

    expect(storyMapSource).not.toContain('NModal');
    expect(storyMapSource).not.toContain('NDrawer');
  });

  it('does not show the bottom clear action in date picker panels', () => {
    const datePickerSources = [
      readSource('src/modules/wishes/WishesView.vue'),
      readSource('src/modules/diary/components/DiaryMarkdownEditor.vue'),
      readSource('src/modules/story/components/MomentEditorDialog.vue')
    ];
    const combinedSource = datePickerSources.join('\n');

    expect(combinedSource).not.toContain(`:actions="['clear', 'confirm']"`);
    expect(combinedSource).not.toContain(`:actions="['clear']"`);
    expect(combinedSource.match(/:actions="\['confirm'\]"/g)).toHaveLength(4);
  });

  it('keeps button-style upload click targets constrained to the visible control', () => {
    const feedbackSource = readSource('src/modules/support/SupportCenter.vue');
    const feedbackCss = readSource('src/modules/support/support.css');
    const messageComposerSource = readSource('src/modules/messages/components/MessageComposer.vue');

    expect(feedbackSource).not.toContain('<label class="feedback-dialog__upload">');
    expect(feedbackSource).toContain('<div class="feedback-dialog__upload">');
    expect(feedbackSource).toContain('class="feedback-dialog__screenshot-picker"');
    expect(feedbackCss).toMatch(/\.feedback-dialog__screenshot-picker,\s*\n\.feedback-dialog__screenshot-picker \.n-upload-trigger\s*{[^}]*width:\s*fit-content;/);
    expect(messageComposerSource).toContain('class="hidden-input"');
    expect(messageComposerSource).toContain('class="icon-btn"');
    expect(messageComposerSource).toContain('@click="triggerFileInput"');
    expect(messageComposerSource).not.toContain('<label');
  });
});
