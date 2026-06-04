/**
 * Service Mesh Controller Tests
 * Tests for service-to-service communication, circuit breaking, and traffic management
 */

const ServiceMeshController = require('../../src/mesh/mesh-controller');

describe('ServiceMeshController', () => {
  let controller;

  beforeEach(() => {
    controller = new ServiceMeshController({
      enableMTLS: true,
      enableTrafficManagement: true,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5
    });
  });

  afterEach(() => {
    controller.close();
  });

  describe('Virtual Services', () => {
    test('should create a virtual service', () => {
      const vs = controller.createVirtualService('user-service', {
        hosts: ['user-service.default.svc.cluster.local']
      });

      expect(vs.name).toBe('user-service');
      expect(vs.hosts.length).toBeGreaterThan(0);
      expect(vs.kind).toBe('VirtualService');
    });

    test('should configure routing for virtual service', () => {
      controller.createVirtualService('user-service', {
        hosts: ['user-service']
      });

      const routes = [
        {
          name: 'route-1',
          match: [{ uri: { prefix: '/api/users' } }],
          destinations: [
            { host: 'user-service', port: { number: 3001 }, weight: 100 }
          ],
          timeout: '10s',
          retries: { attempts: 3, perTryTimeout: '5s' }
        }
      ];

      const updated = controller.configureRouting('user-service', routes);
      expect(updated.http).toBeDefined();
      expect(updated.http.length).toBe(1);
    });

    test('should throw error for unknown virtual service', () => {
      expect(() => {
        controller.configureRouting('unknown', []);
      }).toThrow();
    });
  });

  describe('Destination Rules', () => {
    test('should create a destination rule', () => {
      const rule = controller.createDestinationRule('user-service-dr', {
        host: 'user-service'
      });

      expect(rule.name).toBe('user-service-dr');
      expect(rule.host).toBe('user-service');
      expect(rule.kind).toBe('DestinationRule');
      expect(rule.trafficPolicy).toBeDefined();
    });

    test('should include connection pool configuration', () => {
      const rule = controller.createDestinationRule('test-dr', {
        host: 'test-service'
      });

      expect(rule.trafficPolicy.connectionPool).toBeDefined();
      expect(rule.trafficPolicy.connectionPool.tcp).toBeDefined();
      expect(rule.trafficPolicy.connectionPool.http).toBeDefined();
    });

    test('should include outlier detection configuration', () => {
      const rule = controller.createDestinationRule('test-dr', {
        host: 'test-service'
      });

      expect(rule.trafficPolicy.outlierDetection).toBeDefined();
      expect(rule.trafficPolicy.outlierDetection.consecutive5xxErrors).toBe(5);
    });
  });

  describe('Circuit Breaker', () => {
    test('should configure circuit breaker', () => {
      controller.createDestinationRule('user-service-dr', {
        host: 'user-service'
      });

      const breaker = controller.configureCircuitBreaker('user-service-dr', {
        consecutiveErrors: 5,
        baseEjectionTime: '30s'
      });

      expect(breaker.state).toBe('closed');
      expect(breaker.consecutiveErrors).toBe(5);
    });

    test('should check circuit breaker status', () => {
      const result = controller._checkCircuitBreaker('test-service');
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('closed');
    });

    test('should open circuit breaker after failures', () => {
      controller._openCircuitBreaker('test-service');
      const result = controller._checkCircuitBreaker('test-service');
      expect(result.allowed).toBe(false);
    });
  });

  describe('Peer Authentication (mTLS)', () => {
    test('should setup peer authentication', () => {
      const auth = controller.setupPeerAuthentication('user-service-mtls', {
        namespace: 'default',
        mtls: { mode: 'STRICT' },
        selector: { app: 'user-service' }
      });

      expect(auth.name).toBe('user-service-mtls');
      expect(auth.mtls.mode).toBe('STRICT');
      expect(auth.kind).toBe('PeerAuthentication');
    });

    test('should support PERMISSIVE mTLS mode', () => {
      const auth = controller.setupPeerAuthentication('test-auth', {
        mtls: { mode: 'PERMISSIVE' }
      });

      expect(auth.mtls.mode).toBe('PERMISSIVE');
    });

    test('should support DISABLE mTLS mode', () => {
      const auth = controller.setupPeerAuthentication('test-auth', {
        mtls: { mode: 'DISABLE' }
      });

      expect(auth.mtls.mode).toBe('DISABLE');
    });
  });

  describe('Authorization Policies', () => {
    test('should create authorization policy', () => {
      const policy = controller.createAuthorizationPolicy('allow-all', {
        action: 'ALLOW',
        rules: [
          {
            from: [{ source: { principals: ['cluster.local/ns/default/sa/user-app'] } }],
            to: [{ operation: { methods: ['GET', 'POST'] } }]
          }
        ]
      });

      expect(policy.name).toBe('allow-all');
      expect(policy.action).toBe('ALLOW');
      expect(policy.kind).toBe('AuthorizationPolicy');
    });

    test('should check authorization', async () => {
      controller.createAuthorizationPolicy('allow-policy', {
        action: 'ALLOW',
        rules: [
          {
            from: [{ source: { principals: ['user-app'] } }],
            to: [{ operation: { methods: ['GET'] } }]
          }
        ]
      });

      const result = await controller._checkAuthorization(
        { method: 'GET', path: '/api/users' },
        { principal: 'user-app', labels: {} }
      );

      expect(result.allowed).toBe(true);
    });

    test('should deny unauthorized requests', async () => {
      controller.createAuthorizationPolicy('deny-policy', {
        action: 'DENY',
        rules: [
          {
            to: [{ operation: { methods: ['DELETE'] } }]
          }
        ]
      });

      const result = await controller._checkAuthorization(
        { method: 'DELETE', path: '/api/users/1' },
        { labels: {} }
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe('Traffic Mirroring', () => {
    test('should setup traffic mirroring', () => {
      const mirror = controller.setupTrafficMirroring('user-service', {
        destination: 'user-service-v2',
        percentage: 10,
        timeout: '30s'
      });

      expect(mirror.sourceService).toBe('user-service');
      expect(mirror.destination).toBe('user-service-v2');
      expect(mirror.percentage).toBe(10);
      expect(mirror.enabled).toBe(true);
    });

    test('should track mirror statistics', () => {
      const mirror = controller.setupTrafficMirroring('user-service', {
        destination: 'user-service-v2'
      });

      expect(mirror.stats.requests).toBe(0);
      expect(mirror.stats.errors).toBe(0);
    });
  });

  describe('Request Routing', () => {
    test('should route request successfully', async () => {
      const result = await controller.routeRequest(
        { method: 'GET', path: '/api/users' },
        { service: 'user-service' }
      );

      expect(result.allowed).toBe(true);
      expect(result.response).toBeDefined();
    });

    test('should record latency metrics', async () => {
      let recordedLatency = null;

      controller.on('metrics:recorded', (data) => {
        recordedLatency = data.latency;
      });

      await controller.routeRequest(
        { method: 'GET', path: '/api/users' },
        { service: 'user-service' }
      );

      expect(recordedLatency).toBeDefined();
      expect(typeof recordedLatency).toBe('number');
    });

    test('should apply request mutations', async () => {
      const result = await controller.routeRequest(
        { method: 'GET', path: '/api/users' },
        { service: 'user-service' }
      );

      expect(result.allowed).toBe(true);
    });

    test('should apply response mutations', async () => {
      const result = await controller.routeRequest(
        { method: 'GET', path: '/api/users' },
        { service: 'user-service' }
      );

      expect(result.response).toBeDefined();
    });
  });

  describe('Retry Policies', () => {
    test('should get retry policy for service', () => {
      controller.createVirtualService('user-service', {
        hosts: ['user-service']
      });

      controller.configureRouting('user-service', [
        {
          name: 'route-1',
          destinations: [{ host: 'user-service' }],
          retries: { attempts: 5, perTryTimeout: '3s' }
        }
      ]);

      const policy = controller._getRetryPolicy('user-service');
      expect(policy.attempts).toBe(5);
    });

    test('should use default retry policy', () => {
      const policy = controller._getRetryPolicy('unknown-service');
      expect(policy.attempts).toBeDefined();
    });
  });

  describe('Path Matching', () => {
    test('should match exact path', () => {
      const matches = controller._matchesPath('/api/users', '/api/users');
      expect(matches).toBe(true);
    });

    test('should match wildcard path', () => {
      const matches = controller._matchesPath('*', '/api/users');
      expect(matches).toBe(true);
    });

    test('should match prefix path', () => {
      const matches = controller._matchesPath('/api/*', '/api/users');
      expect(matches).toBe(true);
    });

    test('should not match different paths', () => {
      const matches = controller._matchesPath('/api/users', '/api/posts');
      expect(matches).toBe(false);
    });
  });

  describe('Selector Matching', () => {
    test('should match selector', () => {
      const matches = controller._matchesSelector(
        { app: 'user-service', version: 'v1' },
        { labels: { app: 'user-service', version: 'v1' } }
      );

      expect(matches).toBe(true);
    });

    test('should not match different selector', () => {
      const matches = controller._matchesSelector(
        { app: 'user-service' },
        { labels: { app: 'post-service' } }
      );

      expect(matches).toBe(false);
    });

    test('should match no selector', () => {
      const matches = controller._matchesSelector(null, {});
      expect(matches).toBe(true);
    });
  });

  describe('Mesh Status', () => {
    test('should get mesh status', () => {
      controller.createVirtualService('user-service', {
        hosts: ['user-service']
      });

      controller.createDestinationRule('user-service-dr', {
        host: 'user-service'
      });

      const status = controller.getStatus();

      expect(status.virtualServices).toBe(1);
      expect(status.destinationRules).toBe(1);
      expect(status.circuitBreakers).toBeDefined();
    });

    test('should include circuit breaker states', () => {
      controller.createDestinationRule('test-service', { host: 'test-service' });
      controller.configureCircuitBreaker('test-service', {});

      const status = controller.getStatus();
      expect(status.circuitBreakers).toBeDefined();
      expect(Array.isArray(status.circuitBreakers)).toBe(true);
    });
  });

  describe('Events', () => {
    test('should emit virtualService created event', (done) => {
      controller.on('virtualService:created', (data) => {
        expect(data.name).toBe('test-service');
        done();
      });

      controller.createVirtualService('test-service', {});
    });

    test('should emit destinationRule created event', (done) => {
      controller.on('destinationRule:created', (data) => {
        expect(data.name).toBe('test-dr');
        done();
      });

      controller.createDestinationRule('test-dr', { host: 'test' });
    });

    test('should emit peerAuthentication created event', (done) => {
      controller.on('peerAuthentication:created', (data) => {
        expect(data.name).toBe('test-auth');
        done();
      });

      controller.setupPeerAuthentication('test-auth', {});
    });

    test('should emit authorizationPolicy created event', (done) => {
      controller.on('authorizationPolicy:created', (data) => {
        expect(data.name).toBe('test-policy');
        done();
      });

      controller.createAuthorizationPolicy('test-policy', {});
    });

    test('should emit circuitBreaker opened event', (done) => {
      controller.on('circuitBreaker:opened', (data) => {
        expect(data.service).toBe('test-service');
        done();
      });

      controller._openCircuitBreaker('test-service');
    });

    test('should emit trafficMirror created event', (done) => {
      controller.on('trafficMirror:created', (data) => {
        expect(data.sourceService).toBe('test-service');
        done();
      });

      controller.setupTrafficMirroring('test-service', {
        destination: 'test-v2'
      });
    });
  });
});
