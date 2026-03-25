/**
 * Centralized console logger for backend.
 * In production, only warnings and errors are shown.
 * In development, all log levels are active.
 */
const isDev = process.env.NODE_ENV !== 'production';

export const log = {
  info: (...args) => { if (isDev) console.log(...args); },
  warn: (...args) => { console.warn(...args); },
  error: (...args) => { console.error(...args); },
  debug: (...args) => { if (isDev) console.debug(...args); },
};

export default log;
