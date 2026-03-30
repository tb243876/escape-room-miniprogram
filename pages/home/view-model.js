'use strict';

function getLevelClassName(title) {
  if (title === '微恐') {
    return 'level-block-light';
  }
  if (title === '中恐') {
    return 'level-block-medium';
  }
  return 'level-block-heavy';
}

function getLevelNote(title) {
  if (title === '微恐') {
    return '适合入门';
  }
  if (title === '中恐') {
    return '进阶推荐';
  }
  return '强刺激档';
}

function enrichThemeItem(item) {
  const people = item.people || '';
  const duration = item.duration || '';
  const metaText = people && duration ? `${people} · ${duration}` : `${people}${duration}`;
  return {
    ...item,
    metaText,
  };
}

function enrichThemeGroups(themeGroups) {
  return (themeGroups || []).map((group) => ({
    ...group,
    blockClass: getLevelClassName(group.title),
    levelNote: getLevelNote(group.title),
    items: (group.items || []).map(enrichThemeItem),
  }));
}

function enrichQuickActions(quickActions) {
  return (quickActions || []).map((item) => ({
    ...item,
    quickClass: `quick-card-${item.key || ''}`,
    kicker: item.key === 'member' ? '个人记录' : '近期安排',
  }));
}

function flattenThemeGroups(themeGroups) {
  return (themeGroups || []).reduce((result, group) => result.concat(group.items || []), []);
}

function buildSearchThemes(items) {
  return (items || []).map((item) => ({
    ...enrichThemeItem(item),
    name: item.name || '',
    slogan: item.slogan || '',
    people: item.people || '',
    duration: item.duration || '',
    coverImage: item.coverImage || '/assets/themes/shixiong.jpeg',
  }));
}

function pickFeaturedTheme(themeGroups) {
  const themes = flattenThemeGroups(themeGroups);
  if (!themes.length) {
    return null;
  }

  const rankedThemes = themes
    .slice()
    .sort((left, right) => {
      const rightStars = Number(right.horrorStars || 0);
      const leftStars = Number(left.horrorStars || 0);
      if (rightStars !== leftStars) {
        return rightStars - leftStars;
      }
      return String(left.name || '').localeCompare(String(right.name || ''), 'zh-Hans-CN');
    });

  return enrichThemeItem(rankedThemes[0]);
}

module.exports = {
  enrichThemeGroups,
  enrichQuickActions,
  flattenThemeGroups,
  buildSearchThemes,
  pickFeaturedTheme,
};
