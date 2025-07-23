const controllersIndex = require('../../../src/controllers/index');
const slackController = require('../../../src/controllers/slackController');

describe('Controllers Index', () => {
  describe('Module exports', () => {
    test('should export an object with controller functions', () => {
      expect(typeof controllersIndex).toBe('object');
      expect(controllersIndex).not.toBeNull();
    });

    test('should export slack controller functions', () => {
      expect(controllersIndex.handlePokerCommand).toBeDefined();
      expect(controllersIndex.handleInteractiveActions).toBeDefined();
      expect(typeof controllersIndex.handlePokerCommand).toBe('function');
      expect(typeof controllersIndex.handleInteractiveActions).toBe('function');
    });

    test('should spread slackController exports correctly', () => {
      expect(controllersIndex.handlePokerCommand).toBe(slackController.handlePokerCommand);
      expect(controllersIndex.handleInteractiveActions).toBe(slackController.handleInteractiveActions);
    });

    test('should have expected number of exported functions', () => {
      const exportedKeys = Object.keys(controllersIndex);
      expect(exportedKeys.length).toBeGreaterThan(0);
    });
  });
});
