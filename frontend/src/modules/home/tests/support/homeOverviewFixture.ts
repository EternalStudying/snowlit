import type { HomeOverview } from '../../model';

export const homeOverviewFixture: HomeOverview = {
  couple: {
    boyfriendName: '伴侣 A',
    girlfriendName: '伴侣 B',
    startedOn: '2023-02-14',
    togetherDays: 1188,
    nextAnniversary: {
      name: '520',
      date: '2026-05-20',
      daysUntil: 4,
      type: 'romanticDay'
    }
  },
  dailyNote: {
    date: '2026-05-16',
    sentence: '今天适合把喜欢说得更认真一点。',
    weatherHint: '适合一起听歌',
    activityHint: '留一张晚安小纸条'
  },
  personStatuses: [
    {
      role: 'boyfriend',
      name: '伴侣 A',
      city: '示例城市 B',
      weather: '多云',
      temperature: 18,
      mood: '专注模式',
      note: '写代码中...',
      lastOnlineAt: '2026-05-16T20:30:00'
    },
    {
      role: 'girlfriend',
      name: '伴侣 B',
      city: '示例城市 A',
      weather: '晴',
      temperature: 19,
      mood: '心情很好',
      note: '正在处理一些小事',
      lastOnlineAt: '2026-05-16T20:20:00'
    }
  ],
  distance: {
    kilometers: 819.4,
    label: '相距 819.4 公里',
    status: 'ready',
    updatedAt: '2026-05-16T20:30:00'
  },
  latest: {
    diary: {
      id: 1,
      title: '第一次看海',
      entryDate: '2026-05-01',
      content: '傍晚的海风很温柔，我们走了很久。',
      tag: '旅行'
    },
    photo: {
      id: 1,
      previewUrl: 'https://example.com/photo.jpg',
      caption: '周末约会',
      takenAt: '2026-05-01'
    },
    wish: {
      id: 1,
      title: '一起去看海',
      done: false
    },
    message: {
      id: 1,
      authorName: '伴侣 B',
      content: '晚点一起看相册。',
      createdAt: '2026-05-16T12:00:00'
    }
  },
  stats: {
    photoCount: 1,
    messageCount: 1,
    wishCount: 1,
    completedWishCount: 0
  }
};
