'use strict';

const service = require('../../utils/cloudbase');

const GENDER_OPTIONS = [
  { value: 'not_set', label: '未设置' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
];

Page({
  data: {
    form: {
      avatarUrl: '',
      nickname: '',
      signature: '',
      gender: 'not_set',
    },
    titleLabel: '',
    honorLabels: [],
    errorField: '',
    errorText: '',
    isSubmitting: false,
    genderSheetVisible: false,
  },

  async onLoad() {
    await this.loadProfile();
  },

  async loadProfile() {
    this.setData({
      errorField: '',
      errorText: '',
    });

    try {
      const profile = await service.getProfile();
      this.setData({
        form: {
          avatarUrl: profile.avatarUrl || '',
          nickname: profile.nickname || '',
          signature: profile.signature || '',
          gender: profile.gender || 'not_set',
        },
        titleLabel: profile.titleLabel || '',
        honorLabels: profile.honorLabels || [],
      });
    } catch (error) {
      this.setData({
        errorText: '个人资料加载失败，请返回重试',
      });
    }
  },

  onChooseAvatar(event) {
    const avatarUrl =
      (event.detail && (event.detail.avatarUrl || event.detail.tempFilePath)) || '';

    if (!avatarUrl) {
      return;
    }

    this.setData({
      'form.avatarUrl': avatarUrl,
    });
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset;
    if (!field) {
      return;
    }

    this.setData({
      [`form.${field}`]: event.detail.value,
      errorField: this.data.errorField === field ? '' : this.data.errorField,
      errorText: this.data.errorField === field ? '' : this.data.errorText,
    });
  },

  onGenderChange(event) {
    const index = Number(event.detail.value || 0);
    const option = GENDER_OPTIONS[index] || GENDER_OPTIONS[0];
    this.setData({
      'form.gender': option.value,
    });
  },

  openGenderSheet() {
    this.setData({
      genderSheetVisible: true,
    });
  },

  closeGenderSheet() {
    this.setData({
      genderSheetVisible: false,
    });
  },

  selectGenderOption(event) {
    const { value } = event.currentTarget.dataset;
    const matched = GENDER_OPTIONS.find((item) => item.value === value) || GENDER_OPTIONS[0];
    this.setData({
      'form.gender': matched.value,
      genderSheetVisible: false,
    });
  },

  validateForm() {
    const nickname = String(this.data.form.nickname || '').trim();
    if (!nickname) {
      return {
        ok: false,
        field: 'nickname',
        message: '昵称不能为空',
      };
    }

    if (nickname.length > 12) {
      return {
        ok: false,
        field: 'nickname',
        message: '昵称最多 12 个字',
      };
    }

    if (String(this.data.form.signature || '').trim().length > 40) {
      return {
        ok: false,
        field: 'signature',
        message: '签名最多 40 个字',
      };
    }

    return { ok: true };
  },

  async submitProfile() {
    if (this.data.isSubmitting) {
      return;
    }

    const validation = this.validateForm();
    if (!validation.ok) {
      this.setData({
        errorField: validation.field,
        errorText: validation.message,
      });
      return;
    }

    wx.showLoading({ title: '保存中', mask: true });
    this.setData({
      isSubmitting: true,
      errorField: '',
      errorText: '',
    });

    try {
      const response = await service.updateProfile(this.data.form);
      if (!response.ok) {
        this.setData({
          errorText: response.message || '保存失败，请稍后重试',
        });
        return;
      }

      wx.showToast({
        title: response.message || '已保存',
        icon: 'success',
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 500);
    } catch (error) {
      this.setData({
        errorText: '保存失败，请稍后重试',
      });
    } finally {
      this.setData({ isSubmitting: false });
      wx.hideLoading();
    }
  },

  goBack() {
    wx.navigateBack();
  },

  noop() {},
});
