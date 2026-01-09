/**
 * Proxy Pool Manager - Advanced proxy rotation with health checking
 * Supports multiple rotation strategies and automatic failover
 */

const EventEmitter = require('events');
const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * Rotation strategies for proxy selection
 */
const RotationStrategy = {
    ROUND_ROBIN: 'round-robin',
    RANDOM: 'random',
    LEAST_USED: 'least-used',
    FASTEST: 'fastest',
    WEIGHTED: 'weighted'
};

/**
 * Proxy types supported
 */
const ProxyType = {
    HTTP: 'http',
    HTTPS: 'https',
    SOCKS4: 'socks4',
    SOCKS5: 'socks5'
};

/**
 * Proxy health status
 */
const ProxyStatus = {
    HEALTHY: 'healthy',
    DEGRADED: 'degraded',
    UNHEALTHY: 'unhealthy',
    BLACKLISTED: 'blacklisted'
};

/**
 * Individual proxy with health metrics
 */
class Proxy {
    constructor(config) {
        this.id = config.id || this._generateId(config);
        this.host = config.host;
        this.port = config.port;
        this.type = config.type || ProxyType.HTTP;
        this.username = config.username || null;
        this.password = config.password || null;
        this.country = config.country || null;
        this.region = config.region || null;
        this.city = config.city || null;
        this.tags = config.tags || [];

        // Health metrics
        this.status = ProxyStatus.HEALTHY;
        this.successCount = 0;
        this.failureCount = 0;
        this.totalRequests = 0;
        this.lastUsed = null;
        this.lastChecked = null;
        this.lastSuccess = null;
        this.lastFailure = null;
        this.consecutiveFailures = 0;
        this.responseTimeMs = [];
        this.averageResponseTime = 0;
        this.weight = config.weight || 1;

        // Rate limiting
        this.requestsPerMinute = 0;
        this.requestTimestamps = [];
        this.maxRequestsPerMinute = config.maxRequestsPerMinute || Infinity;

        // Blacklisting
        this.blacklistedUntil = null;
        this.blacklistReason = null;

        // Created timestamp
        this.createdAt = Date.now();
    }

    _generateId(config) {
        const auth = config.username ? `${config.username}@` : '';
        return `${config.type}://${auth}${config.host}:${config.port}`;
    }

    /**
     * Get proxy URL string
     */
    getUrl() {
        if (this.username && this.password) {
            return `${this.type}://${this.username}:${this.password}@${this.host}:${this.port}`;
        }
        return `${this.type}://${this.host}:${this.port}`;
    }

    /**
     * Check if proxy is available for use
     */
    isAvailable() {
        if (this.status === ProxyStatus.BLACKLISTED) {
            if (this.blacklistedUntil && Date.now() > this.blacklistedUntil) {
                this.unblacklist();
                return true;
            }
            return false;
        }

        // Check rate limit
        if (this.isRateLimited()) {
            return false;
        }

        return this.status !== ProxyStatus.UNHEALTHY;
    }

    /**
     * Check if proxy is rate limited
     */
    isRateLimited() {
        if (this.maxRequestsPerMinute === Infinity) {
            return false;
        }

        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        // Clean old timestamps
        this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
        this.requestsPerMinute = this.requestTimestamps.length;

        return this.requestsPerMinute >= this.maxRequestsPerMinute;
    }

    /**
     * Record request usage
     */
    recordRequest() {
        this.totalRequests++;
        this.lastUsed = Date.now();
        this.requestTimestamps.push(Date.now());
    }

    /**
     * Record successful request
     */
    recordSuccess(responseTimeMs) {
        this.successCount++;
        this.lastSuccess = Date.now();
        this.consecutiveFailures = 0;

        // Update response time metrics
        this.responseTimeMs.push(responseTimeMs);
        if (this.responseTimeMs.length > 100) {
            this.responseTimeMs.shift();
        }
        this._updateAverageResponseTime();

        // Update status
        if (this.status === ProxyStatus.UNHEALTHY) {
            this.status = ProxyStatus.DEGRADED;
        } else if (this.status === ProxyStatus.DEGRADED && this.consecutiveFailures === 0) {
            this.status = ProxyStatus.HEALTHY;
        }
    }

