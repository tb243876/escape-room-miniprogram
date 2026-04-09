'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const appJsonPath = path.join(projectRoot, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

const requiredPages = [
  'pages/lobby/index',
  'pages/lobby-create/index',
  'pages/team-room/index',
  'pages/leaderboard/index',
  'packages/staff/auth-code/index',
  'packages/staff/dashboard/index',
  'packages/staff/session/index',
  'packages/staff/highlights/index',
];

const requiredDocs = [
  'PROJECT_CONTEXT.md',
  'AGENT_WORKFLOW.md',
  'AGENT_PROMPT.md',
  'CODEMAP.md',
  'STATE_MACHINE.md',
  'ERROR_CODES.md',
  'DB_SCHEMA.md',
  'docs/PHASE1_DEVELOPMENT_GUIDE.md',
  'docs/UI_STYLE_GUIDE.md',
  'docs/UI_FLOW_GUIDE.md',
];

const requiredModules = [
  'utils/domain/group.js',
  'utils/domain/team-room.js',
  'utils/domain/staff.js',
  'utils/domain/leaderboard.js',
  'utils/cloudbase.js',
];

const forbiddenPaths = ['pages/group/index', 'pages/punch/index'];

function assertExists(relativePath, errors) {
  const targetPath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(targetPath)) {
    errors.push(`缺失文件: ${relativePath}`);
  }
}

function main() {
  const errors = [];
  const mainPages = Array.isArray(appJson.pages) ? appJson.pages : [];
  const subPackagePages = Array.isArray(appJson.subPackages)
    ? appJson.subPackages.reduce((list, pkg) => {
        const root = String((pkg && pkg.root) || '').replace(/\/+$/, '');
        const pages = Array.isArray(pkg && pkg.pages) ? pkg.pages : [];
        return list.concat(
          pages.map((pagePath) => {
            const normalizedPagePath = String(pagePath || '').replace(/^\/+/, '');
            return root ? `${root}/${normalizedPagePath}` : normalizedPagePath;
          })
        );
      }, [])
    : [];
  const pages = mainPages.concat(subPackagePages);

  requiredPages.forEach((pagePath) => {
    if (!pages.includes(pagePath)) {
      errors.push(`app.json 未注册页面: ${pagePath}`);
    }
    ['.js', '.json', '.wxml', '.wxss'].forEach((ext) => {
      assertExists(`${pagePath}${ext}`, errors);
    });
  });

  requiredDocs.forEach((docPath) => assertExists(docPath, errors));
  requiredModules.forEach((modulePath) => assertExists(modulePath, errors));
  forbiddenPaths.forEach((pagePath) => {
    if (pages.includes(pagePath)) {
      errors.push(`app.json 不应再注册历史页面: ${pagePath}`);
    }
  });

  if (errors.length) {
    console.error('Phase 1 结构校验失败:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Phase 1 结构校验通过');
}

main();
