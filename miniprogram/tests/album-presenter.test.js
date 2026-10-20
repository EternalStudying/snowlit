const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  mapAlbumDetail,
  mapAlbumPage,
  updateAlbumLikeCount,
  updateAlbumViewCount
} = require('../pages/albums/album-presenter');

function runAlbumPageMappingTest() {
  const result = mapAlbumPage({
    items: [
      {
        id: 1,
        title: '见面出游',
        description: '把见面那几天的光都收好。',
        coverPhotoUrl: 'https://snowlit.example.com/media/album/1/cover.webp',
        authorName: '伴侣 B',
        eventDate: '2026-04-16',
        location: '示例城市',
        photoCount: 14,
        viewCount: 21,
        likeCount: 3,
        likedToday: true,
        visibility: 'public',
        locked: false,
        pinned: true,
        previewPhotos: [
          { previewUrl: 'https://snowlit.example.com/media/album/1/preview-a.webp' },
          { previewUrl: 'https://snowlit.example.com/media/album/1/preview-b.webp' }
        ]
      },
      {
        id: 2,
        title: '私密时光',
        description: '已锁定',
        authorName: '',
        eventDate: '2026-05-10',
        location: '地球',
        photoCount: 8,
        viewCount: 7,
        likeCount: 4,
        visibility: 'private',
        locked: true,
        pinned: false,
        previewPhotos: []
      }
    ],
    total: 2,
    page: 1,
    size: 5,
    hasMore: false,
    canManage: true
  });

  assert.equal(result.totalText, '共 2 本相册');
  assert.equal(result.hasMore, false);
  assert.equal(result.canManage, true);
  assert.deepEqual(result.items[0], {
    id: 1,
    title: '见面出游',
    description: '把见面那几天的光都收好。',
    meta: '04.16 · 示例城市 · 伴侣 B',
    stats: [
      { type: 'photos', icon: '../../assets/icons/home/image.svg', value: '14' },
      { type: 'views', icon: '../../assets/icons/albums/eye.svg', value: '21' },
      { type: 'likes', icon: '../../assets/icons/albums/heart.svg', value: '3', active: true }
    ],
    likedToday: true,
    pinned: true,
    locked: false,
    layout: 'cover',
    isStrip: false,
    cover: 'https://snowlit.example.com/media/album/1/cover.webp'
  });
  assert.equal(result.items[1].locked, true);
  assert.equal(result.items[1].layout, 'locked');
  assert.equal(result.items[1].stats[2].active, false);
}

function runAlbumDetailMappingTest() {
  const detail = mapAlbumDetail({
    album: {
      id: 1,
      title: '见面出游',
      description: '把见面那几天的光都收好。',
      coverPhotoUrl: 'https://snowlit.example.com/media/album/1/cover.webp',
      authorName: '伴侣 B',
      eventDate: '2026-04-16',
      location: '示例城市',
      photoCount: 2,
      viewCount: 21,
      likeCount: 3,
      likedToday: true,
      visibility: 'public',
      locked: false,
      pinned: true
    },
    photos: [
      {
        id: 101,
        previewUrl: 'https://snowlit.example.com/media/album/1/photo-a.webp',
        originalUrl: 'https://snowlit.example.com/media/album/1/original-a.jpg',
        caption: '海边日落',
        takenAt: '2026-04-16',
        location: '示例城市'
      },
      {
        id: 102,
        previewUrl: 'https://snowlit.example.com/media/album/1/photo-b.webp',
        originalUrl: '',
        caption: '',
        takenAt: '',
        location: ''
      }
    ]
  });

  assert.equal(detail.id, 1);
  assert.deepEqual(detail.badges, ['公开', '置顶']);
  assert.equal(detail.cover, 'https://snowlit.example.com/media/album/1/cover.webp');
  assert.equal(detail.hasCover, true);
  assert.equal(detail.likedToday, true);
  assert.equal(detail.stats[2].active, true);
  assert.equal(detail.eventDate, '2026.04.16');
  assert.equal(detail.photosCountText, '2 张');
  assert.equal(detail.hasPhotos, true);
  assert.deepEqual(detail.photos[0], {
    id: 101,
    url: 'https://snowlit.example.com/media/album/1/photo-a.webp',
    previewUrl: 'https://snowlit.example.com/media/album/1/photo-a.webp',
    originalUrl: 'https://snowlit.example.com/media/album/1/original-a.jpg',
    caption: '海边日落',
    meta: '04.16 · 示例城市'
  });
  assert.equal(detail.photos[1].caption, '未命名照片');
  assert.equal(detail.photos[1].meta, '');
}

function runCountUpdateTests() {
  const album = mapAlbumDetail({
    album: {
      id: 1,
      title: '见面出游',
      photoCount: 2,
      viewCount: 21,
      likeCount: 3,
      visibility: 'public',
      locked: false,
      pinned: false
    },
    photos: []
  });

  assert.equal(updateAlbumViewCount(album, 22).stats[1].value, '22');
  const liked = updateAlbumLikeCount(album, 4, true);
  const unliked = updateAlbumLikeCount(liked, 3, false);
  assert.equal(liked.stats[2].value, '4');
  assert.equal(liked.stats[2].active, true);
  assert.equal(liked.likedToday, true);
  assert.equal(unliked.stats[2].value, '3');
  assert.equal(unliked.stats[2].active, false);
  assert.equal(unliked.likedToday, false);
}

