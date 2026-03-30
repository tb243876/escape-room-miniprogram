'use strict';

const service = require('../../utils/cloudbase');
const perf = require('../../utils/platform/perf');
const viewModel = require('./view-model');

Page({
  data: {
    theme: null,
    errorText: '',
    dialogVisible: false,
    dialogTitle: '',
    dialogContent: '',
    hasLoaded: false,
    themeId: '',
  },

  async onLoad(query) {
    try {
      await this.loadThemeDetail(query, { force: true });
    } catch (error) {
      this.setData({
        theme: null,
        errorText: '主题页初始化失败，请重新进入页面',
      });
    }
  },

  async loadThemeDetail(query = {}, options = {}) {
    const themeId = query.id || this.data.themeId;
    const { force = false } = options;
    if (!themeId) {
      this.setData({
        theme: null,
        errorText: '主题信息缺失，请返回重试',
      });
      return;
    }
    if (this.data.hasLoaded && !force && this.data.themeId === themeId) {
      return;
    }
    this.setData({ errorText: '' });
    try {
      await perf.traceAsync(
        'themeDetail.load',
        async (trace) => {
          const theme = await service.getThemeDetail(themeId);
          perf.stepTrace(trace, 'service.getThemeDetail', { themeId });
          if (!theme) {
            this.setData({
              theme: null,
              errorText: '没有找到这个主题，请返回重新选择',
              hasLoaded: false,
              themeId,
            });
            perf.stepTrace(trace, 'setData.notFound');
            return;
          }
          this.setData({ theme, hasLoaded: true, themeId });
          perf.stepTrace(trace, 'setData.success');
        },
        { themeId: query.id }
      );
      if (!this.data.theme && !this.data.errorText) {
        this.setData({
          theme: null,
          errorText: '没有找到这个主题，请返回重新选择',
          hasLoaded: false,
          themeId,
        });
      }
    } catch (error) {
      this.setData({
        theme: null,
        errorText: '主题加载失败，请检查网络后重试',
        hasLoaded: false,
        themeId,
      });
      wx.showToast({
        title: '主题加载失败',
        icon: 'none',
      });
    }
  },

  goGroup() {
    const themeId = (this.data.theme && this.data.theme.id) || '';
    const query = themeId ? `?themeId=${themeId}` : '';
    wx.navigateTo({ url: `/pages/lobby-create/index${query}` });
  },

  contactStore() {
    this.setData({
      dialogVisible: true,
      dialogTitle: '联系门店',
      dialogContent: '第一版先用表单或加企微承接，这里后续可以接门店电话或客服。',
    });
  },

  retryLoad() {
    this.loadThemeDetail(viewModel.getThemeDetailOptions(), { force: true });
  },

  closeDialog() {
    this.setData({
      dialogVisible: false,
      dialogTitle: '',
      dialogContent: '',
    });
  },

  noop() {},
});
