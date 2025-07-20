const logger = require('../../../src/utils/logger');

describe('Logger Utility', () => {
  let originalConsoleLog;
  let originalConsoleError;
  let originalConsoleWarn;
  let originalConsoleInfo;
  let originalNodeEnv;

  beforeEach(() => {
    // Store original console methods and NODE_ENV
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalConsoleInfo = console.info;
    originalNodeEnv = process.env.NODE_ENV;

    // Mock console methods
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
  });

  afterEach(() => {
    // Restore original console methods and NODE_ENV
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.info = originalConsoleInfo;
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('log method', () => {
    test('should call console.log when NODE_ENV is not test', () => {
      process.env.NODE_ENV = 'development';
      
      logger.log('test message', 'additional arg');
      
      expect(console.log).toHaveBeenCalledWith('test message', 'additional arg');
    });

    test('should not call console.log when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      
      logger.log('test message');
      
      expect(console.log).not.toHaveBeenCalled();
    });

    test('should handle multiple arguments', () => {
      process.env.NODE_ENV = 'production';
      
      logger.log('message', { key: 'value' }, 123, true);
      
      expect(console.log).toHaveBeenCalledWith('message', { key: 'value' }, 123, true);
    });
  });

  describe('error method', () => {
    test('should call console.error when NODE_ENV is not test', () => {
      process.env.NODE_ENV = 'development';
      
      logger.error('error message', new Error('test error'));
      
      expect(console.error).toHaveBeenCalledWith('error message', new Error('test error'));
    });

    test('should not call console.error when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      
      logger.error('error message');
      
      expect(console.error).not.toHaveBeenCalled();
    });

    test('should handle error objects', () => {
      process.env.NODE_ENV = 'staging';
      const error = new Error('Database connection failed');
      
      logger.error('Database error:', error);
      
      expect(console.error).toHaveBeenCalledWith('Database error:', error);
    });
  });

  describe('warn method', () => {
    test('should call console.warn when NODE_ENV is not test', () => {
      process.env.NODE_ENV = 'development';
      
      logger.warn('warning message', 'context');
      
      expect(console.warn).toHaveBeenCalledWith('warning message', 'context');
    });

    test('should not call console.warn when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      
      logger.warn('warning message');
      
      expect(console.warn).not.toHaveBeenCalled();
    });

    test('should handle deprecation warnings', () => {
      process.env.NODE_ENV = 'production';
      
      logger.warn('DEPRECATED: This method will be removed in v2.0');
      
      expect(console.warn).toHaveBeenCalledWith('DEPRECATED: This method will be removed in v2.0');
    });
  });

  describe('info method', () => {
    test('should call console.info when NODE_ENV is not test', () => {
      process.env.NODE_ENV = 'development';
      
      logger.info('info message', { status: 'success' });
      
      expect(console.info).toHaveBeenCalledWith('info message', { status: 'success' });
    });

    test('should not call console.info when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      
      logger.info('info message');
      
      expect(console.info).not.toHaveBeenCalled();
    });

    test('should handle informational logs', () => {
      process.env.NODE_ENV = 'production';
      
      logger.info('Server started on port 3000');
      
      expect(console.info).toHaveBeenCalledWith('Server started on port 3000');
    });
  });

  describe('environment edge cases', () => {
    test('should log when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      
      logger.log('message when NODE_ENV is undefined');
      
      expect(console.log).toHaveBeenCalledWith('message when NODE_ENV is undefined');
    });

    test('should log when NODE_ENV is empty string', () => {
      process.env.NODE_ENV = '';
      
      logger.error('error when NODE_ENV is empty');
      
      expect(console.error).toHaveBeenCalledWith('error when NODE_ENV is empty');
    });

    test('should not log when NODE_ENV is exactly "test"', () => {
      process.env.NODE_ENV = 'test';
      
      logger.warn('should not appear');
      logger.info('should not appear');
      logger.log('should not appear');
      logger.error('should not appear');
      
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('no arguments', () => {
    test('should handle log with no arguments', () => {
      process.env.NODE_ENV = 'development';
      
      logger.log();
      
      expect(console.log).toHaveBeenCalledWith();
    });

    test('should handle error with no arguments', () => {
      process.env.NODE_ENV = 'development';
      
      logger.error();
      
      expect(console.error).toHaveBeenCalledWith();
    });

    test('should handle warn with no arguments', () => {
      process.env.NODE_ENV = 'development';
      
      logger.warn();
      
      expect(console.warn).toHaveBeenCalledWith();
    });

    test('should handle info with no arguments', () => {
      process.env.NODE_ENV = 'development';
      
      logger.info();
      
      expect(console.info).toHaveBeenCalledWith();
    });
  });
});
