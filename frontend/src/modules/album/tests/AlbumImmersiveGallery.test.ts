import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AlbumImmersiveGallery from '../components/AlbumImmersiveGallery.vue';
import type { AlbumCollection, AlbumPhoto } from '../model';
import { publicPhoto } from './fixtures';

const photos: AlbumPhoto[] = [1, 2, 3].map((index) => ({
  ...publicPhoto,
  id: publicPhoto.id + index,
  cardId: `photo-${index}`,
  source: 'api',
  url: `https://example.com/album-${index}.jpg`,
  date: '2026-04-16'
}));

const collection: AlbumCollection = {
  id: 'album-1',
  albumId: 1,
  title: '海边',
  description: '',
  author: '伴侣 A',
  avatarLabel: 'A',
  date: '2026-04-16',
  location: '法国·尼斯',
  views: 0,
  likes: 0,
  likedToday: false,
  photoCount: photos.length,
  visibility: 'public',
  locked: false,
  isPrivate: false,
  pinned: false,
  sortOrder: 1,
  coverPhotoUrl: photos[0].url,
  photos,
  previewPhotos: photos,
  remainingCount: 0
};

let screenWidth = 1280;
const widthListeners = new Set<() => void>();

function stubMatchMedia() {
  vi.stubGlobal('matchMedia', (query: string) => {
    const maxWidth = /max-width:\s*(\d+)px/.exec(query);
    return {
      get matches() {
        return maxWidth ? screenWidth <= Number(maxWidth[1]) : false;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => {
        if (maxWidth) widthListeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => widthListeners.delete(listener),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    };
  });
}

function resizeTo(width: number) {
  screenWidth = width;
  widthListeners.forEach((listener) => listener());
}

async function mountGallery() {
  const wrapper = mount(AlbumImmersiveGallery, {
    props: { collection, photos },
    attachTo: document.body
  });
  await flushPromises();
  return wrapper;
}

function gallery() {
  return document.body.querySelector<HTMLElement>('.album-immersive-gallery')!;
}

function photoButtons() {
  return Array.from(document.body.querySelectorAll<HTMLElement>('.album-immersive-gallery__photo'));
}

describe('AlbumImmersiveGallery', () => {
  beforeEach(() => {
    screenWidth = 1280;
    widthListeners.clear();
    stubMatchMedia();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('shows every photo as a plain list on a phone-width screen', async () => {
    screenWidth = 390;
    const wrapper = await mountGallery();

    expect(gallery().dataset.layout).toBe('stacked');
    expect(photoButtons()).toHaveLength(photos.length);
    for (const photo of photoButtons()) {
      expect(photo.style.visibility).not.toBe('hidden');
      expect(photo.style.transform).toBe('');
    }

    wrapper.unmount();
  });

  it('keeps the depth-scroll timeline on a wide screen', async () => {
    const wrapper = await mountGallery();

    expect(gallery().dataset.layout).toBe('timeline');
    expect(photoButtons()[0].style.visibility).toBe('hidden');

    wrapper.unmount();
  });

  it('drops the timeline when the screen narrows to phone width', async () => {
    const wrapper = await mountGallery();
    expect(gallery().dataset.layout).toBe('timeline');

    resizeTo(390);
    await flushPromises();

    expect(gallery().dataset.layout).toBe('stacked');
    for (const photo of photoButtons()) {
      expect(photo.style.visibility).not.toBe('hidden');
      expect(photo.style.transform).toBe('');
    }

    wrapper.unmount();
  });
});
