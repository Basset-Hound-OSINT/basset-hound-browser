/**
 * Unit tests for Proxy Pool Manager
 */

const { ProxyPool, Proxy, RotationStrategy, ProxyType, ProxyStatus } = require('../../proxy/proxy-pool');

describe('Proxy', () => {
    describe('Constructor', () => {
        test('should create proxy with basic configuration', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                type: ProxyType.HTTP
            });

            expect(proxy.host).toBe('127.0.0.1');
            expect(proxy.port).toBe(8080);
            expect(proxy.type).toBe(ProxyType.HTTP);
            expect(proxy.status).toBe(ProxyStatus.HEALTHY);
            expect(proxy.successCount).toBe(0);
            expect(proxy.failureCount).toBe(0);
        });

        test('should create proxy with authentication', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                type: ProxyType.HTTP,
                username: 'user',
                password: 'pass'
            });

            expect(proxy.username).toBe('user');
            expect(proxy.password).toBe('pass');
        });

        test('should create proxy with geographic information', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                country: 'US',
                region: 'California',
                city: 'San Francisco'
            });

            expect(proxy.country).toBe('US');
            expect(proxy.region).toBe('California');
            expect(proxy.city).toBe('San Francisco');
        });

        test('should create proxy with tags and weight', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                tags: ['fast', 'reliable'],
                weight: 5
            });

            expect(proxy.tags).toEqual(['fast', 'reliable']);
            expect(proxy.weight).toBe(5);
        });

        test('should generate ID automatically', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                type: ProxyType.HTTP
            });

            expect(proxy.id).toBe('http://127.0.0.1:8080');
        });

        test('should use custom ID if provided', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                id: 'custom-proxy-1'
            });

            expect(proxy.id).toBe('custom-proxy-1');
        });
    });

    describe('getUrl()', () => {
        test('should return URL without authentication', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                type: ProxyType.HTTP
            });

            expect(proxy.getUrl()).toBe('http://127.0.0.1:8080');
        });

        test('should return URL with authentication', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                type: ProxyType.HTTP,
                username: 'user',
                password: 'pass'
            });

            expect(proxy.getUrl()).toBe('http://user:pass@127.0.0.1:8080');
        });

        test('should handle SOCKS5 proxy URL', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 1080,
                type: ProxyType.SOCKS5
            });

            expect(proxy.getUrl()).toBe('socks5://127.0.0.1:1080');
        });
    });

    describe('isAvailable()', () => {
        test('should return true for healthy proxy', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            expect(proxy.isAvailable()).toBe(true);
        });

        test('should return false for blacklisted proxy', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.blacklist(60000, 'Test blacklist');

            expect(proxy.isAvailable()).toBe(false);
        });

        test('should return true for blacklisted proxy after duration', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.blacklist(1, 'Test blacklist');

            // Wait for blacklist to expire
            setTimeout(() => {
                expect(proxy.isAvailable()).toBe(true);
            }, 10);
        });

        test('should return false for unhealthy proxy', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.status = ProxyStatus.UNHEALTHY;

            expect(proxy.isAvailable()).toBe(false);
        });

        test('should return true for degraded proxy', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.status = ProxyStatus.DEGRADED;

            expect(proxy.isAvailable()).toBe(true);
        });
    });

    describe('isRateLimited()', () => {
        test('should return false when no rate limit set', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            expect(proxy.isRateLimited()).toBe(false);
        });

        test('should return false when under rate limit', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                maxRequestsPerMinute: 10
            });

            proxy.recordRequest();
            proxy.recordRequest();

            expect(proxy.isRateLimited()).toBe(false);
        });

        test('should return true when rate limit exceeded', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                maxRequestsPerMinute: 2
            });

            proxy.recordRequest();
            proxy.recordRequest();
            proxy.recordRequest();

            expect(proxy.isRateLimited()).toBe(true);
        });

        test('should clean old timestamps', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080,
                maxRequestsPerMinute: 2
            });

            // Add old timestamp
            proxy.requestTimestamps.push(Date.now() - 120000);
            proxy.recordRequest();

            expect(proxy.isRateLimited()).toBe(false);
        });
    });

    describe('recordSuccess()', () => {
        test('should increment success count', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.recordSuccess(100);

            expect(proxy.successCount).toBe(1);
        });

        test('should update last success timestamp', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.recordSuccess(100);

            expect(proxy.lastSuccess).toBeTruthy();
        });

        test('should reset consecutive failures', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.consecutiveFailures = 3;
            proxy.recordSuccess(100);

            expect(proxy.consecutiveFailures).toBe(0);
        });

        test('should update response time metrics', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.recordSuccess(100);
            proxy.recordSuccess(200);

            expect(proxy.responseTimeMs).toEqual([100, 200]);
            expect(proxy.averageResponseTime).toBe(150);
        });

        test('should limit response time history to 100 entries', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            for (let i = 0; i < 150; i++) {
                proxy.recordSuccess(100);
            }

            expect(proxy.responseTimeMs.length).toBe(100);
        });

        test('should improve status from unhealthy to degraded', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.status = ProxyStatus.UNHEALTHY;
            proxy.recordSuccess(100);

            expect(proxy.status).toBe(ProxyStatus.DEGRADED);
        });

        test('should improve status from degraded to healthy', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.status = ProxyStatus.DEGRADED;
            proxy.consecutiveFailures = 0;
            proxy.recordSuccess(100);

            expect(proxy.status).toBe(ProxyStatus.HEALTHY);
        });
    });

    describe('recordFailure()', () => {
        test('should increment failure count', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.recordFailure(new Error('Test error'));

            expect(proxy.failureCount).toBe(1);
        });

        test('should increment consecutive failures', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.recordFailure(new Error('Test error'));
            proxy.recordFailure(new Error('Test error'));

            expect(proxy.consecutiveFailures).toBe(2);
        });

        test('should update last failure timestamp', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.recordFailure(new Error('Test error'));

            expect(proxy.lastFailure).toBeTruthy();
        });

        test('should set status to degraded after 3 failures', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.recordFailure(new Error('Test error'));
            proxy.recordFailure(new Error('Test error'));
            proxy.recordFailure(new Error('Test error'));

            expect(proxy.status).toBe(ProxyStatus.DEGRADED);
        });

        test('should set status to unhealthy after 5 failures', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            for (let i = 0; i < 5; i++) {
                proxy.recordFailure(new Error('Test error'));
            }

            expect(proxy.status).toBe(ProxyStatus.UNHEALTHY);
        });
    });

    describe('blacklist()', () => {
        test('should blacklist proxy with default duration', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.blacklist();

            expect(proxy.status).toBe(ProxyStatus.BLACKLISTED);
            expect(proxy.blacklistedUntil).toBeTruthy();
        });

        test('should blacklist proxy with custom duration', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            const duration = 60000;
            proxy.blacklist(duration, 'Test');

            const expectedUntil = Date.now() + duration;
            expect(proxy.blacklistedUntil).toBeGreaterThan(Date.now());
            expect(proxy.blacklistedUntil).toBeLessThanOrEqual(expectedUntil);
        });

        test('should set blacklist reason', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.blacklist(60000, 'Too many failures');

            expect(proxy.blacklistReason).toBe('Too many failures');
        });
    });

    describe('unblacklist()', () => {
        test('should remove proxy from blacklist', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.blacklist(60000, 'Test');
            proxy.unblacklist();

            expect(proxy.status).toBe(ProxyStatus.DEGRADED);
            expect(proxy.blacklistedUntil).toBeNull();
            expect(proxy.blacklistReason).toBeNull();
        });

        test('should reset consecutive failures', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.consecutiveFailures = 5;
            proxy.blacklist(60000, 'Test');
            proxy.unblacklist();

            expect(proxy.consecutiveFailures).toBe(0);
        });
    });

    describe('getSuccessRate()', () => {
        test('should return 1.0 for new proxy', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            expect(proxy.getSuccessRate()).toBe(1.0);
        });

        test('should calculate success rate correctly', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.totalRequests = 10;
            proxy.successCount = 8;

            expect(proxy.getSuccessRate()).toBe(0.8);
        });

        test('should return 0.0 for all failures', () => {
            const proxy = new Proxy({
                host: '127.0.0.1',
                port: 8080
            });

            proxy.totalRequests = 10;
            proxy.successCount = 0;

            expect(proxy.getSuccessRate()).toBe(0.0);
        });
    });
});

