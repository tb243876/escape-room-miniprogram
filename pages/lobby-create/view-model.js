'use strict';

const DEFAULT_TIME = '19:30';

function getTomorrowDate() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDefaultForm(themeOptions = [], themeId = '') {
  const themeIndex = Math.max(
    0,
    themeOptions.findIndex((item) => item.id === themeId)
  );
  const targetTheme = themeOptions[themeIndex] || {};
  return {
    themeIndex,
    themeId: targetTheme.id || '',
    themeName: targetTheme.name || '',
    horror: targetTheme.horror || '',
    dateValue: getTomorrowDate(),
    timeSlot: DEFAULT_TIME,
    currentPeople: '1',
    targetPeople: '4',
    contactName: '',
    contactPhone: '',
    note: '',
  };
}

function buildViewState(form, isSubmitting) {
  return {
    themeLabel: form.themeName || '请选择主题',
    dateLabel: form.dateValue || '请选择日期',
    timeLabel: form.timeSlot || '请选择时间',
    submitText: isSubmitting ? '发布中...' : '确认发布',
    submitClass: isSubmitting ? 'button-disabled' : '',
  };
}

function resolveErrorField(message = '') {
  if (message.includes('主题')) {
    return 'theme';
  }
  if (message.includes('日期')) {
    return 'date';
  }
  if (message.includes('时间')) {
    return 'time';
  }
  if (message.includes('称呼')) {
    return 'contactName';
  }
  if (message.includes('手机号')) {
    return 'contactPhone';
  }
  if (message.includes('目标人数')) {
    return 'targetPeople';
  }
  return '';
}

module.exports = {
  createDefaultForm,
  buildViewState,
  resolveErrorField,
};
