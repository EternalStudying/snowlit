import type { AlbumPreviewGenerator } from './ports';

const PREVIEW_LONG_EDGE = 2560;
const PREVIEW_QUALITY = 0.82;

export const encodeCanvasWebpPreview: AlbumPreviewGenerator = async (file) => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PREVIEW_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法生成预览图');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('无法生成预览图'));
      }
    }, 'image/webp', PREVIEW_QUALITY);
  });

  const extensionIndex = file.name.lastIndexOf('.');
  const baseName = extensionIndex > 0 ? file.name.slice(0, extensionIndex) : file.name;
  return {
    file: new File([blob], `${baseName || 'photo'}.webp`, { type: 'image/webp' }),
    width,
    height
  };
};