describe('ProxyPool', () => {
    describe('Constructor', () => {
        test('should create pool with default configuration', () => {
            const pool = new ProxyPool();

            expect(pool.rotationStrategy).toBe(RotationStrategy.ROUND_ROBIN);
            expect(pool.healthCheckEnabled).toBe(true);
            expect(pool.proxies.size).toBe(0);
        });

        test('should create pool with custom configuration', () => {
            const pool = new ProxyPool({
                rotationStrategy: RotationStrategy.RANDOM,
                healthCheckEnabled: false,
                healthCheckInterval: 60000
            });

            expect(pool.rotationStrategy).toBe(RotationStrategy.RANDOM);
            expect(pool.healthCheckEnabled).toBe(false);
            expect(pool.healthCheckInterval).toBe(60000);
        });
    });

    describe('addProxy()', () => {
        test('should add proxy to pool', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({
                host: '127.0.0.1',
                port: 8080
            });

            expect(pool.proxies.size).toBe(1);
            expect(proxy.host).toBe('127.0.0.1');
        });

        test('should emit proxy:added event', (done) => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.on('proxy:added', (proxy) => {
                expect(proxy.host).toBe('127.0.0.1');
                done();
            });

            pool.addProxy({
                host: '127.0.0.1',
                port: 8080
            });
        });

        test('should throw error for duplicate proxy', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({
                id: 'proxy-1',
                host: '127.0.0.1',
                port: 8080
            });

            expect(() => {
                pool.addProxy({
                    id: 'proxy-1',
                    host: '127.0.0.2',
                    port: 8080
                });
            }).toThrow('already exists');
        });

        test('should update statistics', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({
                host: '127.0.0.1',
                port: 8080
            });

            expect(pool.stats.totalProxies).toBe(1);
            expect(pool.stats.healthyProxies).toBe(1);
        });
    });

    describe('removeProxy()', () => {
        test('should remove proxy from pool', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({
                host: '127.0.0.1',
                port: 8080
            });

            pool.removeProxy(proxy.id);

            expect(pool.proxies.size).toBe(0);
        });

        test('should emit proxy:removed event', (done) => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({
                host: '127.0.0.1',
                port: 8080
            });

            pool.on('proxy:removed', (removedProxy) => {
                expect(removedProxy.id).toBe(proxy.id);
                done();
            });

            pool.removeProxy(proxy.id);
        });

        test('should throw error for non-existent proxy', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            expect(() => {
                pool.removeProxy('non-existent');
            }).toThrow('not found');
        });
    });

    describe('getAvailableProxies()', () => {
        test('should return all available proxies', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({ host: '127.0.0.1', port: 8080 });
            pool.addProxy({ host: '127.0.0.2', port: 8080 });

            const available = pool.getAvailableProxies();

            expect(available.length).toBe(2);
        });

        test('should filter out blacklisted proxies', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy1 = pool.addProxy({ host: '127.0.0.1', port: 8080 });
            pool.addProxy({ host: '127.0.0.2', port: 8080 });

            proxy1.blacklist();

            const available = pool.getAvailableProxies();

            expect(available.length).toBe(1);
        });

        test('should filter out unhealthy proxies', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy1 = pool.addProxy({ host: '127.0.0.1', port: 8080 });
            pool.addProxy({ host: '127.0.0.2', port: 8080 });

            proxy1.status = ProxyStatus.UNHEALTHY;

            const available = pool.getAvailableProxies();

            expect(available.length).toBe(1);
        });

        test('should filter by country', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({ host: '127.0.0.1', port: 8080, country: 'US' });
            pool.addProxy({ host: '127.0.0.2', port: 8080, country: 'UK' });

            const available = pool.getAvailableProxies({ country: 'US' });

            expect(available.length).toBe(1);
            expect(available[0].country).toBe('US');
        });

        test('should filter by type', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({ host: '127.0.0.1', port: 8080, type: ProxyType.HTTP });
            pool.addProxy({ host: '127.0.0.2', port: 1080, type: ProxyType.SOCKS5 });

            const available = pool.getAvailableProxies({ type: ProxyType.SOCKS5 });

            expect(available.length).toBe(1);
            expect(available[0].type).toBe(ProxyType.SOCKS5);
        });

        test('should filter by tags', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({ host: '127.0.0.1', port: 8080, tags: ['fast'] });
            pool.addProxy({ host: '127.0.0.2', port: 8080, tags: ['slow'] });

            const available = pool.getAvailableProxies({ tags: ['fast'] });

            expect(available.length).toBe(1);
            expect(available[0].tags).toContain('fast');
        });

        test('should filter by minimum success rate', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy1 = pool.addProxy({ host: '127.0.0.1', port: 8080 });
            const proxy2 = pool.addProxy({ host: '127.0.0.2', port: 8080 });

            proxy1.totalRequests = 10;
            proxy1.successCount = 9;

            proxy2.totalRequests = 10;
            proxy2.successCount = 5;

            const available = pool.getAvailableProxies({ minSuccessRate: 0.8 });

            expect(available.length).toBe(1);
            expect(available[0].id).toBe(proxy1.id);
        });

        test('should filter by maximum response time', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy1 = pool.addProxy({ host: '127.0.0.1', port: 8080 });
            const proxy2 = pool.addProxy({ host: '127.0.0.2', port: 8080 });

            proxy1.averageResponseTime = 100;
            proxy2.averageResponseTime = 500;

            const available = pool.getAvailableProxies({ maxResponseTime: 200 });

            expect(available.length).toBe(1);
            expect(available[0].id).toBe(proxy1.id);
        });
    });

    describe('getNextProxy() - Round Robin', () => {
        test('should rotate through proxies in order', () => {
            const pool = new ProxyPool({
                rotationStrategy: RotationStrategy.ROUND_ROBIN,
                healthCheckEnabled: false
            });

            const proxy1 = pool.addProxy({ host: '127.0.0.1', port: 8080 });
            const proxy2 = pool.addProxy({ host: '127.0.0.2', port: 8080 });
            const proxy3 = pool.addProxy({ host: '127.0.0.3', port: 8080 });

            const p1 = pool.getNextProxy();
            const p2 = pool.getNextProxy();
            const p3 = pool.getNextProxy();
            const p4 = pool.getNextProxy();

            expect([p1.id, p2.id, p3.id]).toContain(proxy1.id);
            expect([p1.id, p2.id, p3.id]).toContain(proxy2.id);
            expect([p1.id, p2.id, p3.id]).toContain(proxy3.id);
            expect(p4.id).toBe(p1.id);
        });

        test('should skip unavailable proxies', () => {
            const pool = new ProxyPool({
                rotationStrategy: RotationStrategy.ROUND_ROBIN,
                healthCheckEnabled: false
            });

            const proxy1 = pool.addProxy({ host: '127.0.0.1', port: 8080 });
            pool.addProxy({ host: '127.0.0.2', port: 8080 });

            proxy1.blacklist();

            const next = pool.getNextProxy();

            expect(next.host).toBe('127.0.0.2');
        });
    });

    describe('getNextProxy() - Random', () => {
        test('should select random proxy', () => {
            const pool = new ProxyPool({
                rotationStrategy: RotationStrategy.RANDOM,
                healthCheckEnabled: false
            });

            pool.addProxy({ host: '127.0.0.1', port: 8080 });
            pool.addProxy({ host: '127.0.0.2', port: 8080 });
            pool.addProxy({ host: '127.0.0.3', port: 8080 });

            const proxies = new Set();

            for (let i = 0; i < 20; i++) {
                const proxy = pool.getNextProxy();
                proxies.add(proxy.id);
            }

            expect(proxies.size).toBeGreaterThan(1);
        });
    });

    describe('getNextProxy() - Least Used', () => {
        test('should select proxy with fewest requests', () => {
            const pool = new ProxyPool({
                rotationStrategy: RotationStrategy.LEAST_USED,
                healthCheckEnabled: false
            });

            const proxy1 = pool.addProxy({ host: '127.0.0.1', port: 8080 });
            const proxy2 = pool.addProxy({ host: '127.0.0.2', port: 8080 });

            proxy1.totalRequests = 10;
            proxy2.totalRequests = 5;

            const next = pool.getNextProxy();

            expect(next.id).toBe(proxy2.id);
        });
    });

    describe('getNextProxy() - Fastest', () => {
        test('should select proxy with lowest response time', () => {
            const pool = new ProxyPool({
                rotationStrategy: RotationStrategy.FASTEST,
                healthCheckEnabled: false
            });

            const proxy1 = pool.addProxy({ host: '127.0.0.1', port: 8080 });
            const proxy2 = pool.addProxy({ host: '127.0.0.2', port: 8080 });

            proxy1.averageResponseTime = 500;
            proxy2.averageResponseTime = 100;

            const next = pool.getNextProxy();

            expect(next.id).toBe(proxy2.id);
        });

        test('should fallback to random if no response time data', () => {
            const pool = new ProxyPool({
                rotationStrategy: RotationStrategy.FASTEST,
                healthCheckEnabled: false
            });

            pool.addProxy({ host: '127.0.0.1', port: 8080 });
            pool.addProxy({ host: '127.0.0.2', port: 8080 });

            const next = pool.getNextProxy();

            expect(next).toBeTruthy();
        });
    });

    describe('getNextProxy() - Weighted', () => {
        test('should select proxies based on weight', () => {
            const pool = new ProxyPool({
                rotationStrategy: RotationStrategy.WEIGHTED,
                healthCheckEnabled: false
            });

            const proxy1 = pool.addProxy({ host: '127.0.0.1', port: 8080, weight: 1 });
            const proxy2 = pool.addProxy({ host: '127.0.0.2', port: 8080, weight: 9 });

            const counts = { [proxy1.id]: 0, [proxy2.id]: 0 };

            for (let i = 0; i < 100; i++) {
                const proxy = pool.getNextProxy();
                counts[proxy.id]++;
            }

            expect(counts[proxy2.id]).toBeGreaterThan(counts[proxy1.id]);
        });
    });

    describe('getNextProxy() - Filters', () => {
        test('should throw error when no proxies available', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            expect(() => {
                pool.getNextProxy();
            }).toThrow('No available proxies');
        });

        test('should apply country filter', () => {
            const pool = new ProxyPool({
                rotationStrategy: RotationStrategy.ROUND_ROBIN,
                healthCheckEnabled: false
            });

            pool.addProxy({ host: '127.0.0.1', port: 8080, country: 'US' });
            pool.addProxy({ host: '127.0.0.2', port: 8080, country: 'UK' });

            const proxy = pool.getNextProxy({ country: 'UK' });

            expect(proxy.country).toBe('UK');
        });
    });

    describe('setRotationStrategy()', () => {
        test('should change rotation strategy', () => {
            const pool = new ProxyPool({
                rotationStrategy: RotationStrategy.ROUND_ROBIN,
                healthCheckEnabled: false
            });

            pool.setRotationStrategy(RotationStrategy.RANDOM);

            expect(pool.rotationStrategy).toBe(RotationStrategy.RANDOM);
        });

        test('should emit strategy:changed event', (done) => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.on('strategy:changed', (strategy) => {
                expect(strategy).toBe(RotationStrategy.RANDOM);
                done();
            });

            pool.setRotationStrategy(RotationStrategy.RANDOM);
        });

        test('should throw error for invalid strategy', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            expect(() => {
                pool.setRotationStrategy('invalid-strategy');
            }).toThrow('Invalid rotation strategy');
        });

        test('should reset index', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.currentIndex = 5;
            pool.setRotationStrategy(RotationStrategy.RANDOM);

            expect(pool.currentIndex).toBe(0);
        });
    });

    describe('recordSuccess()', () => {
        test('should record success for proxy', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({ host: '127.0.0.1', port: 8080 });

            pool.recordSuccess(proxy.id, 100);

            expect(proxy.successCount).toBe(1);
            expect(pool.stats.successfulRequests).toBe(1);
        });

        test('should emit proxy:success event', (done) => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({ host: '127.0.0.1', port: 8080 });

            pool.on('proxy:success', (p) => {
                expect(p.id).toBe(proxy.id);
                done();
            });

            pool.recordSuccess(proxy.id, 100);
        });

        test('should handle non-existent proxy gracefully', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            expect(() => {
                pool.recordSuccess('non-existent', 100);
            }).not.toThrow();
        });
    });

    describe('recordFailure()', () => {
        test('should record failure for proxy', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({ host: '127.0.0.1', port: 8080 });

            pool.recordFailure(proxy.id, new Error('Test error'));

            expect(proxy.failureCount).toBe(1);
            expect(pool.stats.failedRequests).toBe(1);
        });

        test('should emit proxy:failure event', (done) => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({ host: '127.0.0.1', port: 8080 });

            pool.on('proxy:failure', (p, error) => {
                expect(p.id).toBe(proxy.id);
                done();
            });

            pool.recordFailure(proxy.id, new Error('Test error'));
        });

        test('should auto-blacklist after threshold failures', () => {
            const pool = new ProxyPool({
                healthCheckEnabled: false,
                autoBlacklistEnabled: true,
                consecutiveFailureThreshold: 3
            });

            const proxy = pool.addProxy({ host: '127.0.0.1', port: 8080 });

            for (let i = 0; i < 3; i++) {
                pool.recordFailure(proxy.id, new Error('Test error'));
            }

            expect(proxy.status).toBe(ProxyStatus.BLACKLISTED);
        });

        test('should not auto-blacklist when disabled', () => {
            const pool = new ProxyPool({
                healthCheckEnabled: false,
                autoBlacklistEnabled: false,
                consecutiveFailureThreshold: 3
            });

            const proxy = pool.addProxy({ host: '127.0.0.1', port: 8080 });

            for (let i = 0; i < 3; i++) {
                pool.recordFailure(proxy.id, new Error('Test error'));
            }

            expect(proxy.status).not.toBe(ProxyStatus.BLACKLISTED);
        });
    });

    describe('blacklistProxy()', () => {
        test('should blacklist proxy', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({ host: '127.0.0.1', port: 8080 });

            pool.blacklistProxy(proxy.id, 60000, 'Test blacklist');

            expect(proxy.status).toBe(ProxyStatus.BLACKLISTED);
        });

        test('should emit proxy:blacklisted event', (done) => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({ host: '127.0.0.1', port: 8080 });

            pool.on('proxy:blacklisted', (p) => {
                expect(p.id).toBe(proxy.id);
                done();
            });

            pool.blacklistProxy(proxy.id);
        });

        test('should throw error for non-existent proxy', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            expect(() => {
                pool.blacklistProxy('non-existent');
            }).toThrow('not found');
        });
    });

    describe('whitelistProxy()', () => {
        test('should whitelist proxy', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({ host: '127.0.0.1', port: 8080 });

            proxy.blacklist();
            pool.whitelistProxy(proxy.id);

            expect(proxy.status).not.toBe(ProxyStatus.BLACKLISTED);
        });

        test('should emit proxy:whitelisted event', (done) => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            const proxy = pool.addProxy({ host: '127.0.0.1', port: 8080 });

            proxy.blacklist();

            pool.on('proxy:whitelisted', (p) => {
                expect(p.id).toBe(proxy.id);
                done();
            });

            pool.whitelistProxy(proxy.id);
        });
    });

    describe('getProxiesByCountry()', () => {
        test('should return proxies from specific country', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({ host: '127.0.0.1', port: 8080, country: 'US' });
            pool.addProxy({ host: '127.0.0.2', port: 8080, country: 'US' });
            pool.addProxy({ host: '127.0.0.3', port: 8080, country: 'UK' });

            const proxies = pool.getProxiesByCountry('US');

            expect(proxies.length).toBe(2);
        });
    });

    describe('getStats()', () => {
        test('should return pool statistics', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({ host: '127.0.0.1', port: 8080 });
            pool.addProxy({ host: '127.0.0.2', port: 8080 });

            const stats = pool.getStats();

            expect(stats.totalProxies).toBe(2);
            expect(stats.healthyProxies).toBe(2);
            expect(stats.rotationStrategy).toBe(pool.rotationStrategy);
        });
    });

    describe('clear()', () => {
        test('should remove all proxies', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({ host: '127.0.0.1', port: 8080 });
            pool.addProxy({ host: '127.0.0.2', port: 8080 });

            pool.clear();

            expect(pool.proxies.size).toBe(0);
        });

        test('should emit pool:cleared event', (done) => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({ host: '127.0.0.1', port: 8080 });

            pool.on('pool:cleared', () => {
                done();
            });

            pool.clear();
        });
    });

    describe('destroy()', () => {
        test('should stop health checking', () => {
            const pool = new ProxyPool({ healthCheckEnabled: true });

            pool.destroy();

            expect(pool.healthCheckTimer).toBeNull();
        });

        test('should clear all proxies', () => {
            const pool = new ProxyPool({ healthCheckEnabled: false });

            pool.addProxy({ host: '127.0.0.1', port: 8080 });
            pool.destroy();

            expect(pool.proxies.size).toBe(0);
        });
    });
});
