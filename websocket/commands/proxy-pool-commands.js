/**
 * WebSocket commands for proxy pool management
 */

const { ProxyPool, RotationStrategy, ProxyType } = require('../../proxy/proxy-pool');

// Global proxy pool instance
let globalProxyPool = null;

/**
 * Get or create proxy pool instance
 */
function getProxyPool(config = {}) {
    if (!globalProxyPool) {
        globalProxyPool = new ProxyPool(config);

        // Set up event listeners for logging
        globalProxyPool.on('proxy:added', (proxy) => {
            console.log(`[ProxyPool] Proxy added: ${proxy.id}`);
        });

        globalProxyPool.on('proxy:removed', (proxy) => {
            console.log(`[ProxyPool] Proxy removed: ${proxy.id}`);
        });

        globalProxyPool.on('proxy:blacklisted', (proxy) => {
            console.log(`[ProxyPool] Proxy blacklisted: ${proxy.id} - ${proxy.blacklistReason}`);
        });

        globalProxyPool.on('proxy:whitelisted', (proxy) => {
            console.log(`[ProxyPool] Proxy whitelisted: ${proxy.id}`);
        });

        globalProxyPool.on('health-check:completed', (result) => {
            console.log(`[ProxyPool] Health check completed: ${result.successful}/${result.total} successful`);
        });
    }

    return globalProxyPool;
}

/**
 * Add proxy to pool
 */
async function addProxyToPool(params) {
    const {
        host,
        port,
        type = 'http',
        username,
        password,
        country,
        region,
        city,
        tags = [],
        weight = 1,
        maxRequestsPerMinute = Infinity,
        id
    } = params;

    if (!host) {
        throw new Error('Host is required');
    }

    if (!port) {
        throw new Error('Port is required');
    }

    const pool = getProxyPool();

    const proxy = pool.addProxy({
        id,
        host,
        port,
        type,
        username,
        password,
        country,
        region,
        city,
        tags,
        weight,
        maxRequestsPerMinute
    });

    return {
        success: true,
        message: 'Proxy added to pool',
        proxy: proxy.getStats()
    };
}

/**
 * Remove proxy from pool
 */
async function removeProxyFromPool(params) {
    const { proxyId } = params;

    if (!proxyId) {
        throw new Error('Proxy ID is required');
    }

    const pool = getProxyPool();
    const proxy = pool.removeProxy(proxyId);

    return {
        success: true,
        message: 'Proxy removed from pool',
        proxy: proxy.getStats()
    };
}

/**
 * List all proxies in pool
 */
async function listProxyPool(params = {}) {
    const {
        includeBlacklisted = true,
        includeUnhealthy = true,
        country,
        region,
        city,
        type,
        tags,
        minSuccessRate,
        maxResponseTime
    } = params;

    const pool = getProxyPool();
    let proxies = pool.getAllProxies();

    // Apply filters
    if (!includeBlacklisted) {
        proxies = proxies.filter(p => p.status !== 'blacklisted');
    }

    if (!includeUnhealthy) {
        proxies = proxies.filter(p => p.status !== 'unhealthy');
    }

    if (country) {
        proxies = proxies.filter(p => p.country === country);
    }

    if (region) {
        proxies = proxies.filter(p => p.region === region);
    }

    if (city) {
        proxies = proxies.filter(p => p.city === city);
    }

    if (type) {
        proxies = proxies.filter(p => p.type === type);
    }

    if (tags && tags.length > 0) {
        proxies = proxies.filter(p =>
            tags.some(tag => p.tags.includes(tag))
        );
    }

    if (minSuccessRate !== undefined) {
        proxies = proxies.filter(p => p.getSuccessRate() >= minSuccessRate);
    }

    if (maxResponseTime !== undefined) {
        proxies = proxies.filter(p =>
            p.averageResponseTime <= maxResponseTime || p.averageResponseTime === 0
        );
    }

    return {
        success: true,
        count: proxies.length,
        proxies: proxies.map(p => p.getStats())
    };
}

/**
 * Get next proxy based on rotation strategy
 */
