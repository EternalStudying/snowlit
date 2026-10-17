const tabs = [
  {
    text: '首页',
    pagePath: '/pages/index/index',
    iconPath: '/assets/icons/tabbar/home.png',
    selectedIconPath: '/assets/icons/tabbar/home-active.png'
  },
  {
    text: '日记',
    pagePath: '/pages/diary/index',
    iconPath: '/assets/icons/tabbar/notebook-text.png',
    selectedIconPath: '/assets/icons/tabbar/notebook-text-active.png'
  },
  {
    text: '相册',
    pagePath: '/pages/albums/index',
    iconPath: '/assets/icons/tabbar/image.png',
    selectedIconPath: '/assets/icons/tabbar/image-active.png'
  },
  {
    text: '清单',
    pagePath: '/pages/wishes/index',
    iconPath: '/assets/icons/tabbar/clipboard-list.png',
    selectedIconPath: '/assets/icons/tabbar/clipboard-list-active.png'
  },
  {
    text: '我的',
    pagePath: '/pages/profile/index',
    iconPath: '/assets/icons/tabbar/user-round.png',
    selectedIconPath: '/assets/icons/tabbar/user-round-active.png'
  }
];

Component({
  data: {
    selected: 0,
    tabs
  },

  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const tab = this.data.tabs[index];
      if (!tab || index === this.data.selected) {
        return;
      }
      wx.switchTab({ url: tab.pagePath });
    }
  }
});