    /**
     * Record failed request
     */
    recordFailure(error) {
        this.failureCount++;
        this.lastFailure = Date.now();
        this.consecutiveFailures++;

        // Update status based on consecutive failures
        if (this.consecutiveFailures >= 5) {
            this.status = ProxyStatus.UNHEALTHY;
        } else if (this.consecutiveFailures >= 3) {
            this.status = ProxyStatus.DEGRADED;
        }
    }

    /**
     * Blacklist proxy
     */
    blacklist(durationMs = 3600000, reason = 'Manual blacklist') {
        this.status = ProxyStatus.BLACKLISTED;
        this.blacklistedUntil = Date.now() + durationMs;
        this.blacklistReason = reason;
    }

    /**
     * Remove proxy from blacklist
     */
    unblacklist() {
        if (this.status === ProxyStatus.BLACKLISTED) {
            this.status = ProxyStatus.DEGRADED;
            this.blacklistedUntil = null;
            this.blacklistReason = null;
            this.consecutiveFailures = 0;
        }
    }

    /**
     * Calculate average response time
     */
    _updateAverageResponseTime() {
        if (this.responseTimeMs.length === 0) {
            this.averageResponseTime = 0;
            return;
        }

        const sum = this.responseTimeMs.reduce((a, b) => a + b, 0);
        this.averageResponseTime = sum / this.responseTimeMs.length;
    }

    /**
     * Get success rate
     */
    getSuccessRate() {
        if (this.totalRequests === 0) {
            return 1.0;
        }
        return this.successCount / this.totalRequests;
    }

    /**
     * Get proxy statistics
     */
    getStats() {
        return {
            id: this.id,
            host: this.host,
            port: this.port,
            type: this.type,
            country: this.country,
            region: this.region,
            city: this.city,
            tags: this.tags,
            status: this.status,
            successCount: this.successCount,
            failureCount: this.failureCount,
            totalRequests: this.totalRequests,
            successRate: this.getSuccessRate(),
            consecutiveFailures: this.consecutiveFailures,
            averageResponseTime: this.averageResponseTime,
            requestsPerMinute: this.requestsPerMinute,
            maxRequestsPerMinute: this.maxRequestsPerMinute,
            lastUsed: this.lastUsed,
            lastChecked: this.lastChecked,
            lastSuccess: this.lastSuccess,
            lastFailure: this.lastFailure,
            weight: this.weight,
            blacklisted: this.status === ProxyStatus.BLACKLISTED,
            blacklistedUntil: this.blacklistedUntil,
            blacklistReason: this.blacklistReason,
            createdAt: this.createdAt
        };
    }

    /**
     * Export proxy configuration
     */
    toJSON() {
        return this.getStats();
    }
}

/**
 * Proxy Pool Manager
 */
class ProxyPool extends EventEmitter {
    constructor(config = {}) {
        super();

        this.proxies = new Map();
        this.rotationStrategy = config.rotationStrategy || RotationStrategy.ROUND_ROBIN;
        this.currentIndex = 0;

        // Health check configuration
        this.healthCheckEnabled = config.healthCheckEnabled !== false;
        this.healthCheckInterval = config.healthCheckInterval || 300000; // 5 minutes
        this.healthCheckUrl = config.healthCheckUrl || 'https://www.google.com';
        this.healthCheckTimeout = config.healthCheckTimeout || 10000;
        this.healthCheckTimer = null;

        // Failure thresholds
        this.consecutiveFailureThreshold = config.consecutiveFailureThreshold || 5;
        this.autoBlacklistEnabled = config.autoBlacklistEnabled !== false;
        this.autoBlacklistDuration = config.autoBlacklistDuration || 3600000; // 1 hour

        // Statistics
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalProxies: 0,
            healthyProxies: 0,
            degradedProxies: 0,
            unhealthyProxies: 0,
            blacklistedProxies: 0
        };