async function getNextProxy(params = {}) {
    const {
        strategy,
        country,
        region,
        city,
        type,
        tags,
        minSuccessRate,
        maxResponseTime
    } = params;

    const pool = getProxyPool();

    // Temporarily set strategy if provided
    const originalStrategy = pool.rotationStrategy;
    if (strategy) {
        pool.setRotationStrategy(strategy);
    }

    try {
        const filters = {};

        if (country) filters.country = country;
        if (region) filters.region = region;
        if (city) filters.city = city;
        if (type) filters.type = type;
        if (tags) filters.tags = tags;
        if (minSuccessRate !== undefined) filters.minSuccessRate = minSuccessRate;
        if (maxResponseTime !== undefined) filters.maxResponseTime = maxResponseTime;

        const proxy = pool.getNextProxy(filters);

        return {
            success: true,
            proxy: proxy.getStats(),
            proxyUrl: proxy.getUrl()
        };
    } catch (error) {
        throw new Error(`Failed to get next proxy: ${error.message}`);
    } finally {
        // Restore original strategy if it was changed
        if (strategy && strategy !== originalStrategy) {
            pool.setRotationStrategy(originalStrategy);
        }
    }
}

/**
 * Test proxy health
 */
async function testProxyHealth(params) {
    const { proxyId } = params;

    if (!proxyId) {
        throw new Error('Proxy ID is required');
    }

    const pool = getProxyPool();
    const result = await pool.testProxyHealth(proxyId);

    return {
        success: true,
        healthCheck: result
    };
}

/**
 * Test all proxies health
 */
async function testAllProxiesHealth(params = {}) {
    const pool = getProxyPool();
    const proxies = pool.getAllProxies();

    const results = await Promise.allSettled(
        proxies.map(async (proxy) => {
            const result = await pool.testProxyHealth(proxy.id);
            return {
                proxyId: proxy.id,
                ...result
            };
        })
    );

    const healthChecks = results.map(r =>
        r.status === 'fulfilled' ? r.value : { error: r.reason.message }
    );

    const successful = healthChecks.filter(h => h.success).length;
    const failed = healthChecks.filter(h => !h.success).length;

    return {
        success: true,
        total: healthChecks.length,
        successful,
        failed,
        healthChecks
    };
}

/**
 * Get proxy statistics
 */
async function getProxyStats(params) {
    const { proxyId } = params;

    if (!proxyId) {
        throw new Error('Proxy ID is required');
    }

    const pool = getProxyPool();
    const stats = pool.getProxyStats(proxyId);

    return {
        success: true,
        stats
    };
}

/**
 * Get pool statistics
 */
async function getPoolStats(params = {}) {
    const pool = getProxyPool();
    const stats = pool.getStats();
    const proxies = pool.getAllProxies();

    // Calculate additional statistics
    const totalResponseTime = proxies.reduce((sum, p) =>
        sum + (p.averageResponseTime || 0), 0
    );
    const avgResponseTime = proxies.length > 0 ?
        totalResponseTime / proxies.length : 0;

    const proxyStats = proxies.map(p => ({
        id: p.id,
        status: p.status,
        successRate: p.getSuccessRate(),
        totalRequests: p.totalRequests,
        averageResponseTime: p.averageResponseTime,
        country: p.country
    }));

    return {
        success: true,
        poolStats: stats,
        averageResponseTime: avgResponseTime,
        proxies: proxyStats
    };
}

/**
 * Set rotation strategy
 */
async function setProxyRotationStrategy(params) {
    const { strategy } = params;

    if (!strategy) {
        throw new Error('Strategy is required');
    }

    if (!Object.values(RotationStrategy).includes(strategy)) {
        throw new Error(`Invalid strategy. Must be one of: ${Object.values(RotationStrategy).join(', ')}`);
    }

    const pool = getProxyPool();
    pool.setRotationStrategy(strategy);

    return {
        success: true,
        message: `Rotation strategy set to ${strategy}`,
        strategy: pool.rotationStrategy
    };
}

/**
 * Blacklist proxy
 */
async function blacklistProxy(params) {
    const {
        proxyId,
        durationMs = 3600000, // 1 hour default
        reason = 'Manual blacklist'
    } = params;

    if (!proxyId) {
        throw new Error('Proxy ID is required');
    }

    const pool = getProxyPool();
    pool.blacklistProxy(proxyId, durationMs, reason);

    const proxy = pool.getProxy(proxyId);

    return {
        success: true,
        message: 'Proxy blacklisted',
        proxy: proxy.getStats()
    };
}

