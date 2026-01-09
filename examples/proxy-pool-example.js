/**
 * Proxy Pool Example Usage
 *
 * This example demonstrates the advanced proxy rotation capabilities
 * of the Basset Hound Browser proxy pool system.
 */

const { ProxyPool, RotationStrategy, ProxyType, ProxyStatus } = require('../proxy/proxy-pool');

// ============================================================================
// EXAMPLE 1: Basic Setup
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 1: Basic Proxy Pool Setup');
console.log('='.repeat(80));

const pool = new ProxyPool({
    rotationStrategy: RotationStrategy.ROUND_ROBIN,
    healthCheckEnabled: true,
    healthCheckInterval: 300000, // 5 minutes
    healthCheckUrl: 'https://www.google.com',
    healthCheckTimeout: 10000,
    autoBlacklistEnabled: true,
    consecutiveFailureThreshold: 5,
    autoBlacklistDuration: 3600000 // 1 hour
});

console.log('✅ Proxy pool created with configuration:');
console.log(`   - Strategy: ${pool.rotationStrategy}`);
console.log(`   - Health Check: ${pool.healthCheckEnabled}`);
console.log(`   - Auto-Blacklist: ${pool.autoBlacklistEnabled}`);
console.log();

// ============================================================================
// EXAMPLE 2: Adding Proxies
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 2: Adding Proxies from Multiple Countries');
console.log('='.repeat(80));

// Add US proxies
const usProxy1 = pool.addProxy({
    host: 'us-proxy-1.example.com',
    port: 8080,
    type: ProxyType.HTTP,
    country: 'US',
    region: 'California',
    city: 'San Francisco',
    tags: ['premium', 'datacenter'],
    weight: 5,
    maxRequestsPerMinute: 100
});

const usProxy2 = pool.addProxy({
    host: 'us-proxy-2.example.com',
    port: 8080,
    type: ProxyType.HTTP,
    country: 'US',
    region: 'New York',
    city: 'New York City',
    tags: ['standard', 'residential'],
    weight: 3,
    maxRequestsPerMinute: 60
});

// Add UK proxies
const ukProxy1 = pool.addProxy({
    host: 'uk-proxy-1.example.com',
    port: 8080,
    type: ProxyType.HTTP,
    country: 'UK',
    region: 'England',
    city: 'London',
    tags: ['premium', 'datacenter'],
    weight: 4,
    maxRequestsPerMinute: 80
});

// Add DE proxies
const deProxy1 = pool.addProxy({
    host: 'de-proxy-1.example.com',
    port: 8080,
    type: ProxyType.HTTP,
    country: 'DE',
    region: 'Bavaria',
    city: 'Munich',
    tags: ['standard', 'datacenter'],
    weight: 2,
    maxRequestsPerMinute: 50
});

// Add SOCKS5 proxy
const socksProxy = pool.addProxy({
    host: 'socks-proxy-1.example.com',
    port: 1080,
    type: ProxyType.SOCKS5,
    username: 'user',
    password: 'pass',
    country: 'JP',
    tags: ['premium', 'socks'],
    weight: 6,
    maxRequestsPerMinute: 120
});

console.log(`✅ Added ${pool.proxies.size} proxies to the pool`);
const stats = pool.getStats();
console.log(`   - Total Proxies: ${stats.totalProxies}`);
console.log(`   - Healthy: ${stats.healthyProxies}`);
console.log(`   - Degraded: ${stats.degradedProxies}`);
console.log(`   - Unhealthy: ${stats.unhealthyProxies}`);
console.log(`   - Blacklisted: ${stats.blacklistedProxies}`);
console.log();

// ============================================================================
// EXAMPLE 3: Rotation Strategies
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 3: Demonstrating Rotation Strategies');
console.log('='.repeat(80));

// Round-robin rotation
console.log('\n📍 Round-Robin Strategy:');
pool.setRotationStrategy(RotationStrategy.ROUND_ROBIN);
for (let i = 0; i < 3; i++) {
    const proxy = pool.getNextProxy();
    console.log(`   Request ${i + 1}: ${proxy.host} (${proxy.country})`);
}

