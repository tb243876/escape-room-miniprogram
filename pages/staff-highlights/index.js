'use strict';

const service = require('../../utils/cloudbase');

Page({
  data: {
    highlights: [],
    errorText: '',
  },

  async onLoad() {
    await this.loadHighlights();
  },

  async loadHighlights() {
    this.setData({
      errorText: '',
    });
    try {
      const response = await service.getStaffHighlights();
      if (!response.ok) {
        this.setData({
          highlights: [],
          errorText: response.message || '集锦库加载失败，请稍后重试',
        });
        return;
      }

      this.setData({
        highlights: response.highlights || [],
      });
    } catch (error) {
      console.error('loadHighlights failed:', error);
      this.setData({
        highlights: [],
        errorText: '集锦库加载失败，请检查网络后重试',
      });
    }
  },

  retryLoad() {
    this.loadHighlights();
  },
});
