'use strict';

function getCurrentSeasonId(date = new Date()) {
  const currentDate = date instanceof Date ? date : new Date(date);
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

module.exports = {
  getCurrentSeasonId,
};