// Random rotation
console.log('\n📍 Random Strategy:');
pool.setRotationStrategy(RotationStrategy.RANDOM);
for (let i = 0; i < 3; i++) {
    const proxy = pool.getNextProxy();
    console.log(`   Request ${i + 1}: ${proxy.host} (${proxy.country})`);
}

// Weighted rotation (premium proxies more likely)
console.log('\n📍 Weighted Strategy:');
pool.setRotationStrategy(RotationStrategy.WEIGHTED);
for (let i = 0; i < 3; i++) {
    const proxy = pool.getNextProxy();
    console.log(`   Request ${i + 1}: ${proxy.host} (${proxy.country}, weight: ${proxy.weight})`);
}

console.log();

// ============================================================================
// EXAMPLE 4: Geographic Filtering
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 4: Geographic Filtering');
console.log('='.repeat(80));

// Get US proxies
const usProxies = pool.getProxiesByCountry('US');
console.log(`\n🌎 US Proxies (${usProxies.length}):`);
usProxies.forEach(p => {
    console.log(`   - ${p.host} (${p.region}, ${p.city})`);
});

// Get UK proxies
const ukProxies = pool.getProxiesByCountry('UK');
console.log(`\n🌎 UK Proxies (${ukProxies.length}):`);
ukProxies.forEach(p => {
    console.log(`   - ${p.host} (${p.region}, ${p.city})`);
});

// Get premium proxies
const premiumProxies = pool.getProxiesByTags(['premium']);
console.log(`\n⭐ Premium Proxies (${premiumProxies.length}):`);
premiumProxies.forEach(p => {
    console.log(`   - ${p.host} (${p.country}, tags: ${p.tags.join(', ')})`);
});

console.log();

// ============================================================================
// EXAMPLE 5: Advanced Filtering
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 5: Advanced Multi-Criteria Filtering');
console.log('='.repeat(80));

// Get proxy from US with high success rate
console.log('\n🎯 Get US proxy with premium tag:');
const filteredProxy = pool.getNextProxy({
    country: 'US',
    tags: ['premium'],
    minSuccessRate: 0.95
});
console.log(`   Selected: ${filteredProxy.host}`);
console.log(`   Country: ${filteredProxy.country}`);
console.log(`   Tags: ${filteredProxy.tags.join(', ')}`);
console.log(`   Weight: ${filteredProxy.weight}`);

console.log();

// ============================================================================
// EXAMPLE 6: Success and Failure Tracking
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 6: Success and Failure Tracking');
console.log('='.repeat(80));

// Simulate successful requests
console.log('\n✅ Simulating successful requests:');
pool.recordSuccess(usProxy1.id, 150); // 150ms response time
pool.recordSuccess(usProxy1.id, 180);
pool.recordSuccess(usProxy1.id, 120);

const usProxy1Stats = usProxy1.getStats();
console.log(`   ${usProxy1.host}:`);
console.log(`   - Success Rate: ${(usProxy1Stats.successRate * 100).toFixed(1)}%`);
console.log(`   - Avg Response Time: ${usProxy1Stats.averageResponseTime.toFixed(1)}ms`);
console.log(`   - Total Requests: ${usProxy1Stats.totalRequests}`);
console.log(`   - Status: ${usProxy1Stats.status}`);

// Simulate failures
console.log('\n❌ Simulating failures:');
pool.recordFailure(usProxy2.id, new Error('Connection timeout'));
pool.recordFailure(usProxy2.id, new Error('Connection timeout'));
pool.recordFailure(usProxy2.id, new Error('Connection timeout'));

const usProxy2Stats = usProxy2.getStats();
console.log(`   ${usProxy2.host}:`);
console.log(`   - Success Rate: ${(usProxy2Stats.successRate * 100).toFixed(1)}%`);
console.log(`   - Consecutive Failures: ${usProxy2Stats.consecutiveFailures}`);
console.log(`   - Status: ${usProxy2Stats.status}`);

console.log();

// ============================================================================
// EXAMPLE 7: Blacklisting
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 7: Manual Blacklisting');
console.log('='.repeat(80));

console.log('\n🚫 Blacklisting proxy for 1 hour:');
pool.blacklistProxy(deProxy1.id, 3600000, 'Too many timeouts detected');

