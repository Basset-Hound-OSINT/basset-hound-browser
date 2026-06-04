/**
 * API Gateway Tests
 * Tests for request routing, caching, rate limiting, and service management
 */

const APIGateway = require('../../src/api/gateway');

describe('APIGateway', () => {
  let gateway;

  beforeEach(() => {
    gateway = new APIGateway({
      maxCacheSize: 100,
      enableCaching: true,
      enableRateLimit: true
    });
  });

  afterEach(() => {
    gateway.close();
  });

  describe('Service Registration', () => {
    test('should register a service', () => {
      const service = gateway.registerService('user-service', {
        host: 'localhost',
        port: 3001,
        healthcheck: '/health'
      });

      expect(service.name).toBe('user-service');
      expect(service.host).toBe('localhost');
      expect(service.port).toBe(3001);
      expect(service.circuitBreaker.state).toBe('closed');
    });

    test('should require service name and config', () => {
      expect(() => gateway.registerService()).toThrow();
      expect(() => gateway.registerService('test')).toThrow();
    });

    test('should initialize circuit breaker', () => {
      const service = gateway.registerService('test', { port: 3001 });
      expect(service.circuitBreaker).toBeDefined();
      expect(service.circuitBreaker.state).toBe('closed');
      expect(service.circuitBreaker.threshold).toBe(5);
    });

    test('should track service statistics', () => {
      gateway.registerService('service1', { port: 3001 });
      gateway.registerService('service2', { port: 3002 });

      const stats = gateway.getStats();
      expect(stats.services.length).toBe(2);
    });
  });

  describe('Route Registration', () => {
    test('should register a route with handler', () => {
      const handler = async (req) => ({ statusCode: 200, body: { message: 'ok' } });
      gateway.registerRoute('/users', 'GET', {
        handler,
        cache: true,
        cacheTTL: 60000
      });

      const route = gateway.routes.get('/users:GET');
      expect(route).toBeDefined();
      expect(route.path).toBe('/users');
      expect(route.methods).toContain('GET');
    });

    test('should register multiple methods for same path', () => {
      const handler = async (req) => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/users', ['GET', 'POST', 'PUT'], { handler });

      const route = gateway.routes.get('/users:GET,POST,PUT');
      expect(route.methods.length).toBe(3);
    });

    test('should register route with service', () => {
      gateway.registerService('user-service', { port: 3001 });
      gateway.registerRoute('/users', 'GET', {
        service: 'user-service'
      });

      const route = gateway.routes.get('/users:GET');
      expect(route.service).toBe('user-service');
    });

    test('should register custom transformer', () => {
      const transform = (body) => ({ ...body, transformed: true });
      gateway.registerRoute('/users', 'GET', {
        handler: async () => ({ statusCode: 200, body: {} }),
        transform
      });

      expect(gateway.transformers.size).toBe(1);
    });

    test('should support path patterns', () => {
      const handler = async (req) => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/users/:id/posts/:postId', 'GET', { handler });

      const route = gateway.routes.get('/users/:id/posts/:postId:GET');
      expect(route).toBeDefined();
    });
  });

  describe('Request Handling', () => {
    test('should handle GET request', async () => {
      const handler = async (req) => ({
        statusCode: 200,
        body: { message: 'success' }
      });

      gateway.registerRoute('/test', 'GET', { handler });

      const response = await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {}
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('success');
      expect(response.correlationId).toBeDefined();
    });

    test('should return 404 for unregistered route', async () => {
      const response = await gateway.handleRequest({
        path: '/unknown',
        method: 'GET',
        headers: {}
      });

      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Route not found');
    });

    test('should generate correlation ID', async () => {
      const handler = async (req) => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/test', 'GET', { handler });

      const response = await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {}
      });

      expect(response.correlationId).toBeDefined();
      expect(typeof response.correlationId).toBe('string');
    });

    test('should use incoming correlation ID', async () => {
      const handler = async (req) => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/test', 'GET', { handler });

      const response = await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: { 'x-correlation-id': 'my-id-123' }
      });

      expect(response.correlationId).toBe('my-id-123');
    });

    test('should execute middleware', async () => {
      let middlewareExecuted = false;
      gateway.use(async (req, opts) => {
        middlewareExecuted = true;
        return true;
      });

      const handler = async (req) => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/test', 'GET', { handler });

      await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {}
      });

      expect(middlewareExecuted).toBe(true);
    });

    test('should block request if middleware returns false', async () => {
      gateway.use(async (req, opts) => false);

      const handler = async (req) => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/test', 'GET', { handler });

      const response = await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {}
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('Caching', () => {
    test('should cache GET responses', async () => {
      let callCount = 0;
      const handler = async (req) => {
        callCount++;
        return { statusCode: 200, body: { count: callCount } };
      };

      gateway.registerRoute('/users', 'GET', {
        handler,
        cache: true,
        cacheTTL: 60000
      });

      // First request
      const resp1 = await gateway.handleRequest({
        path: '/users',
        method: 'GET',
        headers: {}
      });

      // Second request (should be cached)
      const resp2 = await gateway.handleRequest({
        path: '/users',
        method: 'GET',
        headers: {}
      });

      expect(resp1.body.count).toBe(1);
      expect(resp2.body.count).toBe(1); // Should be cached
      expect(resp2.fromCache).toBe(true);
      expect(gateway.requestMetrics.cached).toBe(1);
    });

    test('should not cache POST requests', async () => {
      let callCount = 0;
      const handler = async (req) => {
        callCount++;
        return { statusCode: 200, body: { count: callCount } };
      };

      gateway.registerRoute('/users', 'POST', {
        handler,
        cache: true
      });

      await gateway.handleRequest({
        path: '/users',
        method: 'POST',
        headers: {},
        body: { name: 'test' }
      });

      await gateway.handleRequest({
        path: '/users',
        method: 'POST',
        headers: {},
        body: { name: 'test' }
      });

      expect(gateway.requestMetrics.cached).toBe(0);
    });

    test('should clear cache', () => {
      gateway._setCached('/test', {}, { statusCode: 200 }, 60000);
      expect(gateway.cache.size).toBe(1);

      gateway.clearCache();
      expect(gateway.cache.size).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within limit', async () => {
      const handler = async (req) => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/test', 'GET', {
        handler,
        rateLimit: 100
      });

      const response = await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {},
        clientId: 'client-1'
      });

      expect(response.statusCode).toBe(200);
    });

    test('should reject requests exceeding limit', async () => {
      const handler = async (req) => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/test', 'GET', {
        handler,
        rateLimit: 2
      });

      const clientId = 'client-1';

      // First request
      await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {},
        clientId
      });

      // Second request
      await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {},
        clientId
      });

      // Third request (should be rate limited)
      const response = await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {},
        clientId
      });

      expect(response.statusCode).toBe(429);
      expect(gateway.requestMetrics.rateLimited).toBe(1);
    });
  });

  describe('Response Transformation', () => {
    test('should transform response', async () => {
      const handler = async (req) => ({
        statusCode: 200,
        body: { name: 'John' }
      });

      const transform = (body) => ({
        ...body,
        fullName: body.name.toUpperCase()
      });

      gateway.registerRoute('/users', 'GET', {
        handler,
        transform
      });

      const response = await gateway.handleRequest({
        path: '/users',
        method: 'GET',
        headers: {}
      });

      expect(response.body.fullName).toBe('JOHN');
    });
  });

  describe('Metrics', () => {
    test('should record request metrics', async () => {
      const handler = async (req) => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/test', 'GET', { handler });

      await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {}
      });

      expect(gateway.requestMetrics.total).toBe(1);
      expect(gateway.requestMetrics.average_latency).toBeGreaterThan(0);
    });

    test('should get stats', async () => {
      gateway.registerService('service1', { port: 3001 });
      gateway.registerRoute('/test', 'GET', {
        handler: async () => ({ statusCode: 200, body: {} })
      });

      const stats = gateway.getStats();

      expect(stats.requests.total).toBeDefined();
      expect(stats.services).toBeDefined();
      expect(stats.cacheSize).toBe(0);
      expect(stats.routes).toBe(1);
    });

    test('should reset metrics', async () => {
      const handler = async (req) => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/test', 'GET', { handler });

      await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {}
      });

      gateway.resetMetrics();

      expect(gateway.requestMetrics.total).toBe(0);
      expect(gateway.requestMetrics.average_latency).toBe(0);
    });
  });

  describe('Path Matching', () => {
    test('should match exact paths', () => {
      gateway.registerRoute('/users', 'GET', {
        handler: async () => ({ statusCode: 200, body: {} })
      });

      const route = gateway._matchRoute('/users', 'GET');
      expect(route).toBeDefined();
    });

    test('should match path patterns', () => {
      gateway.registerRoute('/users/:id', 'GET', {
        handler: async () => ({ statusCode: 200, body: {} })
      });

      const route = gateway._matchRoute('/users/123', 'GET');
      expect(route).toBeDefined();
    });

    test('should match wildcard patterns', () => {
      gateway.registerRoute('/api/*', 'GET', {
        handler: async () => ({ statusCode: 200, body: {} })
      });

      const route = gateway._matchRoute('/api/users/123', 'GET');
      expect(route).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle handler errors', async () => {
      const handler = async (req) => {
        throw new Error('Handler failed');
      };

      gateway.registerRoute('/test', 'GET', { handler });

      const response = await gateway.handleRequest({
        path: '/test',
        method: 'GET',
        headers: {}
      });

      expect(response.statusCode).toBe(500);
      expect(response.body.error).toBe('Handler failed');
      expect(gateway.requestMetrics.errors).toBe(1);
    });
  });

  describe('Events', () => {
    test('should emit service registered event', (done) => {
      gateway.on('service:registered', (data) => {
        expect(data.service).toBe('test-service');
        done();
      });

      gateway.registerService('test-service', { port: 3000 });
    });

    test('should emit route registered event', (done) => {
      gateway.on('route:registered', (data) => {
        expect(data.path).toBe('/test');
        done();
      });

      gateway.registerRoute('/test', 'GET', {
        handler: async () => ({ statusCode: 200, body: {} })
      });
    });

    test('should emit cache hit event', (done) => {
      gateway.on('cache:hit', (data) => {
        expect(data.path).toBe('/test');
        done();
      });

      const handler = async () => ({ statusCode: 200, body: {} });
      gateway.registerRoute('/test', 'GET', { handler });

      (async () => {
        await gateway.handleRequest({
          path: '/test',
          method: 'GET',
          headers: {}
        });

        await gateway.handleRequest({
          path: '/test',
          method: 'GET',
          headers: {}
        });
      })();
    });
  });
});
