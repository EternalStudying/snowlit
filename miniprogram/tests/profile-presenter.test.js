const assert = require('node:assert/strict');

const { mapAccountRows, mapCurrentUser, mapNotice } = require('../pages/profile/profile-presenter');

function runCurrentUserMappingTest() {
  const user = mapCurrentUser({
    id: 2,
    username: 'member_b',
    displayName: '伴侣 B',
    coupleRole: 'girlfriend',
    bio: '记录小日子',
    mood: '开心',
    updatedAt: '2026-05-27T20:16:00'
  });

  assert.deepEqual(user, {
    id: 2,
    initial: '伴',
    username: 'member_b',
    displayName: '伴侣 B',
    coupleRole: 'girlfriend',
    coupleRoleLabel: 'GIRLFRIEND',
    mood: '开心',
    bio: '记录小日子',
    updatedAt: '2026.05.27 20:16'
  });
}

function runAccountRowsMappingTest() {
  const rows = mapAccountRows({
    id: 2,
    coupleRole: 'girlfriend',
    canManage: true
  });

  assert.deepEqual(rows.map((row) => ({ label: row.label, value: row.value })), [
    { label: '用户 ID', value: '2' },
    { label: '情侣角色', value: 'girlfriend' },
    { label: '管理权限', value: '可管理' },
    { label: '登录状态', value: '已登录' }
  ]);
}

function runNoticeMappingTest() {
  const notice = mapNotice({
    shouldShow: false,
    notice: {
      title: 'v2.1.0 完成啦',
      version: '2.1.0',
      publishedAt: '2026-05-25T22:39:00',
      items: ['优化了点滴地图体验', '修复了一些已知问题', '第三条不展示在卡片']
    }
  });

  assert.deepEqual(notice, {
    version: 'v2.1.0',
    title: 'v2.1.0 完成啦',
    publishedAt: '2026.05.25 发布',
    item: '优化了点滴地图体验',
    modalContent: '· 优化了点滴地图体验\n· 修复了一些已知问题\n· 第三条不展示在卡片'
  });
}

runCurrentUserMappingTest();
runAccountRowsMappingTest();
runNoticeMappingTest();

console.log('profile-presenter tests passed');