console.log(`   ${deProxy1.host} blacklisted`);
console.log(`   Reason: ${deProxy1.blacklistReason}`);
console.log(`   Status: ${deProxy1.status}`);
console.log(`   Available: ${deProxy1.isAvailable()}`);

// Attempt to get next proxy (blacklisted proxy will be skipped)
console.log('\n📍 Getting next available proxy (blacklisted will be skipped):');
const availableProxy = pool.getNextProxy();
console.log(`   Selected: ${availableProxy.host} (${availableProxy.status})`);

console.log();

// ============================================================================
// EXAMPLE 8: Pool Statistics
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 8: Pool Statistics');
console.log('='.repeat(80));

const poolStats = pool.getStats();
console.log('\n📊 Pool Statistics:');
console.log(`   Total Proxies: ${poolStats.totalProxies}`);
console.log(`   Healthy: ${poolStats.healthyProxies}`);
console.log(`   Degraded: ${poolStats.degradedProxies}`);
console.log(`   Unhealthy: ${poolStats.unhealthyProxies}`);
console.log(`   Blacklisted: ${poolStats.blacklistedProxies}`);
console.log(`   Total Requests: ${poolStats.totalRequests}`);
console.log(`   Successful Requests: ${poolStats.successfulRequests}`);
console.log(`   Failed Requests: ${poolStats.failedRequests}`);
console.log(`   Rotation Strategy: ${poolStats.rotationStrategy}`);
console.log(`   Health Check Enabled: ${poolStats.healthCheckEnabled}`);
console.log(`   Auto-Blacklist Enabled: ${poolStats.autoBlacklistEnabled}`);

console.log();

// ============================================================================
// EXAMPLE 9: Rate Limiting
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 9: Rate Limiting Demonstration');
console.log('='.repeat(80));

console.log('\n🚦 Testing rate limit:');
console.log(`   Max requests per minute: ${usProxy1.maxRequestsPerMinute}`);

// Simulate rapid requests
for (let i = 0; i < 5; i++) {
    usProxy1.recordRequest();
}

console.log(`   Current requests per minute: ${usProxy1.requestsPerMinute}`);
console.log(`   Is rate limited: ${usProxy1.isRateLimited()}`);
console.log(`   Available: ${usProxy1.isAvailable()}`);

console.log();

// ============================================================================
// EXAMPLE 10: Proxy URLs
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 10: Proxy URL Generation');
console.log('='.repeat(80));

console.log('\n🔗 Proxy URLs:');
console.log(`   HTTP Proxy: ${usProxy1.getUrl()}`);
console.log(`   SOCKS5 Proxy: ${socksProxy.getUrl()}`);

console.log();

// ============================================================================
// EXAMPLE 11: Event Handling
// ============================================================================

console.log('='.repeat(80));
console.log('EXAMPLE 11: Event Handling');
console.log('='.repeat(80));

console.log('\n📡 Setting up event listeners:');

pool.on('proxy:added', (proxy) => {
    console.log(`   [EVENT] Proxy added: ${proxy.id}`);
});

pool.on('proxy:blacklisted', (proxy) => {
    console.log(`   [EVENT] Proxy blacklisted: ${proxy.id} - ${proxy.blacklistReason}`);
});

pool.on('proxy:success', (proxy) => {
    console.log(`   [EVENT] Proxy success: ${proxy.id} (Success rate: ${(proxy.getSuccessRate() * 100).toFixed(1)}%)`);
});

pool.on('proxy:failure', (proxy) => {
    console.log(`   [EVENT] Proxy failure: ${proxy.id} (Consecutive failures: ${proxy.consecutiveFailures})`);
});

// Trigger some events
console.log('\n📡 Triggering events:');
const testProxy = pool.addProxy({
    host: 'test-proxy.example.com',
    port: 8080,
    type: ProxyType.HTTP
});

pool.recordSuccess(testProxy.id, 100);
pool.recordFailure(testProxy.id, new Error('Test error'));

console.log();

// ============================================================================
// Cleanup
// ============================================================================

console.log('='.repeat(80));
console.log('CLEANUP: Destroying Proxy Pool');
console.log('='.repeat(80));

pool.destroy();
console.log('✅ Proxy pool destroyed');
console.log();

console.log('='.repeat(80));
console.log('EXAMPLE COMPLETE');
console.log('='.repeat(80));
