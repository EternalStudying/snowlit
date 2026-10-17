import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';

const markdownRenderer = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true
});

export function hasLeadingDiaryTitle(content: string): boolean {
  const firstContentLine = content
    .split(/\r?\n/)
    .find((line) => line.trim());
  return Boolean(
    firstContentLine &&
      /^#(?:\s+.*)?$/.test(firstContentLine.trim())
  );
}

export function ensureDiaryTitleMarkdown(
  content: string,
  fallbackTitle: string
): string {
  if (hasLeadingDiaryTitle(content)) {
    return content;
  }

  const titleText = fallbackTitle.trim();
  return content.trim()
    ? `# ${titleText}\n\n${content}`
    : `# ${titleText}\n\n`;
}

export function stripLeadingDiaryTitle(content: string): string {
  const lines = content.split(/\r?\n/);
  const firstContentIndex = lines.findIndex((line) => line.trim());

  if (
    firstContentIndex === -1 ||
    !/^#(?:\s+.*)?$/.test(lines[firstContentIndex].trim())
  ) {
    return content;
  }

  return lines.slice(firstContentIndex + 1).join('\n').trimStart();
}

export function deriveDiaryTitle(
  content: string,
  fallbackTitle: string
): string {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '#') {
      continue;
    }

    const headingMatch = trimmed.match(/^#\s+(.+)$/);
    const titleText = cleanMarkdownText(headingMatch?.[1] ?? trimmed);
    if (titleText) {
      return titleText.slice(0, 36);
    }
  }

  return fallbackTitle.trim() || '未命名日记';
}

export function renderDiaryMarkdown(source: string): string {
  const normalized = source.replace(
    /==([^=\n][\s\S]*?[^=\n])==/g,
    '<mark>$1</mark>'
  );
  return DOMPurify.sanitize(markdownRenderer.render(normalized || ''), {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['mark'],
    ADD_ATTR: ['class', 'target', 'rel'],
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|blob):|data:image\/|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });
}

export function diaryMarkdownText(content: string): string {
  const template = document.createElement('template');
  template.innerHTML = renderDiaryMarkdown(content);
  return (template.content.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function diaryMarkdownCharacterCount(content: string): number {
  return diaryMarkdownText(content).replace(/\s+/g, '').length;
}

export function diaryMarkdownExcerpt(
  content: string,
  maxLength = 88
): string {
  const text = diaryMarkdownText(stripLeadingDiaryTitle(content));
  return text.length > maxLength
    ? `${text.slice(0, maxLength)}...`
    : text;
}

export function extractDiaryImageSources(content: string): string[] {
  const template = document.createElement('template');
  template.innerHTML = renderDiaryMarkdown(content);
  return Array.from(template.content.querySelectorAll('img'))
    .map((image) => image.getAttribute('src') ?? '')
    .filter(Boolean);
}

function cleanMarkdownText(source: string): string {
  return source
    .replace(/^#+\s*/, '')
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`~=>#-]/g, '')
    .trim();
}
