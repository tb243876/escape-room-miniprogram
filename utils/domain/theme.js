'use strict';

function normalizeActivityStatus(status) {
  const statusMap = {
    running: '进行中',
    upcoming: '即将开始',
    ended: '已结束',
    closed: '已结束',
  };
  return statusMap[String(status || '').trim()] || String(status || '').trim() || '活动中';
}

function normalizeActivityItem(item) {
  return {
    ...item,
    status: normalizeActivityStatus(item.status),
  };
}

function groupThemesByHorror(themes) {
  const order = ['微恐', '中恐', '重恐'];
  return order
    .map((title) => ({
      title,
      items: themes.filter((item) => item.horror === title),
    }))
    .filter((group) => group.items.length);
}

function matchesThemeKeyword(item, keyword) {
  const normalizedKeyword = String(keyword || '')
    .trim()
    .toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  const haystacks = [
    item.name,
    item.slogan,
    item.story,
    item.horror,
    item.difficulty,
    item.people,
    item.duration,
    ...(item.tags || []),
    ...(item.highlights || []),
  ];

  return haystacks.some((value) =>
    String(value || '')
      .toLowerCase()
      .includes(normalizedKeyword)
  );
}

function filterThemes(list, filters = {}) {
  let result = Array.isArray(list) ? list.slice() : [];
  if (filters.keyword) {
    result = result.filter((item) => matchesThemeKeyword(item, filters.keyword));
  }
  if (filters.tag && filters.tag !== '全部') {
    result = result.filter((item) => (item.tags || []).includes(filters.tag));
  }
  return result;
}

function inferHorrorStars(item) {
  const explicitStars = Number(item && item.horrorStars);
  if (Number.isFinite(explicitStars) && explicitStars > 0) {
    return explicitStars;
  }

  const horror = String((item && item.horror) || '').trim();
  if (horror === '微恐') {
    return 1;
  }
  if (horror === '中恐') {
    return 3;
  }
  if (horror === '重恐') {
    return 5;
  }
  return 0;
}

function enrichTheme(item) {
  const horrorStars = Math.max(0, Math.min(5, inferHorrorStars(item)));
  return {
    ...item,
    id: item.id || item._id || '',
    horrorStars,
    horrorStarsText: `${'★'.repeat(horrorStars)}${'☆'.repeat(5 - horrorStars)}`,
    horrorStarsFilledText: '★'.repeat(horrorStars),
    horrorStarsEmptyText: '☆'.repeat(5 - horrorStars),
  };
}

module.exports = {
  normalizeActivityItem,
  groupThemesByHorror,
  filterThemes,
  enrichTheme,
};