function runAlbumLikeActiveTemplateTest() {
  const listWxml = fs.readFileSync(path.join(__dirname, '../pages/albums/index.wxml'), 'utf8');
  const listWxss = fs.readFileSync(path.join(__dirname, '../pages/albums/index.wxss'), 'utf8');
  const detailWxml = fs.readFileSync(path.join(__dirname, '../pages/album-detail/index.wxml'), 'utf8');
  const detailWxss = fs.readFileSync(path.join(__dirname, '../pages/album-detail/index.wxss'), 'utf8');

  assert.match(listWxml, /album-stat--active/);
  assert.match(listWxss, /\.album-stat--active/);
  assert.match(detailWxml, /stat-cell--active/);
  assert.match(detailWxml, /stat-cell--loading/);
  assert.match(detailWxss, /\.stat-cell--active/);
  assert.match(detailWxss, /\.stat-cell--loading/);
}

function runAlbumDetailPhotoRatioStyleTest() {
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/album-detail/index.wxss'), 'utf8');
  assert.match(wxss, /\.cover-frame\s*\{[\s\S]*height:\s*409rpx;/);
  assert.match(wxss, /\.photo-image\s*\{[\s\S]*height:\s*199rpx;/);
}

function runAlbumDetailCoverTemplateTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/album-detail/index.wxml'), 'utf8');
  assert.equal(wxml.includes('src="{{album.cover}}"'), true);
  assert.equal(wxml.includes('cover-side'), false);
}

function runAlbumListPrivateBadgeTemplateTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/albums/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(__dirname, '../pages/albums/index.wxss'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../pages/albums/index.js'), 'utf8');
  assert.equal(wxml.includes('class="album-title-row"'), true);
  assert.equal(wxml.includes('class="album-title-badges"'), true);
  assert.equal(wxml.includes('class="album-title-badge"'), true);
  assert.match(wxml, /<view class="album-title-row">[\s\S]*<view class="album-title">\{\{item\.title\}\}<\/view>[\s\S]*<view class="album-title-badges" wx:if="\{\{item\.pinned \|\| item\.locked\}\}">[\s\S]*<view wx:if="\{\{item\.pinned\}\}" class="album-title-badge album-title-badge--pinned">置顶<\/view>[\s\S]*<view wx:if="\{\{item\.locked\}\}" class="album-title-badge">私密<\/view>[\s\S]*<\/view>[\s\S]*<\/view>/);
  assert.equal(wxml.includes('class="album-badges"'), false);
  assert.equal(wxml.includes('<view wx:if="{{item.pinned}}" class="album-badge">置顶</view>'), false);
  assert.equal(wxml.includes('<view wx:if="{{item.locked}}" class="album-badge">私密</view>'), false);
  assert.equal(wxml.includes('class="album-add"'), true);
  assert.equal(wxml.includes('wx:if="{{canManage}}" bindtap="goCreate"'), true);
  assert.match(wxss, /\.album-add\s*\{[\s\S]*width:\s*68rpx;[\s\S]*height:\s*68rpx;/);
  assert.match(wxss, /\.album-add\s*\{[\s\S]*bottom:\s*calc\(142rpx \+ env\(safe-area-inset-bottom\)\);/);
  assert.match(js, /canManage:\s*false/);
  assert.match(js, /canManage:\s*reset \? pageData\.canManage/);
  assert.match(js, /goCreate\(\)/);
}

function runAlbumDetailHeaderTemplateTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/album-detail/index.wxml'), 'utf8');
  const detailHead = wxml.match(/<view class="[^"]*album-head[^"]*"[\s\S]*?<view class="album-badges">/);
  assert.ok(detailHead, 'album detail header should exist');
  assert.equal(detailHead[0].includes('SNOWLIT'), false);
  assert.equal(detailHead[0].includes('class="snowlit-subpage-brand">相册'), true);
  assert.equal(detailHead[0].includes('class="snowlit-subpage-title">{{album.title}}'), true);
  assert.equal(detailHead[0].includes('class="snowlit-subpage-subtitle">{{album.description}}'), true);
  assert.equal(detailHead[0].includes('snowlit-page-heading'), false);
}

function runPrivateAlbumHeaderTemplateTest() {
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/album-detail/index.wxml'), 'utf8');
  const lockedBlock = wxml.match(/<view class="[^"]*album-locked[^"]*"[\s\S]*?<\/view>\s*<view class="album-state"/);
  assert.ok(lockedBlock, 'private album locked block should exist');
  assert.equal(lockedBlock[0].includes('album-brand'), false);
  assert.equal(lockedBlock[0].includes('class="snowlit-subpage-brand">私密相册'), true);
  assert.equal(lockedBlock[0].includes('class="snowlit-subpage-title snowlit-kai">私密相册'), true);
  assert.equal(lockedBlock[0].includes('class="snowlit-subpage-subtitle snowlit-kai">输入密码后继续查看照片'), true);
  assert.equal(lockedBlock[0].includes('snowlit-page-heading'), false);
}

runAlbumPageMappingTest();
runAlbumDetailMappingTest();
runCountUpdateTests();
runAlbumDetailPhotoRatioStyleTest();
runAlbumDetailCoverTemplateTest();
runAlbumLikeActiveTemplateTest();
runAlbumListPrivateBadgeTemplateTest();
runAlbumDetailHeaderTemplateTest();
runPrivateAlbumHeaderTemplateTest();

console.log('album-presenter tests passed');
