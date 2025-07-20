/**
 * Simple logger utility that respects test environment
 * Suppresses console output during tests to keep test output clean
 */

/**
 * Log a message (only if not in test environment)
 * @param {...any} args - Arguments to pass to console.log
 */
function log(...args) {
  if (process.env.NODE_ENV !== 'test') {
    console.log(...args);
  }
}

/**
 * Log an error message (only if not in test environment)
 * @param {...any} args - Arguments to pass to console.error
 */
function error(...args) {
  if (process.env.NODE_ENV !== 'test') {
    console.error(...args);
  }
}

/**
 * Log a warning message (only if not in test environment)
 * @param {...any} args - Arguments to pass to console.warn
 */
function warn(...args) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(...args);
  }
}

/**
 * Log an info message (only if not in test environment)
 * @param {...any} args - Arguments to pass to console.info
 */
function info(...args) {
  if (process.env.NODE_ENV !== 'test') {
    console.info(...args);
  }
}

module.exports = {
  log,
  error,
  warn,
  info
};
