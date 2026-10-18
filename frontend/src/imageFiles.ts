import type { UploadFileInfo } from 'naive-ui';

/**
 * What the backend accepts as an uploaded image: JPEG, PNG, WebP or GIF up to 10MB. The backend decides
 * by file content; the browser checks type or extension and size so a bad pick fails before uploading.
 */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';
export const IMAGE_RULE_MESSAGE = '只支持 jpg、png、webp、gif，单张不超过 10MB';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif)$/i;

export function isAcceptedImage(file: File): boolean {
  return (IMAGE_TYPES.has(file.type) || IMAGE_EXTENSION.test(file.name)) && file.size <= MAX_IMAGE_BYTES;
}

export interface PickedImages {
  accepted: File[];
  /** IMAGE_RULE_MESSAGE when at least one picked file was rejected, otherwise empty. */
  rejection: string;
}

/**
 * Splits a selection from a file input, a Naive UI upload list, paste or drop into accepted images and a
 * rejection message.
 */
export function pickImages(source: FileList | Iterable<File | UploadFileInfo> | null | undefined): PickedImages {
  const files = Array.from(source ?? [], (item) => (item instanceof File ? item : item.file)).filter(
    (file): file is File => file instanceof File
  );
  const accepted = files.filter(isAcceptedImage);
  return { accepted, rejection: accepted.length < files.length ? IMAGE_RULE_MESSAGE : '' };
}
