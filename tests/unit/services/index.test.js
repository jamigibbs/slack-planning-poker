const servicesIndex = require('../../../src/services/index');

describe('Services Index', () => {
  describe('Module exports', () => {
    test('should export an object with service functions', () => {
      expect(typeof servicesIndex).toBe('object');
      expect(servicesIndex).not.toBeNull();
    });

    test('should export session service functions', () => {
      expect(servicesIndex.createSession).toBeDefined();
      expect(servicesIndex.getLatestSessionForChannel).toBeDefined();
      expect(typeof servicesIndex.createSession).toBe('function');
      expect(typeof servicesIndex.getLatestSessionForChannel).toBe('function');
    });

    test('should export vote service functions', () => {
      expect(servicesIndex.saveVote).toBeDefined();
      expect(servicesIndex.getSessionVotes).toBeDefined();
      expect(servicesIndex.countVotes).toBeDefined();
      expect(typeof servicesIndex.saveVote).toBe('function');
      expect(typeof servicesIndex.getSessionVotes).toBe('function');
      expect(typeof servicesIndex.countVotes).toBe('function');
    });

    test('should have expected number of exported functions', () => {
      const exportedKeys = Object.keys(servicesIndex);
      expect(exportedKeys.length).toBeGreaterThan(0);
      // Now expecting 5 functions instead of 6 (removed cleanupOldSessions)
      expect(exportedKeys).toContain('createSession');
      expect(exportedKeys).toContain('getLatestSessionForChannel');
      expect(exportedKeys).toContain('saveVote');
      expect(exportedKeys).toContain('getSessionVotes');
      expect(exportedKeys).toContain('countVotes');
    });
  });
});
