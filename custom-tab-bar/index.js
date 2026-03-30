'use strict';

const TAB_LIST = [
  {
    key: 'home',
    pagePath: '/pages/home/index',
    text: '首页',
    iconPath: '/assets/tabbar/home.png',
    selectedIconPath: '/assets/tabbar/home-active.png',
  },
  {
    key: 'lobby',
    pagePath: '/pages/lobby/index',
    text: '组队大厅',
    iconPath: '/assets/tabbar/lobby.png',
    selectedIconPath: '/assets/tabbar/lobby-active.png',
  },
  {
    key: 'activities',
    pagePath: '/pages/activities/index',
    text: '活动',
    iconPath: '/assets/tabbar/activities.png',
    selectedIconPath: '/assets/tabbar/activities-active.png',
  },
  {
    key: 'profile',
    pagePath: '/pages/profile/index',
    text: '我的',
    iconPath: '/assets/tabbar/profile.png',
    selectedIconPath: '/assets/tabbar/profile-active.png',
  },
];

function getCurrentRoute() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  if (!currentPage || !currentPage.route) {
    return '';
  }
  return `/${currentPage.route}`;
}

Component({
  data: {
    selectedPath: '',
    tabList: TAB_LIST,
  },

  attached() {
    this.syncSelectedPath();
  },

  ready() {
    this.syncSelectedPath();
  },

  pageLifetimes: {
    show() {
      this.syncSelectedPath();
    },
  },

  methods: {
    syncSelectedPath() {
      this.updateSelected();
      setTimeout(() => {
        this.updateSelected();
      }, 32);
    },

    updateSelected() {
      this.setData({
        selectedPath: getCurrentRoute(),
      });
    },

    switchTab(event) {
      const { path } = event.currentTarget.dataset;
      if (!path || path === this.data.selectedPath) {
        return;
      }
      wx.switchTab({ url: path });
    },
  },
});
