'use strict';

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const themes = [
  {
    id: 'theme-tonglingren',
    name: '瞳灵人',
    horrorLevel: '重恐',
    horrorStars: 5,
    players: '5-8人',
    duration: '90分钟',
    slogan: '废弃的瞳灵人研究室内，藏着不为人知的秘密...',
    coverImage: '/assets/themes/tonglingren.jpeg',
    status: 'online',
    sort: 1,
  },
  {
    id: 'theme-wenchuan',
    name: '文川中学',
    horrorLevel: '中恐',
    horrorStars: 3,
    players: '4-6人',
    duration: '60分钟',
    slogan: '废弃的中学深处，隐藏着令人胆寒的秘密...',
    coverImage: '/assets/themes/wenchuanzhongxue.jpeg',
    status: 'online',
    sort: 2,
  },
  {
    id: 'theme-shixiong',
    name: '尸兄',
    horrorLevel: '微恐',
    horrorStars: 1,
    players: '2-4人',
    duration: '45分钟',
    slogan: '变异源头等你来探寻...',
    coverImage: '/assets/themes/shixiong.jpeg',
    status: 'online',
    sort: 3,
  },
  {
    id: 'theme-yixueyuan',
    name: '医学院',
    horrorLevel: '中恐',
    horrorStars: 3,
    players: '3-6人',
    duration: '60分钟',
    slogan: '废弃的医学楼里还残留着未完成的实验...',
    coverImage: '/assets/themes/yixueyuan.jpeg',
    status: 'online',
    sort: 4,
  },
  {
    id: 'theme-xishiren',
    name: '西市人',
    horrorLevel: '重恐',
    horrorStars: 5,
    players: '4-8人',
    duration: '75分钟',
    slogan: '西市开发区某个废弃工厂内...',
    coverImage: '/assets/themes/xishiren.jpeg',
    status: 'online',
    sort: 5,
  },
  {
    id: 'theme-jishengchong',
    name: '寄生虫',
    horrorLevel: '微恐',
    horrorStars: 1,
    players: '2-4人',
    duration: '45分钟',
    slogan: '研究院内的寄生虫实验正在变异...',
    coverImage: '/assets/themes/jishengchong.jpeg',
    status: 'online',
    sort: 6,
  },
];

const activities = [
  {
    id: 'activity-spring',
    title: '春季双人队伍周',
    subtitle: '工作日夜场队伍成功可获饮品券和主题徽章',
    highlight: '双人组合专属福利',
    status: 'online',
    sort: 1,
  },
];

exports.main = async (_event, _context) => {
  const results = { themes: 0, activities: 0 };

  for (const theme of themes) {
    try {
      await db.collection('themes').add({
        data: theme,
      });
      results.themes++;
    } catch (e) {
      console.error('add theme error:', e);
    }
  }

  for (const activity of activities) {
    try {
      await db.collection('activities').add({
        data: activity,
      });
      results.activities++;
    } catch (e) {
      console.error('add activity error:', e);
    }
  }

  return {
    ok: true,
    message: `已导入 ${results.themes} 个主题和 ${results.activities} 个活动`,
    results,
  };
};
