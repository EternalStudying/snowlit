const { formatDate, formatDateTime } = require('../../utils/date');
const { isManagerUser } = require('../../utils/permission');

function firstText() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = arguments[index];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function firstInitial(value) {
  const text = firstText(value, 'S');
  return Array.from(text)[0] || 'S';
}

function roleLabel(role) {
  if (role === 'boyfriend') {
    return 'BOYFRIEND';
  }
  if (role === 'girlfriend') {
    return 'GIRLFRIEND';
  }
  return 'SNOWLIT';
}

function formatDotDateTime(value) {
  return formatDateTime(value).replace(/-/g, '.');
}

function formatDotDate(value) {
  return formatDate(value).replace(/-/g, '.');
}

function mapCurrentUser(response) {
  const user = response || {};
  const displayName = firstText(user.displayName, user.username, 'Snowlit');
  return {
    id: user.id || '',
    initial: firstInitial(displayName),
    username: firstText(user.username, 'snowlit'),
    displayName,
    coupleRole: firstText(user.coupleRole, 'unknown'),
    coupleRoleLabel: roleLabel(user.coupleRole),
    mood: firstText(user.mood, '未设置'),
    bio: firstText(user.bio, '还没有简介'),
    updatedAt: formatDotDateTime(user.updatedAt) || '待更新'
  };
}

function mapAccountRows(user) {
  const currentUser = user || {};
  return [
    {
      label: '用户 ID',
      value: String(currentUser.id || '--'),
      icon: '../../assets/icons/tabbar/user-round.svg'
    },
    {
      label: '情侣角色',
      value: firstText(currentUser.coupleRole, '--'),
      icon: '../../assets/icons/albums/heart.svg'
    },
    {
      label: '管理权限',
      value: isManagerUser(currentUser) ? '可管理' : '只读',
      icon: '../../assets/icons/profile/shield-check.svg'
    },
    {
      label: '登录状态',
      value: '已登录',
      icon: '../../assets/icons/profile/shield-check.svg'
    }
  ];
}

function mapNotice(response) {
  const notice = response && response.notice;
  if (!notice) {
    return {
      version: '暂无公告',
      title: '还没有新的更新公告',
      publishedAt: '',
      item: '稍后有新内容会在这里展示。',
      modalContent: '暂无公告'
    };
  }

  const items = Array.isArray(notice.items) ? notice.items.filter(Boolean) : [];
  return {
    version: notice.version ? `v${notice.version}` : '公告',
    title: firstText(notice.title, '更新公告'),
    publishedAt: formatDotDate(notice.publishedAt) ? `${formatDotDate(notice.publishedAt)} 发布` : '',
    item: firstText(items[0], '查看本次更新内容'),
    modalContent: items.length ? items.map((item) => `· ${item}`).join('\n') : '暂无更新条目'
  };
}

module.exports = {
  mapAccountRows,
  mapCurrentUser,
  mapNotice
};
