'use strict';

const DEFAULT_TIME = '19:30';
const DATE_OPTION_DAYS = 14;
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getTomorrowDate() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateOption(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const value = `${year}-${month}-${day}`;
  const weekday = WEEKDAY_LABELS[date.getDay()] || '';
  const label = `${month}-${day} ${weekday}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const current = new Date(date.getTime());
  current.setHours(0, 0, 0, 0);
  const deltaDays = Math.round((current.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const hint =
    deltaDays === 1 ? '明天' : deltaDays === 2 ? '后天' : deltaDays > 2 ? `${deltaDays} 天后` : '';
  return {
    value,
    label,
    hint,
  };
}

function buildDateOptions() {
  const result = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let index = 1; index <= DATE_OPTION_DAYS; index += 1) {
    const nextDate = new Date(base.getTime());
    nextDate.setDate(base.getDate() + index);
    const option = formatDateOption(nextDate);
    result.push({
      ...option,
      fullLabel: option.label,
    });
  }
  return result;
}

function buildTimeOptions() {
  const result = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 30) {
      const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      result.push({
        value,
        label: value,
      });
    }
  }
  return result;
}

function resolveDateLabel(dateValue = '', dateOptions = []) {
  const match = (dateOptions || []).find((item) => item.value === dateValue);
  return match ? match.fullLabel : dateValue || '请选择日期';
}

function resolveTimeLabel(timeSlot = '', timeOptions = []) {
  const match = (timeOptions || []).find((item) => item.value === timeSlot);
  return match ? match.label : timeSlot || '请选择时间';
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

function buildViewState(form, isSubmitting, options = {}) {
  const dateOptions = Array.isArray(options.dateOptions) ? options.dateOptions : [];
  const timeOptions = Array.isArray(options.timeOptions) ? options.timeOptions : [];
  return {
    themeLabel: form.themeName || '请选择主题',
    dateLabel: resolveDateLabel(form.dateValue, dateOptions),
    timeLabel: resolveTimeLabel(form.timeSlot, timeOptions),
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
  buildDateOptions,
  buildTimeOptions,
  createDefaultForm,
  buildViewState,
  resolveErrorField,
};
