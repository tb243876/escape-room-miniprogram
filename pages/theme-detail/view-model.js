'use strict';

function getThemeDetailOptions() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] || {};
  return currentPage.options || {};
}

module.exports = {
  getThemeDetailOptions,
};