/**
 * Whitelist proxy (remove from blacklist)
 */
async function whitelistProxy(params) {
    const { proxyId } = params;

    if (!proxyId) {
        throw new Error('Proxy ID is required');
    }

    const pool = getProxyPool();
    pool.whitelistProxy(proxyId);

    const proxy = pool.getProxy(proxyId);

    return {
        success: true,
        message: 'Proxy whitelisted',
        proxy: proxy.getStats()
    };
}

/**
 * Get proxies by country
 */
async function getProxiesByCountry(params) {
    const { country } = params;

    if (!country) {
        throw new Error('Country is required');
    }

    const pool = getProxyPool();
    const proxies = pool.getProxiesByCountry(country);

    return {
        success: true,
        country,
        count: proxies.length,
        proxies: proxies.map(p => p.getStats())
    };
}

/**
 * Get proxies by region
 */
async function getProxiesByRegion(params) {
    const { region } = params;

    if (!region) {
        throw new Error('Region is required');
    }

    const pool = getProxyPool();
    const proxies = pool.getProxiesByRegion(region);

    return {
        success: true,
        region,
        count: proxies.length,
        proxies: proxies.map(p => p.getStats())
    };
}

/**
 * Get proxies by city
 */
async function getProxiesByCity(params) {
    const { city } = params;

    if (!city) {
        throw new Error('City is required');
    }

    const pool = getProxyPool();
    const proxies = pool.getProxiesByCity(city);

    return {
        success: true,
        city,
        count: proxies.length,
        proxies: proxies.map(p => p.getStats())
    };
}

/**
 * Get proxies by type
 */
async function getProxiesByType(params) {
    const { type } = params;

    if (!type) {
        throw new Error('Type is required');
    }

    const pool = getProxyPool();
    const proxies = pool.getProxiesByType(type);

    return {
        success: true,
        type,
        count: proxies.length,
        proxies: proxies.map(p => p.getStats())
    };
}

/**
 * Get proxies by tags
 */
async function getProxiesByTags(params) {
    const { tags } = params;

    if (!tags || !Array.isArray(tags)) {
        throw new Error('Tags array is required');
    }

    const pool = getProxyPool();
    const proxies = pool.getProxiesByTags(tags);

    return {
        success: true,
        tags,
        count: proxies.length,
        proxies: proxies.map(p => p.getStats())
    };
}

/**
 * Configure health checking
 */
async function configureHealthCheck(params) {
    const {
        enabled,
        interval,
        url,
        timeout
    } = params;

    const pool = getProxyPool();

    if (enabled !== undefined) {
        pool.healthCheckEnabled = enabled;

        if (enabled) {
            pool.startHealthChecking();
        } else {
            pool.stopHealthChecking();
        }
    }

    if (interval !== undefined) {
        pool.healthCheckInterval = interval;

        if (pool.healthCheckEnabled) {
            pool.stopHealthChecking();
            pool.startHealthChecking();
        }
    }

    if (url !== undefined) {
        pool.healthCheckUrl = url;
    }

    if (timeout !== undefined) {
        pool.healthCheckTimeout = timeout;
    }

    return {
        success: true,
        message: 'Health check configuration updated',
        config: {
            enabled: pool.healthCheckEnabled,
            interval: pool.healthCheckInterval,
            url: pool.healthCheckUrl,
            timeout: pool.healthCheckTimeout
        }
    };
}

/**
 * Record proxy success
 */
async function recordProxySuccess(params) {
    const { proxyId, responseTimeMs } = params;

    if (!proxyId) {
        throw new Error('Proxy ID is required');
    }

    if (responseTimeMs === undefined) {
        throw new Error('Response time is required');
    }

    const pool = getProxyPool();
    pool.recordSuccess(proxyId, responseTimeMs);

    const proxy = pool.getProxy(proxyId);

    return {
        success: true,
        message: 'Success recorded',
        proxy: proxy.getStats()
    };
}

/**
 * Record proxy failure
 */
async function recordProxyFailure(params) {
    const { proxyId, error } = params;

    if (!proxyId) {
        throw new Error('Proxy ID is required');
    }

    const pool = getProxyPool();
    pool.recordFailure(proxyId, error || 'Unknown error');

    const proxy = pool.getProxy(proxyId);

    return {
        success: true,
        message: 'Failure recorded',
        proxy: proxy.getStats()
    };
}

