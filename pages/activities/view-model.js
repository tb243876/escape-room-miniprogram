'use strict';

function enrichActivities(activities) {
  return (activities || []).map((item, index) => ({
    ...item,
    railClass: index % 2 === 0 ? 'activity-rail-warm' : 'activity-rail-dark',
    cardClass: index % 2 === 0 ? 'activity-card-warm' : 'activity-card-plain',
  }));
}

module.exports = {
  enrichActivities,
};
