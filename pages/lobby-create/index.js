'use strict';

const service = require('../../utils/cloudbase');
const profileService = require('../../utils/domain/profile');
const viewModel = require('./view-model');

Page({
  data: {
    themeOptions: [],
    dateOptions: [],
    timeOptions: [],
    form: viewModel.createDefaultForm(),
    errorText: '',
    errorField: '',
    themePickerVisible: false,
    optionPickerVisible: false,
    optionPickerType: '',
    optionPickerTitle: '',
    optionPickerIndex: [0],
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
      const dateOptions = viewModel.buildDateOptions();
      const timeOptions = viewModel.buildTimeOptions();
      const form = viewModel.createDefaultForm(themes || [], themeId);
      const profile = profileService.getLocalProfile();
      this.setData({
        themeOptions: themes || [],
        dateOptions,
        timeOptions,
        form: {
          ...form,
          contactName: form.contactName || ((profile && profile.nickname) || ''),
          contactPhone: form.contactPhone || ((profile && profile.contactPhone) || ''),
        },
        ...viewModel.buildViewState(form, false, {
          dateOptions,
          timeOptions,
        }),
      });
    } catch (error) {
      this.setData({
        errorText: '主题数据加载失败，请返回重试',
        errorField: '',
      });
    }
  },

  openThemePicker() {
    if (!Array.isArray(this.data.themeOptions) || !this.data.themeOptions.length) {
      return;
    }
    this.setData({
      themePickerVisible: true,
      errorText: this.data.errorField === 'theme' ? '' : this.data.errorText,
      errorField: this.data.errorField === 'theme' ? '' : this.data.errorField,
    });
  },

  openDatePicker() {
    if (!Array.isArray(this.data.dateOptions) || !this.data.dateOptions.length) {
      return;
    }
    const currentIndex = Math.max(
      0,
      this.data.dateOptions.findIndex((item) => item.value === this.data.form.dateValue)
    );
    this.setData({
      optionPickerVisible: true,
      optionPickerType: 'date',
      optionPickerTitle: '选择组局日期',
      optionPickerIndex: [currentIndex >= 0 ? currentIndex : 0],
      errorText: this.data.errorField === 'date' ? '' : this.data.errorText,
      errorField: this.data.errorField === 'date' ? '' : this.data.errorField,
    });
  },

  openTimePicker() {
    if (!Array.isArray(this.data.timeOptions) || !this.data.timeOptions.length) {
      return;
    }
    const currentIndex = Math.max(
      0,
      this.data.timeOptions.findIndex((item) => item.value === this.data.form.timeSlot)
    );
    this.setData({
      optionPickerVisible: true,
      optionPickerType: 'time',
      optionPickerTitle: '选择开场时间',
      optionPickerIndex: [currentIndex >= 0 ? currentIndex : 0],
      errorText: this.data.errorField === 'time' ? '' : this.data.errorText,
      errorField: this.data.errorField === 'time' ? '' : this.data.errorField,
    });
  },

  closeThemePicker() {
    this.setData({
      themePickerVisible: false,
    });
  },

  closeOptionPicker() {
    this.setData({
      optionPickerVisible: false,
      optionPickerType: '',
      optionPickerTitle: '',
      optionPickerIndex: [0],
    });
  },

  selectTheme(event) {
    const themeIndex = Number(event.currentTarget.dataset.index || 0);
    const theme = (this.data.themeOptions || [])[themeIndex] || {};
    this.setData({
      'form.themeIndex': themeIndex,
      'form.themeId': theme.id || '',
      'form.themeName': theme.name || '',
      'form.horror': theme.horror || '',
      errorText: '',
      errorField: '',
      themePickerVisible: false,
    });
    this.syncViewState();
  },

  onOptionPickerChange(event) {
    const nextValue = Array.isArray(event.detail.value) ? event.detail.value : [0];
    this.setData({
      optionPickerIndex: [Math.max(0, Number(nextValue[0] || 0))],
    });
  },

  confirmOptionPicker() {
    const pickerType = String(this.data.optionPickerType || '').trim();
    const currentIndex = Math.max(0, Number((this.data.optionPickerIndex || [0])[0] || 0));
    if (pickerType === 'date') {
      const target = (this.data.dateOptions || [])[currentIndex];
      this.setData({
        'form.dateValue': String((target && target.value) || ''),
        errorText: '',
        errorField: '',
      });
      this.closeOptionPicker();
      this.syncViewState();
      return;
    }
    if (pickerType === 'time') {
      const target = (this.data.timeOptions || [])[currentIndex];
      this.setData({
        'form.timeSlot': String((target && target.value) || ''),
        errorText: '',
        errorField: '',
      });
      this.closeOptionPicker();
      this.syncViewState();
      return;
    }
    this.closeOptionPicker();
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
    this.setData(
      viewModel.buildViewState(this.data.form, this.data.isSubmitting, {
        dateOptions: this.data.dateOptions,
        timeOptions: this.data.timeOptions,
      })
    );
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

  noop() {},
});