        // Start health checking
        if (this.healthCheckEnabled) {
            this.startHealthChecking();
        }
    }

    /**
     * Add proxy to pool
     */
    addProxy(config) {
        const proxy = new Proxy(config);

        if (this.proxies.has(proxy.id)) {
            throw new Error(`Proxy ${proxy.id} already exists in pool`);
        }

        this.proxies.set(proxy.id, proxy);
        this._updateStats();

        this.emit('proxy:added', proxy);

        // Perform initial health check
        if (this.healthCheckEnabled) {
            this._checkProxyHealth(proxy);
        }

        return proxy;
    }

    /**
     * Remove proxy from pool
     */
    removeProxy(proxyId) {
        const proxy = this.proxies.get(proxyId);

        if (!proxy) {
            throw new Error(`Proxy ${proxyId} not found in pool`);
        }

        this.proxies.delete(proxyId);
        this._updateStats();

        this.emit('proxy:removed', proxy);

        return proxy;
    }

    /**
     * Get proxy by ID
     */
    getProxy(proxyId) {
        return this.proxies.get(proxyId);
    }

    /**
     * Get all proxies
     */
    getAllProxies() {
        return Array.from(this.proxies.values());
    }

    /**
     * Get available proxies
     */
    getAvailableProxies(filters = {}) {
        let proxies = Array.from(this.proxies.values()).filter(p => p.isAvailable());

        // Apply filters
        if (filters.country) {
            proxies = proxies.filter(p => p.country === filters.country);
        }

        if (filters.region) {
            proxies = proxies.filter(p => p.region === filters.region);
        }

        if (filters.city) {
            proxies = proxies.filter(p => p.city === filters.city);
        }

        if (filters.type) {
            proxies = proxies.filter(p => p.type === filters.type);
        }

        if (filters.tags && filters.tags.length > 0) {
            proxies = proxies.filter(p =>
                filters.tags.some(tag => p.tags.includes(tag))
            );
        }

        if (filters.minSuccessRate !== undefined) {
            proxies = proxies.filter(p => p.getSuccessRate() >= filters.minSuccessRate);
        }

        if (filters.maxResponseTime !== undefined) {
            proxies = proxies.filter(p =>
                p.averageResponseTime <= filters.maxResponseTime || p.averageResponseTime === 0
            );
        }

        return proxies;
    }

    /**
     * Get next proxy based on rotation strategy
     */
    getNextProxy(filters = {}) {
        const availableProxies = this.getAvailableProxies(filters);

        if (availableProxies.length === 0) {
            throw new Error('No available proxies in pool');
        }

        let selectedProxy;

        switch (this.rotationStrategy) {
            case RotationStrategy.ROUND_ROBIN:
                selectedProxy = this._selectRoundRobin(availableProxies);
                break;

            case RotationStrategy.RANDOM:
                selectedProxy = this._selectRandom(availableProxies);
                break;

            case RotationStrategy.LEAST_USED:
                selectedProxy = this._selectLeastUsed(availableProxies);
                break;

            case RotationStrategy.FASTEST:
                selectedProxy = this._selectFastest(availableProxies);
                break;

            case RotationStrategy.WEIGHTED:
                selectedProxy = this._selectWeighted(availableProxies);
                break;

            default:
                selectedProxy = availableProxies[0];
        }

        selectedProxy.recordRequest();
        this.stats.totalRequests++;

        this.emit('proxy:selected', selectedProxy);

        return selectedProxy;
    }

    /**
     * Round-robin selection
     */
    _selectRoundRobin(proxies) {
        const proxy = proxies[this.currentIndex % proxies.length];
        this.currentIndex++;
        return proxy;
    }

    /**
     * Random selection
     */
    _selectRandom(proxies) {
        const index = Math.floor(Math.random() * proxies.length);
        return proxies[index];
    }

    /**
     * Least used selection
     */
    _selectLeastUsed(proxies) {
        return proxies.reduce((least, current) => {
            if (current.totalRequests < least.totalRequests) {
                return current;
            }
            return least;
        });
    }

    /**
     * Fastest proxy selection
     */
    _selectFastest(proxies) {
        // Filter proxies with response time data
        const proxiesWithData = proxies.filter(p => p.averageResponseTime > 0);

        if (proxiesWithData.length === 0) {
            return this._selectRandom(proxies);
        }

        return proxiesWithData.reduce((fastest, current) => {
            if (current.averageResponseTime < fastest.averageResponseTime) {
                return current;
            }
            return fastest;
        });
    }

    /**
     * Weighted random selection
     */
    _selectWeighted(proxies) {
        const totalWeight = proxies.reduce((sum, p) => sum + p.weight, 0);
        let random = Math.random() * totalWeight;

        for (const proxy of proxies) {
            random -= proxy.weight;
            if (random <= 0) {
                return proxy;
            }
        }

        return proxies[proxies.length - 1];
    }

    /**
     * Set rotation strategy
     */
    setRotationStrategy(strategy) {
        if (!Object.values(RotationStrategy).includes(strategy)) {
            throw new Error(`Invalid rotation strategy: ${strategy}`);
        }

        this.rotationStrategy = strategy;
        this.currentIndex = 0;

        this.emit('strategy:changed', strategy);
    }

    /**
     * Record successful proxy request
     */
    recordSuccess(proxyId, responseTimeMs) {
        const proxy = this.proxies.get(proxyId);

        if (!proxy) {
            return;
        }

        proxy.recordSuccess(responseTimeMs);
        this.stats.successfulRequests++;
        this._updateStats();

        this.emit('proxy:success', proxy);
    }

    /**
     * Record failed proxy request
     */
    recordFailure(proxyId, error) {
        const proxy = this.proxies.get(proxyId);

        if (!proxy) {
            return;
        }

        proxy.recordFailure(error);
        this.stats.failedRequests++;
        this._updateStats();

        this.emit('proxy:failure', proxy, error);

        // Auto-blacklist if threshold reached
        if (this.autoBlacklistEnabled &&
            proxy.consecutiveFailures >= this.consecutiveFailureThreshold) {
            this.blacklistProxy(proxyId, this.autoBlacklistDuration,
                `Automatic blacklist after ${proxy.consecutiveFailures} consecutive failures`);
        }
    }

    /**
     * Blacklist proxy
     */
    blacklistProxy(proxyId, durationMs = 3600000, reason = 'Manual blacklist') {
        const proxy = this.proxies.get(proxyId);

        if (!proxy) {
            throw new Error(`Proxy ${proxyId} not found in pool`);
        }

        proxy.blacklist(durationMs, reason);
        this._updateStats();

        this.emit('proxy:blacklisted', proxy);
    }

    /**
     * Whitelist proxy (remove from blacklist)
     */
    whitelistProxy(proxyId) {
        const proxy = this.proxies.get(proxyId);

        if (!proxy) {
            throw new Error(`Proxy ${proxyId} not found in pool`);
        }

        proxy.unblacklist();
        this._updateStats();

        this.emit('proxy:whitelisted', proxy);
    }

    /**
     * Test proxy health
     */
    async testProxyHealth(proxyId) {
        const proxy = this.proxies.get(proxyId);

        if (!proxy) {
            throw new Error(`Proxy ${proxyId} not found in pool`);
        }

        return await this._checkProxyHealth(proxy);
    }

    /**
     * Check proxy health
     */
    async _checkProxyHealth(proxy) {
        const startTime = Date.now();

        try {
            const result = await this._performHealthCheck(proxy);
            const responseTime = Date.now() - startTime;

            proxy.lastChecked = Date.now();

            if (result.success) {
                proxy.recordSuccess(responseTime);
                return {
                    success: true,
                    proxyId: proxy.id,
                    responseTime,
                    status: proxy.status
                };
            } else {
                proxy.recordFailure(result.error);
                return {
                    success: false,
                    proxyId: proxy.id,
                    error: result.error,
                    status: proxy.status
                };
            }
        } catch (error) {
            proxy.lastChecked = Date.now();
            proxy.recordFailure(error);

            return {
                success: false,
                proxyId: proxy.id,
                error: error.message,
                status: proxy.status
            };
        }
    }

    /**
     * Perform actual health check
     */
    _performHealthCheck(proxy) {
        return new Promise((resolve) => {
            const url = new URL(this.healthCheckUrl);
            const protocol = url.protocol === 'https:' ? https : http;

            const options = {
                host: proxy.host,
                port: proxy.port,
                method: 'GET',
                path: url.href,
                timeout: this.healthCheckTimeout,
                headers: {
                    'User-Agent': 'BassetHound/1.0 Health Check'
                }
            };

            // Add proxy authentication if needed
            if (proxy.username && proxy.password) {
                const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
                options.headers['Proxy-Authorization'] = `Basic ${auth}`;
            }

            const req = protocol.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true });
                    } else {
                        resolve({
                            success: false,
                            error: `HTTP ${res.statusCode}`
                        });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({ success: false, error: error.message });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });

            req.end();
        });
    }

    /**
     * Start health checking
     */
    startHealthChecking() {
        if (this.healthCheckTimer) {
            return;
        }

        this.healthCheckTimer = setInterval(() => {
            this._performHealthChecks();
        }, this.healthCheckInterval);

        // Perform initial check
        this._performHealthChecks();
    }

    /**
     * Stop health checking
     */
    stopHealthChecking() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }

    /**
     * Perform health checks on all proxies
     */
    async _performHealthChecks() {
        const proxies = Array.from(this.proxies.values());

        this.emit('health-check:started', proxies.length);

        const results = await Promise.allSettled(
            proxies.map(proxy => this._checkProxyHealth(proxy))
        );

        this._updateStats();

        this.emit('health-check:completed', {
            total: results.length,
            successful: results.filter(r => r.status === 'fulfilled' && r.value.success).length,
            failed: results.filter(r => r.status === 'rejected' || !r.value.success).length
        });
    }

    /**
     * Get proxies by country
     */
    getProxiesByCountry(country) {
        return this.getAvailableProxies({ country });
    }

    /**
     * Get proxies by region
     */
    getProxiesByRegion(region) {
        return this.getAvailableProxies({ region });
    }

    /**
     * Get proxies by city
     */
    getProxiesByCity(city) {
        return this.getAvailableProxies({ city });
    }

    /**
     * Get proxies by type
     */
    getProxiesByType(type) {
        return this.getAvailableProxies({ type });
    }

    /**
     * Get proxies by tags
     */
    getProxiesByTags(tags) {
        return this.getAvailableProxies({ tags });
    }

    /**
     * Update pool statistics
     */
    _updateStats() {
        const proxies = Array.from(this.proxies.values());

        this.stats.totalProxies = proxies.length;
        this.stats.healthyProxies = proxies.filter(p => p.status === ProxyStatus.HEALTHY).length;
        this.stats.degradedProxies = proxies.filter(p => p.status === ProxyStatus.DEGRADED).length;
        this.stats.unhealthyProxies = proxies.filter(p => p.status === ProxyStatus.UNHEALTHY).length;
        this.stats.blacklistedProxies = proxies.filter(p => p.status === ProxyStatus.BLACKLISTED).length;
    }

    /**
     * Get pool statistics
     */
    getStats() {
        return {
            ...this.stats,
            rotationStrategy: this.rotationStrategy,
            healthCheckEnabled: this.healthCheckEnabled,
            healthCheckInterval: this.healthCheckInterval,
            autoBlacklistEnabled: this.autoBlacklistEnabled,
            consecutiveFailureThreshold: this.consecutiveFailureThreshold
        };
    }

    /**
     * Get detailed proxy statistics
     */
    getProxyStats(proxyId) {
        const proxy = this.proxies.get(proxyId);

        if (!proxy) {
            throw new Error(`Proxy ${proxyId} not found in pool`);
        }

        return proxy.getStats();
    }

    /**
     * Clear all proxies
     */
    clear() {
        this.proxies.clear();
        this.currentIndex = 0;
        this._updateStats();

        this.emit('pool:cleared');
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        this.stopHealthChecking();
        this.clear();
        this.removeAllListeners();
    }
}

module.exports = {
    ProxyPool,
    Proxy,
    RotationStrategy,
    ProxyType,
    ProxyStatus
};
