'use strict';

function getNow() {
  try {
    if (wx && typeof wx.getPerformance === 'function') {
      const performance = wx.getPerformance();
      if (performance && typeof performance.now === 'function') {
        return performance.now();
      }
    }
  } catch (error) {}
  return Date.now();
}

function isPerfEnabled() {
  try {
    const app = getApp();
    const globalData = (app && app.globalData) || {};
    return globalData.enablePerfTracing !== false;
  } catch (error) {
    return true;
  }
}

function buildLabel(name, meta) {
  const extra = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[perf] ${name}${extra}`;
}

function startTrace(name, meta) {
  if (!isPerfEnabled()) {
    return null;
  }
  const trace = {
    name,
    meta: meta || null,
    startAt: getNow(),
  };
  console.info(`${buildLabel(name, meta)} start`);
  return trace;
}

function stepTrace(trace, stepName, meta) {
  if (!trace || !isPerfEnabled()) {
    return;
  }
  const duration = Math.round((getNow() - trace.startAt) * 100) / 100;
  console.info(`${buildLabel(`${trace.name}:${stepName}`, meta)} +${duration}ms`);
}

function endTrace(trace, meta) {
  if (!trace || !isPerfEnabled()) {
    return;
  }
  const duration = Math.round((getNow() - trace.startAt) * 100) / 100;
  const mergedMeta = {
    ...(trace.meta || {}),
    ...(meta || {}),
    duration,
  };
  console.info(`${buildLabel(trace.name, mergedMeta)} end`);
}

async function traceAsync(name, handler, meta) {
  const trace = startTrace(name, meta);
  try {
    const result = await handler(trace);
    endTrace(trace, { status: 'ok' });
    return result;
  } catch (error) {
    endTrace(trace, {
      status: 'error',
      message: error && error.message ? error.message : 'unknown-error',
    });
    throw error;
  }
}

module.exports = {
  startTrace,
  stepTrace,
  endTrace,
  traceAsync,
};
