'use strict';

const service = require('../../utils/cloudbase');
const viewModel = require('./view-model');

Page({
  data: {
    keyword: '',
    activeTag: '全部',
    filterTags: viewModel.FILTER_TAGS,
    themes: [],
    errorText: '',
    isSubmitting: false,
    hasLoaded: false,
  },

  async onLoad() {
    try {
      await this.loadThemes({ force: true });
    } catch (error) {
      this.setData({
        themes: [],
        errorText: '主题页初始化失败，请重新进入页面',
      });
    }
  },

  async loadThemes(options = {}) {
    const { force = false } = options;
    if (this.data.hasLoaded && !force) {
      return;
    }
    this.setData({ errorText: '' });
    try {
      const themes = await service.getThemes({
        keyword: this.data.keyword,
        tag: this.data.activeTag,
      });
      this.setData({ themes: themes || [], hasLoaded: true });
    } catch (error) {
      this.setData({
        themes: [],
        errorText: '主题加载失败，请检查网络后重试',
        hasLoaded: false,
      });
      wx.showToast({
        title: '主题加载失败',
        icon: 'none',
      });
    }
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
  },

  async onSearch() {
    if (this.data.isSubmitting) {
      return;
    }
    this.setData({ isSubmitting: true });
    try {
      await this.loadThemes({ force: true });
    } finally {
      this.setData({ isSubmitting: false });
    }
  },

  async chooseTag(event) {
    this.setData({ activeTag: event.currentTarget.dataset.tag });
    await this.loadThemes({ force: true });
  },

  openTheme(event) {
    wx.navigateTo({ url: `/pages/theme-detail/index?id=${event.currentTarget.dataset.id}` });
  },

  retryLoad() {
    this.loadThemes({ force: true });
  },
});
