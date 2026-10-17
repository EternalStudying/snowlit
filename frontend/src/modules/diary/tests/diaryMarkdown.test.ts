import { describe, expect, it } from 'vitest';
import {
  deriveDiaryTitle,
  diaryMarkdownCharacterCount,
  diaryMarkdownExcerpt,
  ensureDiaryTitleMarkdown,
  extractDiaryImageSources,
  renderDiaryMarkdown,
  stripLeadingDiaryTitle
} from '../internal/markdown';

describe('Diary Markdown rules', () => {
  it('标题补全、提取和剥离使用同一套首行规则', () => {
    expect(
      ensureDiaryTitleMarkdown('正文', '今天的光')
    ).toBe('# 今天的光\n\n正文');
    expect(
      ensureDiaryTitleMarkdown('# 已有标题\n\n正文', '备用')
    ).toBe('# 已有标题\n\n正文');
    expect(
      deriveDiaryTitle('  \n# **加粗标题**\n\n正文', '')
    ).toBe('加粗标题');
    expect(
      stripLeadingDiaryTitle('# 今天的光\n\n正文')
    ).toBe('正文');
  });

  it('高亮和图片按编辑器与详情共用规则渲染并清理危险脚本', () => {
    const html = renderDiaryMarkdown(
      '==高亮==\n\n![图](https://cdn.example.com/a.webp)\n\n<script>alert(1)</script>'
    );

    expect(html).toContain('<mark>高亮</mark>');
    expect(html).toContain(
      'src="https://cdn.example.com/a.webp"'
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
  });

  it('摘要、字数和图片提取都基于清理后的 Markdown 内容', () => {
    const markdown =
      '# 标题\n\n**你好** 世界\n\n![图](https://cdn.example.com/a.webp)';

    expect(diaryMarkdownCharacterCount(markdown)).toBe(6);
    expect(diaryMarkdownExcerpt(markdown)).toBe('你好 世界');
    expect(extractDiaryImageSources(markdown)).toEqual([
      'https://cdn.example.com/a.webp'
    ]);
  });
});
