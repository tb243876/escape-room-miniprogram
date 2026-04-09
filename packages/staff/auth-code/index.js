'use strict';

const service = require('../../../utils/cloudbase');
const staffService = require('../../../utils/domain/staff');

Page({
  data: {
    code: '',
    errorText: '',
    isSubmitting: false,
  },

  onInput(event) {
    this.setData({
      code: event.detail.value,
      errorText: '',
    });
  },

  async submitCode() {
    if (this.data.isSubmitting) {
      return;
    }

    this.setData({
      isSubmitting: true,
      errorText: '',
    });
    wx.showLoading({ title: '绑定中', mask: true });
    try {
      console.info('[staff-auth] submit.start', {
        code: String(this.data.code || '').trim().toUpperCase(),
      });
      const response = await service.redeemStaffAuthCode(this.data.code);
      console.info('[staff-auth] submit.response', response || {});
      if (!response.ok) {
        this.setData({
          errorText: response.message || '授权失败，请稍后重试',
        });
        console.warn('[staff-auth] submit.failed', {
          errorText: response.message || '',
        });
        return;
      }
      wx.showToast({
        title: '授权成功',
        icon: 'success',
      });
      staffService.saveLocalStaffBinding(response.binding);
      setTimeout(() => {
        wx.redirectTo({
          url: '/packages/staff/dashboard/index',
        });
      }, 300);
    } catch (error) {
      console.error('[staff-auth] submit.exception', {
        message: error && error.message,
        stack: error && error.stack,
        raw: error,
      });
      this.setData({
        errorText: '授权失败，请检查网络后重试',
      });
    } finally {
      this.setData({ isSubmitting: false });
      wx.hideLoading();
    }
  },
});
