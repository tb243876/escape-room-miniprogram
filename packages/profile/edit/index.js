'use strict';

const service = require('../../../utils/cloudbase');

const GENDER_OPTIONS = [
  { value: 'not_set', label: '未设置' },
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
];

function normalizeDisplayLabels(labels = [], availableLabels = []) {
  const availableSet = new Set((availableLabels || []).map((item) => String(item || '').trim()).filter(Boolean));
  const normalized = [];
  (Array.isArray(labels) ? labels : []).forEach((item) => {
    const label = String(item || '').trim();
    if (!label || !availableSet.has(label) || normalized.includes(label)) {
      return;
    }
    normalized.push(label);
  });
  return normalized.slice(0, 3);
}

function buildDisplayOptions(availableLabels = [], selectedLabels = []) {
  const selectedSet = new Set(selectedLabels);
  const selectedCount = selectedLabels.length;
  return availableLabels.map((label) => ({
    label,
    selected: selectedSet.has(label),
    disabled: !selectedSet.has(label) && selectedCount >= 3,
  }));
}

Page({
  data: {
    form: {
      avatarUrl: '',
      nickname: '',
      signature: '',
      gender: 'not_set',
      displayLabels: [],
    },
    titleLabel: '',
    honorLabels: [],
    displayOptions: [],
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
      const availableLabels = Array.isArray(profile.availableDisplayLabels)
        ? profile.availableDisplayLabels
        : (profile.honorLabels || []).filter(Boolean);
      const hasCustomDisplayLabels = Object.prototype.hasOwnProperty.call(profile || {}, 'displayLabels');
      const selectedLabels = normalizeDisplayLabels(
        hasCustomDisplayLabels ? profile.displayLabels : [],
        availableLabels
      );
      this.setData({
        form: {
          avatarUrl: profile.avatarUrl || '',
          nickname: profile.nickname || '',
          signature: profile.signature || '',
          gender: profile.gender || 'not_set',
          displayLabels: selectedLabels,
        },
        titleLabel: profile.titleLabel || '',
        honorLabels: profile.honorLabels || [],
        displayOptions: buildDisplayOptions(availableLabels, selectedLabels),
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

  toggleDisplayLabel(event) {
    const label = String((event.currentTarget.dataset && event.currentTarget.dataset.label) || '').trim();
    if (!label) {
      return;
    }
    const availableLabels = this.data.displayOptions.map((item) => item.label);
    const currentSelected = normalizeDisplayLabels(this.data.form.displayLabels, availableLabels);
    let nextSelected = currentSelected.slice();
    if (nextSelected.includes(label)) {
      nextSelected = nextSelected.filter((item) => item !== label);
    } else {
      if (nextSelected.length >= 3) {
        wx.showToast({
          title: '最多展示 3 个',
          icon: 'none',
        });
        return;
      }
      nextSelected.push(label);
    }
    this.setData({
      'form.displayLabels': nextSelected,
      displayOptions: buildDisplayOptions(availableLabels, nextSelected),
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
