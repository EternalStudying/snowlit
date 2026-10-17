const IMAGE_PATTERN = /!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)|<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
const INLINE_TOKEN_PATTERN = /!\[([^\]]*)]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|==([\s\S]+?)==|`([^`\n]+)`|\*([^*\n]+)\*|_([^_\n]+)_|(https?:\/\/[^\s<]+)/g;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeUrl(value) {
  const url = clean(value);
  return /^(https?:\/\/|wxfile:\/\/|data:image\/|\/)/i.test(url) ? url : '';
}

function createTextNode(value) {
  return {
    type: 'text',
    text: value
  };
}

function createElementNode(name, children, attrs) {
  return {
    name,
    attrs: attrs || {},
    children: children && children.length ? children : []
  };
}

function decodeMarkdownEscapes(value) {
  return String(value || '').replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, '$1');
}

function normalizeInlineSource(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<(del|s)[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~')
    .replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '==$1==')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<[^>]+>/g, '');
}

function stripInlineMarkdown(value) {
  return normalizeInlineSource(value)
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .replace(/__([\s\S]*?)__/g, '$1')
    .replace(/~~([\s\S]*?)~~/g, '$1')
    .replace(/==([\s\S]*?)==/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/(^|\s)[*_]+/g, '$1')
    .replace(/[*_]+(\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function appendTextNodes(nodes, value) {
  const parts = decodeMarkdownEscapes(value).split('\n');
  parts.forEach((part, index) => {
    if (index > 0) {
      nodes.push(createElementNode('br'));
    }
    if (part) {
      nodes.push(createTextNode(part));
    }
  });
}

function styledSpan(children, style) {
  return createElementNode('span', children, { style });
}

function parseInlineNodes(value) {
  const source = normalizeInlineSource(value);
  const nodes = [];
  const tokenPattern = new RegExp(INLINE_TOKEN_PATTERN.source, 'g');
  let cursor = 0;
  let match;

  while ((match = tokenPattern.exec(source))) {
    appendTextNodes(nodes, source.slice(cursor, match.index));

    if (match[1] !== undefined) {
      const src = safeUrl(match[2]);
      if (src) {
        nodes.push(createElementNode('img', [], {
          src,
          alt: stripInlineMarkdown(match[1] || '')
        }));
      }
    } else if (match[3] !== undefined) {
      const href = safeUrl(match[4]);
      const children = parseInlineNodes(match[3]);
      nodes.push(href
        ? createElementNode('a', children, {
          href,
          style: 'color:#5f493f;text-decoration:underline;'
        })
        : createElementNode('span', children));
    } else if (match[5] !== undefined || match[6] !== undefined) {
      nodes.push(createElementNode('strong', parseInlineNodes(match[5] || match[6])));
    } else if (match[7] !== undefined) {
      nodes.push(createElementNode('del', parseInlineNodes(match[7])));
    } else if (match[8] !== undefined) {
      nodes.push(styledSpan(parseInlineNodes(match[8]), 'background:rgba(255,222,132,0.68);border-radius:4rpx;'));
    } else if (match[9] !== undefined) {
      nodes.push(createElementNode('code', [createTextNode(decodeMarkdownEscapes(match[9]))], {
        style: 'padding:2rpx 8rpx;border-radius:999rpx;background:rgba(255,239,210,0.72);'
      }));
    } else if (match[10] !== undefined || match[11] !== undefined) {
      nodes.push(createElementNode('em', parseInlineNodes(match[10] || match[11])));
    } else if (match[12] !== undefined) {
      nodes.push(createElementNode('a', [createTextNode(match[12])], {
        href: safeUrl(match[12]),
        style: 'color:#5f493f;text-decoration:underline;'
      }));
    }

    cursor = match.index + match[0].length;
  }

  appendTextNodes(nodes, source.slice(cursor));
  return nodes;
}

function textPayload(value) {
  return {
    text: stripInlineMarkdown(value),
    nodes: parseInlineNodes(value)
  };
}

function createBlock(blocks, type, payload) {
  blocks.push({
    key: `${type}-${blocks.length}`,
    type,
    ...payload
  });
}

function flushParagraph(blocks, paragraphLines) {
  const source = paragraphLines.filter((line) => stripInlineMarkdown(line)).join('\n');
  paragraphLines.length = 0;

  if (stripInlineMarkdown(source)) {
    createBlock(blocks, 'paragraph', textPayload(source));
  }
}

function parseImageLine(line, blocks, paragraphLines) {
  let cursor = 0;
  let match;

  IMAGE_PATTERN.lastIndex = 0;
  while ((match = IMAGE_PATTERN.exec(line))) {
    const before = line.slice(cursor, match.index);
    if (stripInlineMarkdown(before)) {
      paragraphLines.push(before);
    }
    flushParagraph(blocks, paragraphLines);

    const url = safeUrl(match[2] || match[3]);
    if (url) {
      createBlock(blocks, 'image', {
        url,
        alt: stripInlineMarkdown(match[1] || '')
      });
    }
    cursor = match.index + match[0].length;
  }

  const after = line.slice(cursor);
  if (stripInlineMarkdown(after)) {
    paragraphLines.push(after);
  }
}

function shouldSkipLeadingTitle(line, hasSeenContent) {
  return !hasSeenContent && /^#(?:\s+.*)?$/.test(clean(line));
}

function isFenceStart(line) {
  return clean(line).match(/^(`{3,}|~{3,})(.*)$/);
}

