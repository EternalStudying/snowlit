const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { mapWishDetail, mapWishPage } = require('../pages/wishes/wish-presenter');

const PENDING_PLACEHOLDER = '../../assets/wishes/pending-placeholder.webp';

function runPendingPageMappingTest() {
  const result = mapWishPage({
    items: [
      {
        id: 1,
        title: '一起去海边看日落',
        category: 'want_go',
        completed: false,
        lastOperatedByUserId: 1,
        createdAt: '2026-05-16T10:00:00'
      },
      {
        id: 2,
        title: '春天一起赏樱',
        category: 'want_go',
        completed: false,
        lastOperatedByUserId: 2,
        createdAt: ''
      }
    ],
    total: 12,
    page: 1,
    size: 2,
    hasMore: true,
    canManage: true
  }, 'pending');

  assert.equal(result.totalText, '12 条');
  assert.equal(result.hasMore, true);
  assert.equal(result.canManage, true);
  assert.deepEqual(result.items, [
    {
      id: 1,
      title: '一起去海边看日落',
      createdDate: '05.16'
    },
    {
      id: 2,
      title: '春天一起赏樱',
      createdDate: '--.--'
    }
  ]);
}

function runPendingPageIgnoresImageTest() {
  const result = mapWishPage({
    items: [
      {
        id: 8,
        title: '一起去集市买花',
        imageUrl: 'https://snowlit.example.com/media/wish/market.webp',
        createdAt: '2026-05-18T10:00:00'
      }
    ],
    total: 1,
    page: 1,
    hasMore: false
  }, 'pending');

  assert.deepEqual(result.items, [
    {
      id: 8,
      title: '一起去集市买花',
      createdDate: '05.18'
    }
  ]);
}

function runCompletedPageMappingTest() {
  const result = mapWishPage({
    items: [
      {
        id: 3,
        title: '一起做一次蛋糕',
        category: 'want_do',
        completed: true,
        lastOperatedByUserId: 1,
        imageUrl: 'https://snowlit.example.com/media/wish/cake.webp',
        completedAt: '2026-05-11T20:00:00'
      }
    ],
    total: 1,
    page: 1,
    size: 10,
    hasMore: false
  }, 'completed');

  assert.equal(result.totalText, '1 条');
  assert.equal(result.hasMore, false);
  assert.deepEqual(result.items, [
    {
      id: 3,
      title: '一起做一次蛋糕',
      image: 'https://snowlit.example.com/media/wish/cake.webp',
      completedDate: '05.11'
    }
  ]);
}

function runWishDetailMappingTest() {
  const result = mapWishDetail({
    id: 3,
    title: '一起做一次蛋糕',
    description: '第一次一起认真做甜点。',
    category: 'want_do',
    completed: true,
    lastOperatedByUserId: 1,
    imageUrl: 'https://snowlit.example.com/media/wish/cake.webp',
    locationName: '家里厨房',
    latitude: 10.2754,
    longitude: 20.1652,
    note: '蛋糕很好吃。',
    createdAt: '2026-04-04T10:00:00',
    completedAt: '2026-05-11T20:00:00'
  }, { canManage: true });

  assert.deepEqual(result, {
    id: 3,
    title: '一起做一次蛋糕',
    description: '第一次一起认真做甜点。',
    category: 'want_do',
    categoryLabel: 'WANT TO DO',
    completed: true,
    completedLabel: '已完成',
    statusActionText: '恢复',
    image: 'https://snowlit.example.com/media/wish/cake.webp',
    completedDateLabel: '完成时间',
    expectedDate: '待补充',
    locationLabel: '地点',
    locationName: '家里厨房',
    coordinate: '10.275 / 20.165',
    note: '蛋糕很好吃。',
    createdDate: '2026.04.04',
    completedDate: '2026.05.11',
    createdTime: '2026.04.04 10:00',
    completedTime: '2026.05.11 20:00',
    canEdit: true
  });
}

function runPendingWishDetailUsesPlaceholderTest() {
  const result = mapWishDetail({
    id: 9,
    title: '一起去露营',
    description: '等天气好的时候出发。',
    category: 'want_go',
    completed: false,
    lastOperatedByUserId: 2,
    imageUrl: '',
    locationName: '新西兰皇后镇营地',
    expectedCompletedAt: '2026-06-01T18:00:00',
    createdAt: '2026-05-20T09:00:00'
  });

  assert.equal(result.image, PENDING_PLACEHOLDER);
  assert.equal(result.completedLabel, '未完成');
  assert.equal(result.statusActionText, '完成');
  assert.equal(result.completedDateLabel, '预计完成时间');
  assert.equal(result.completedDate, '2026.06.01');
  assert.equal(result.locationLabel, '预计地点');
  assert.equal(result.locationName, '新西兰皇后镇营地');
  assert.equal(result.canEdit, false);
}

function runPendingPlaceholderAssetTest() {
  const assetPath = path.join(__dirname, '..', 'assets', 'wishes', 'pending-placeholder.webp');
  const stat = fs.statSync(assetPath);

  assert.equal(stat.size < 80 * 1024, true, 'pending placeholder should stay small enough for the mini-program package');
}

runPendingPageMappingTest();
runPendingPageIgnoresImageTest();
runCompletedPageMappingTest();
runWishDetailMappingTest();
runPendingWishDetailUsesPlaceholderTest();
runPendingPlaceholderAssetTest();

console.log('wish-presenter tests passed');
