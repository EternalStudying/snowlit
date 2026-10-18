import { describe, expect, it } from 'vitest';
import { IMAGE_RULE_MESSAGE, MAX_IMAGE_BYTES, isAcceptedImage, pickImages } from '../src/imageFiles';

function file(name: string, type: string, size = 10) {
  const value = new File(['x'], name, { type });
  Object.defineProperty(value, 'size', { value: size });
  return value;
}

describe('image picking rule', () => {
  it('accepts jpg, png, webp and gif up to 10MB by type or extension', () => {
    expect(isAcceptedImage(file('a.jpg', 'image/jpeg'))).toBe(true);
    expect(isAcceptedImage(file('a.gif', 'image/gif'))).toBe(true);
    expect(isAcceptedImage(file('a.webp', ''))).toBe(true);
    expect(isAcceptedImage(file('tmp', 'image/png'))).toBe(true);
    expect(isAcceptedImage(file('a.png', 'image/png', MAX_IMAGE_BYTES))).toBe(true);
  });

  it('rejects other types and files over 10MB', () => {
    expect(isAcceptedImage(file('a.heic', 'image/heic'))).toBe(false);
    expect(isAcceptedImage(file('notes.txt', 'text/plain'))).toBe(false);
    expect(isAcceptedImage(file('a.png', 'image/png', MAX_IMAGE_BYTES + 1))).toBe(false);
  });

  it('splits a mixed selection and reports the shared rule', () => {
    const good = file('a.jpg', 'image/jpeg');
    const picked = pickImages([good, { file: file('b.txt', 'text/plain') } as never, { file: null } as never]);

    expect(picked.accepted).toEqual([good]);
    expect(picked.rejection).toBe(IMAGE_RULE_MESSAGE);
    expect(pickImages([good]).rejection).toBe('');
    expect(pickImages(null)).toEqual({ accepted: [], rejection: '' });
  });
});