function isFenceEnd(line, fence) {
  return clean(line).startsWith(fence);
}

function isTableRow(line) {
  return clean(line).includes('|');
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(clean(cell)));
}

function isTableStart(lines, index) {
  return isTableRow(lines[index]) && index + 1 < lines.length && isTableSeparator(lines[index + 1]);
}

function splitTableRow(line) {
  const trimmed = clean(line).replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function parseTable(lines, startIndex, blocks) {
  const tableRows = [splitTableRow(lines[startIndex])];
  let index = startIndex + 2;

  while (index < lines.length && isTableRow(lines[index]) && clean(lines[index])) {
    tableRows.push(splitTableRow(lines[index]));
    index += 1;
  }

  createBlock(blocks, 'table', {
    rows: tableRows.map((row, rowIndex) => ({
      key: `row-${rowIndex}`,
      header: rowIndex === 0,
      cells: row.map((cell, cellIndex) => ({
        key: `cell-${rowIndex}-${cellIndex}`,
        ...textPayload(cell)
      }))
    }))
  });

  return index;
}

function matchListItem(line) {
  const unordered = clean(line).match(/^[-*+]\s+(.+)$/);
  if (unordered) {
    return {
      ordered: false,
      marker: '•',
      text: unordered[1]
    };
  }

  const ordered = clean(line).match(/^(\d+)\.\s+(.+)$/);
  if (ordered) {
    return {
      ordered: true,
      marker: `${ordered[1]}.`,
      text: ordered[2]
    };
  }

  return null;
}

function parseList(lines, startIndex, blocks) {
  const first = matchListItem(lines[startIndex]);
  const items = [];
  let index = startIndex;

  while (index < lines.length) {
    const item = matchListItem(lines[index]);
    if (!item || item.ordered !== first.ordered) {
      break;
    }
    items.push({
      key: `item-${items.length}`,
      marker: item.ordered ? item.marker : '•',
      ...textPayload(item.text)
    });
    index += 1;
  }

  createBlock(blocks, 'list', {
    ordered: first.ordered,
    items
  });
  return index;
}

function parseQuote(lines, startIndex, blocks) {
  const quoteLines = [];
  let index = startIndex;

  while (index < lines.length && /^>\s?/.test(clean(lines[index]))) {
    quoteLines.push(clean(lines[index]).replace(/^>\s?/, ''));
    index += 1;
  }

  createBlock(blocks, 'quote', textPayload(quoteLines.join('\n')));
  return index;
}

function appendFallbackImages(blocks, imageUrls) {
  const known = new Set(blocks.filter((block) => block.type === 'image').map((block) => block.url));
  imageUrls.forEach((url) => {
    const cleanUrl = safeUrl(url);
    if (cleanUrl && !known.has(cleanUrl)) {
      known.add(cleanUrl);
      createBlock(blocks, 'image', {
        url: cleanUrl,
        alt: ''
      });
    }
  });
}

function applySpacing(blocks) {
  return blocks.map((block, index) => {
    const previous = blocks[index - 1];
    let spacing = 'spaced';

    if (index === 0) {
      spacing = 'first';
    } else if (block.type === 'image' && previous && ['paragraph', 'quote', 'list'].includes(previous.type)) {
      spacing = 'tight';
    }

    return {
      ...block,
      spacing
    };
  });
}

function parseDiaryMarkdown(content, options) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const imageUrls = Array.isArray(options && options.imageUrls) ? options.imageUrls : [];
  const blocks = [];
  const paragraphLines = [];
  let hasSeenContent = false;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = clean(line);

    if (!trimmed) {
      flushParagraph(blocks, paragraphLines);
      index += 1;
      continue;
    }

    if (shouldSkipLeadingTitle(trimmed, hasSeenContent)) {
      hasSeenContent = true;
      index += 1;
      continue;
    }

    hasSeenContent = true;

    const fence = isFenceStart(trimmed);
    if (fence) {
      flushParagraph(blocks, paragraphLines);
      const fenceText = fence[1];
      const codeLines = [];
      index += 1;
      while (index < lines.length && !isFenceEnd(lines[index], fenceText)) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      createBlock(blocks, 'code', {
        text: codeLines.join('\n')
      });
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushParagraph(blocks, paragraphLines);
      createBlock(blocks, 'hr', {});
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      flushParagraph(blocks, paragraphLines);
      index = parseTable(lines, index, blocks);
      continue;
    }

    IMAGE_PATTERN.lastIndex = 0;
    if (IMAGE_PATTERN.test(trimmed)) {
      parseImageLine(trimmed, blocks, paragraphLines);
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(blocks, paragraphLines);
      createBlock(blocks, 'heading', {
        level: heading[1].length,
        ...textPayload(heading[2])
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph(blocks, paragraphLines);
      index = parseQuote(lines, index, blocks);
      continue;
    }

    if (matchListItem(trimmed)) {
      flushParagraph(blocks, paragraphLines);
      index = parseList(lines, index, blocks);
      continue;
    }

    paragraphLines.push(trimmed);
    index += 1;
  }

  flushParagraph(blocks, paragraphLines);
  appendFallbackImages(blocks, imageUrls);

  if (!blocks.length) {
    createBlock(blocks, 'paragraph', textPayload('这篇日记暂时没有正文。'));
  }

  return applySpacing(blocks);
}

module.exports = {
  parseDiaryMarkdown
};
