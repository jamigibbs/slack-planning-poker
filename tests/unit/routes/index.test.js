const router = require('../../../src/routes/index');

describe('Routes Index', () => {
  describe('Module exports', () => {
    test('should export an express router', () => {
      expect(router).toBeDefined();
      expect(typeof router).toBe('function');
      expect(router.name).toBe('router');
    });

    test('should have router stack with mounted routes', () => {
      expect(router.stack).toBeDefined();
      expect(Array.isArray(router.stack)).toBe(true);
      expect(router.stack.length).toBeGreaterThan(0);
    });

    test('should have GET route for root path', () => {
      const rootRoute = router.stack.find(layer => 
        layer.route && layer.route.path === '/' && layer.route.methods.get
      );
      expect(rootRoute).toBeDefined();
    });

    test('should have mounted sub-routers', () => {
      const mountedRouters = router.stack.filter(layer => !layer.route);
      expect(mountedRouters.length).toBeGreaterThan(0);
    });
  });

  describe('Route structure', () => {
    test('should be a valid Express router instance', () => {
      expect(router.constructor.name).toBe('Function');
      expect(router.stack).toBeDefined();
    });
  });
});