/**
 * Clear proxy pool
 */
async function clearProxyPool(params = {}) {
    const pool = getProxyPool();
    pool.clear();

    return {
        success: true,
        message: 'Proxy pool cleared'
    };
}

/**
 * Export proxy pool configuration
 */
async function exportProxyPool(params = {}) {
    const pool = getProxyPool();
    const proxies = pool.getAllProxies();

    const config = {
        rotationStrategy: pool.rotationStrategy,
        healthCheck: {
            enabled: pool.healthCheckEnabled,
            interval: pool.healthCheckInterval,
            url: pool.healthCheckUrl,
            timeout: pool.healthCheckTimeout
        },
        proxies: proxies.map(p => ({
            id: p.id,
            host: p.host,
            port: p.port,
            type: p.type,
            username: p.username,
            password: p.password,
            country: p.country,
            region: p.region,
            city: p.city,
            tags: p.tags,
            weight: p.weight,
            maxRequestsPerMinute: p.maxRequestsPerMinute
        }))
    };

    return {
        success: true,
        config
    };
}

/**
 * Import proxy pool configuration
 */
async function importProxyPool(params) {
    const { config } = params;

    if (!config) {
        throw new Error('Config is required');
    }

    const pool = getProxyPool();

    // Clear existing pool
    pool.clear();

    // Set rotation strategy
    if (config.rotationStrategy) {
        pool.setRotationStrategy(config.rotationStrategy);
    }

    // Configure health check
    if (config.healthCheck) {
        await configureHealthCheck(config.healthCheck);
    }

    // Add proxies
    if (config.proxies && Array.isArray(config.proxies)) {
        for (const proxyConfig of config.proxies) {
            await addProxyToPool(proxyConfig);
        }
    }

    return {
        success: true,
        message: 'Proxy pool imported',
        proxiesImported: config.proxies ? config.proxies.length : 0
    };
}

/**
 * Get rotation strategies
 */
async function getRotationStrategies(params = {}) {
    return {
        success: true,
        strategies: Object.values(RotationStrategy),
        current: getProxyPool().rotationStrategy,
        descriptions: {
            'round-robin': 'Cycles through proxies in order',
            'random': 'Selects random proxy',
            'least-used': 'Selects proxy with fewest total requests',
            'fastest': 'Selects proxy with lowest average response time',
            'weighted': 'Selects proxy based on weight (higher weight = higher probability)'
        }
    };
}

/**
 * Get proxy types
 */
async function getProxyTypes(params = {}) {
    return {
        success: true,
        types: Object.values(ProxyType),
        descriptions: {
            'http': 'HTTP proxy',
            'https': 'HTTPS proxy',
            'socks4': 'SOCKS4 proxy',
            'socks5': 'SOCKS5 proxy (most versatile)'
        }
    };
}

module.exports = {
    // Main commands
    add_proxy_to_pool: addProxyToPool,
    remove_proxy_from_pool: removeProxyFromPool,
    list_proxy_pool: listProxyPool,
    get_next_proxy: getNextProxy,
    test_proxy_health: testProxyHealth,
    test_all_proxies_health: testAllProxiesHealth,
    get_proxy_stats: getProxyStats,
    get_pool_stats: getPoolStats,
    set_proxy_rotation_strategy: setProxyRotationStrategy,
    blacklist_proxy: blacklistProxy,
    whitelist_proxy: whitelistProxy,

    // Geographic filtering
    get_proxies_by_country: getProxiesByCountry,
    get_proxies_by_region: getProxiesByRegion,
    get_proxies_by_city: getProxiesByCity,
    get_proxies_by_type: getProxiesByType,
    get_proxies_by_tags: getProxiesByTags,

    // Configuration
    configure_health_check: configureHealthCheck,
    record_proxy_success: recordProxySuccess,
    record_proxy_failure: recordProxyFailure,
    clear_proxy_pool: clearProxyPool,
    export_proxy_pool: exportProxyPool,
    import_proxy_pool: importProxyPool,

    // Info
    get_rotation_strategies: getRotationStrategies,
    get_proxy_types: getProxyTypes,

    // For testing
    getProxyPool
};
