'use strict';

const service = require('../../utils/cloudbase');
const perf = require('../../utils/platform/perf');
const viewModel = require('./view-model');

Page({
  data: {
    hero: {},
    keyword: '',
    themeGroups: [],
    searchingThemes: [],
    isSearching: false,
    isLoading: false,
    errorText: '',
    hasLoaded: false,
  },
  allThemes: [],

  async onLoad() {
    console.info('[home] onLoad');
    try {
      await this.loadHomeData({ force: true });
    } catch (error) {
      console.error('home onLoad failed:', error);
      this.setData({
        isLoading: false,
        errorText: '首页初始化失败，请重新进入页面',
      });
    }
  },

  async loadHomeData(options = {}) {
    const { force = false } = options;
    if (this.data.hasLoaded && !force) {
      return;
    }
    console.info('[home] loadHomeData.start');
    this.setData({ isLoading: true, errorText: '' });
    try {
      await perf.traceAsync('home.loadHomeData', async (trace) => {
        const data = await service.getHomeData();
        console.info('[home] loadHomeData.service.success', {
          themeGroupCount: ((data && data.themeGroups) || []).length,
          heroTitle: data && data.hero ? data.hero.title : '',
        });
        perf.stepTrace(trace, 'service.getHomeData');
        this.allThemes = viewModel.flattenThemeGroups(data.themeGroups);
        this.setData({
          hero: data.hero || {},
          themeGroups: viewModel.enrichThemeGroups(data.themeGroups),
          searchingThemes: [],
          isLoading: false,
          hasLoaded: true,
        });
        perf.stepTrace(trace, 'setData');
      });
    } catch (error) {
      console.error('[home] loadHomeData.failed', {
        message: error && error.message,
        stack: error && error.stack,
        raw: error,
      });
      this.setData({
        isLoading: false,
        errorText: '首页加载失败，请检查网络或云开发配置后重试',
        themeGroups: [],
        hasLoaded: false,
      });
      wx.showToast({
        title: '首页加载失败',
        icon: 'none',
      });
    } finally {
      console.info('[home] loadHomeData.finally');
    }
  },

  onKeywordInput(event) {
    const trace = perf.startTrace('home.searchThemes');
    const keyword = (event.detail && event.detail.value) || '';
    this.setData({ keyword });

    if (!keyword.trim()) {
      this.setData({
        isSearching: false,
        searchingThemes: [],
      });
      perf.endTrace(trace, { status: 'empty-keyword' });
      return;
    }

    const searchingThemes = service.filterThemes(this.allThemes || [], { keyword });
    perf.stepTrace(trace, 'filterThemes', { count: searchingThemes.length });

    this.setData({
      isSearching: true,
      searchingThemes: viewModel.buildSearchThemes(searchingThemes),
    });
    perf.endTrace(trace, { status: 'ok', count: searchingThemes.length });
  },

  clearSearch() {
    this.setData({
      keyword: '',
      isSearching: false,
      searchingThemes: [],
    });
  },

  openTheme(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/theme-detail/index?id=${id}` });
  },

  goActivities() {
    wx.switchTab({ url: '/pages/activities/index' });
  },

  goLobby() {
    wx.switchTab({ url: '/pages/lobby/index' });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/index' });
  },

  retryLoad() {
    this.loadHomeData({ force: true });
  },
});
