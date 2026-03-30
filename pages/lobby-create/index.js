'use strict';

const service = require('../../utils/cloudbase');
const profileService = require('../../utils/domain/profile');
const viewModel = require('./view-model');

Page({
  data: {
    themeOptions: [],
    form: viewModel.createDefaultForm(),
    errorText: '',
    errorField: '',
    isSubmitting: false,
    themeLabel: '请选择主题',
    dateLabel: '请选择日期',
    timeLabel: '请选择时间',
    submitText: '确认发布',
    submitClass: '',
  },

  async onLoad(query = {}) {
    await this.loadThemes(query.themeId || '');
  },

  async loadThemes(themeId) {
    try {
      const themes = await service.getThemes();
      const form = viewModel.createDefaultForm(themes || [], themeId);
      const profile = profileService.getLocalProfile();
      this.setData({
        themeOptions: themes || [],
        form: {
          ...form,
          contactName: form.contactName || ((profile && profile.nickname) || ''),
          contactPhone: form.contactPhone || ((profile && profile.contactPhone) || ''),
        },
        ...viewModel.buildViewState(form, false),
      });
    } catch (error) {
      this.setData({
        errorText: '主题数据加载失败，请返回重试',
        errorField: '',
      });
    }
  },

  onThemeChange(event) {
    const themeIndex = Number(event.detail.value || 0);
    const theme = (this.data.themeOptions || [])[themeIndex] || {};
    this.setData({
      'form.themeIndex': themeIndex,
      'form.themeId': theme.id || '',
      'form.themeName': theme.name || '',
      'form.horror': theme.horror || '',
      errorText: '',
      errorField: '',
    });
    this.syncViewState();
  },

  onDateChange(event) {
    this.setData({
      'form.dateValue': event.detail.value,
      errorText: '',
      errorField: '',
    });
    this.syncViewState();
  },

  onTimeChange(event) {
    this.setData({
      'form.timeSlot': event.detail.value,
      errorText: '',
      errorField: '',
    });
    this.syncViewState();
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: event.detail.value,
      errorText: '',
      errorField: '',
    });
  },

  syncViewState() {
    this.setData(viewModel.buildViewState(this.data.form, this.data.isSubmitting));
  },

  async submitCreate() {
    if (this.data.isSubmitting) {
      return;
    }
    this.setData({
      isSubmitting: true,
      errorText: '',
      errorField: '',
    });
    this.syncViewState();
    wx.showLoading({ title: '发布中', mask: true });
    try {
      const response = await service.createGroup(this.data.form);
      if (!response.ok) {
        this.setData({
          errorText: response.message || '组局发布失败，请稍后重试',
          errorField: viewModel.resolveErrorField(response.message || ''),
        });
        return;
      }
      wx.showToast({
        title: '组局已发布',
        icon: 'success',
      });
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/lobby/index',
        });
      }, 300);
    } catch (error) {
      this.setData({
        errorText: '组局发布失败，请检查网络后重试',
        errorField: '',
      });
    } finally {
      this.setData({ isSubmitting: false });
      this.syncViewState();
      wx.hideLoading();
    }
  },
});
