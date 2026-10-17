function setActiveTabBar(selected) {
  if (typeof getCurrentPages !== 'function') {
    return;
  }
  const pages = getCurrentPages();
  const page = pages && pages.length ? pages[pages.length - 1] : null;
  if (!page || typeof page.getTabBar !== 'function') {
    return;
  }
  const tabBar = page.getTabBar();
  if (tabBar && tabBar.data && tabBar.data.selected !== selected) {
    tabBar.setData({ selected });
  }
}

module.exports = {
  setActiveTabBar
};
