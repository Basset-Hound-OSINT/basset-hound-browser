"""
Test suite for Python SDK connection pool
Tests connection pooling, health checks, and load balancing
Phase 5: Connection pool coverage (15+ tests)
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from typing import List

import sys
from pathlib import Path
sdk_path = Path(__file__).parent.parent.parent / "sdks" / "python-sdk"
sys.path.insert(0, str(sdk_path))

from basset_hound import BrowserClient, CommandResponse
from connection_pool import (
    AsyncConnectionPool,
    PoolConnection,
    PoolStats,
    PoolStrategy,
    create_pool
)


class TestPoolConnection:
    """Test individual pool connection (3 tests)"""

    @pytest.mark.asyncio
    async def test_connection_stats_tracking(self):
        """Test stats tracking for a connection"""
        client = AsyncMock(spec=BrowserClient)
        client.health_check = AsyncMock(return_value=True)

        connection = PoolConnection(client, "test-conn")

        response = CommandResponse.from_dict({
            'id': 'test',
            'command': 'ping',
            'success': True
        })

        # Mock the navigate method
        client.navigate = AsyncMock(return_value=response)

        result = await connection.execute('navigate', url='https://example.com')

        assert result.success is True
        assert connection.stats.request_count == 1
        assert connection.stats.error_count == 0
        assert connection.stats.avg_latency > 0

    @pytest.mark.asyncio
    async def test_connection_health_check(self):
        """Test connection health check"""
        client = AsyncMock(spec=BrowserClient)
        client.health_check = AsyncMock(return_value=True)

        connection = PoolConnection(client, "test-conn")
        health = await connection.health_check()

        assert health is True
        assert connection.healthy is True

    @pytest.mark.asyncio
    async def test_connection_unhealthy_on_errors(self):
        """Test connection marked unhealthy after repeated errors"""
        client = AsyncMock(spec=BrowserClient)

        response = CommandResponse.from_dict({
            'id': 'test',
            'command': 'test',
            'success': False,
            'error': 'Test error'
        })

        client.test_cmd = AsyncMock(return_value=response)

        connection = PoolConnection(client, "test-conn")

        # Simulate 6 failures
        for i in range(6):
            try:
                await connection.execute('test_cmd')
            except Exception:
                pass

        assert connection.healthy is False


class TestAsyncConnectionPoolInitialization:
    """Test pool initialization (3 tests)"""

    @pytest.mark.asyncio
    async def test_pool_initialization(self):
        """Test pool initialization creates connections"""
        with patch('connection_pool.BrowserClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.connect = AsyncMock()
            mock_client.health_check = AsyncMock(return_value=True)
            mock_client_class.return_value = mock_client

            pool = AsyncConnectionPool(pool_size=3)
            result = await pool.initialize()

            assert result is True
            assert len(pool.connections) == 3
            assert pool._initialized is True

    @pytest.mark.asyncio
    async def test_pool_initialization_failure(self):
        """Test pool handles initialization failure"""
        with patch('connection_pool.BrowserClient') as mock_client_class:
            mock_client_class.side_effect = Exception("Connection failed")

            pool = AsyncConnectionPool(pool_size=2)
            result = await pool.initialize()

            assert result is False
            assert pool._initialized is False

    @pytest.mark.asyncio
    async def test_pool_context_manager(self):
        """Test pool context manager"""
        with patch('connection_pool.BrowserClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.connect = AsyncMock()
            mock_client.disconnect = AsyncMock()
            mock_client.health_check = AsyncMock(return_value=True)
            mock_client_class.return_value = mock_client

            async with AsyncConnectionPool(pool_size=2) as pool:
                assert pool._initialized is True
                assert len(pool.connections) == 2

            assert pool._initialized is False
            assert len(pool.connections) == 0


class TestLoadBalancingStrategies:
    """Test different load balancing strategies (4 tests)"""

    @pytest.mark.asyncio
    async def test_round_robin_strategy(self):
        """Test round robin load balancing"""
        pool = AsyncConnectionPool(strategy=PoolStrategy.ROUND_ROBIN, pool_size=3)

        # Create mock connections
        for i in range(3):
            client = AsyncMock()
            connection = PoolConnection(client, f"conn-{i}")
            connection.healthy = True
            pool.connections.append(connection)

        # Get connections in round robin order
        c1 = pool._get_next_connection()
        c2 = pool._get_next_connection()
        c3 = pool._get_next_connection()
        c4 = pool._get_next_connection()

        # Should cycle through connections
        assert c1.id != c2.id
        assert c2.id != c3.id
        assert c4.id == c1.id

    @pytest.mark.asyncio
    async def test_least_busy_strategy(self):
        """Test least busy load balancing"""
        pool = AsyncConnectionPool(strategy=PoolStrategy.LEAST_BUSY, pool_size=3)

        # Create mock connections with different request counts
        for i in range(3):
            client = AsyncMock()
            connection = PoolConnection(client, f"conn-{i}")
            connection.healthy = True
            connection.stats.request_count = i * 10
            connection.stats.active_requests = i
            pool.connections.append(connection)

        # Should get connection with fewest active requests
        next_conn = pool._get_next_connection()
        assert next_conn.id == "conn-0"

    @pytest.mark.asyncio
    async def test_random_strategy(self):
        """Test random load balancing"""
        pool = AsyncConnectionPool(strategy=PoolStrategy.RANDOM, pool_size=5)

        # Create mock connections
        for i in range(5):
            client = AsyncMock()
            connection = PoolConnection(client, f"conn-{i}")
            connection.healthy = True
            pool.connections.append(connection)

        # Get several connections
        connections = [pool._get_next_connection() for _ in range(10)]
        connection_ids = [c.id for c in connections]

        # Should get some variety
        assert len(set(connection_ids)) > 1

    @pytest.mark.asyncio
    async def test_no_healthy_connections_error(self):
        """Test error when no healthy connections"""
        pool = AsyncConnectionPool(pool_size=2)

        # Create unhealthy connections
        for i in range(2):
            client = AsyncMock()
            connection = PoolConnection(client, f"conn-{i}")
            connection.healthy = False
            pool.connections.append(connection)

        with pytest.raises(RuntimeError, match="No healthy connections"):
            pool._get_next_connection()


class TestPoolExecution:
    """Test command execution through pool (4 tests)"""

    @pytest.mark.asyncio
    async def test_execute_command(self):
        """Test executing command through pool"""
        pool = AsyncConnectionPool(pool_size=2)
        pool._initialized = True

        response = CommandResponse.from_dict({
            'id': 'test',
            'command': 'navigate',
            'success': True
        })

        # Create mock connection
        client = AsyncMock()
        client.navigate = AsyncMock(return_value=response)
        connection = PoolConnection(client, "conn-0")
        connection.healthy = True
        pool.connections.append(connection)

        # Execute through pool
        result = await pool.execute('navigate', url='https://example.com')

        assert result.success is True

    @pytest.mark.asyncio
    async def test_batch_execute_parallel(self):
        """Test batch execution in parallel"""
        pool = AsyncConnectionPool(pool_size=3)
        pool._initialized = True

        # Create mock connections
        for i in range(3):
            client = AsyncMock()
            response = CommandResponse.from_dict({
                'id': f'test-{i}',
                'command': f'cmd-{i}',
                'success': True
            })
            client.cmd = AsyncMock(return_value=response)
            connection = PoolConnection(client, f"conn-{i}")
            connection.healthy = True
            pool.connections.append(connection)

        commands = [
            {'command': 'cmd', 'arg1': 'value1'},
            {'command': 'cmd', 'arg2': 'value2'},
            {'command': 'cmd', 'arg3': 'value3'}
        ]

        results = await pool.batch_execute(commands, parallel=True)

        assert len(results) == 3
        assert all(r.success for r in results)

    @pytest.mark.asyncio
    async def test_batch_execute_sequential(self):
        """Test batch execution sequentially"""
        pool = AsyncConnectionPool(pool_size=1)
        pool._initialized = True

        client = AsyncMock()
        response = CommandResponse.from_dict({
            'id': 'test',
            'command': 'test',
            'success': True
        })
        client.test = AsyncMock(return_value=response)

        connection = PoolConnection(client, "conn-0")
        connection.healthy = True
        pool.connections.append(connection)

        commands = [
            {'command': 'test'},
            {'command': 'test'},
            {'command': 'test'}
        ]

        results = await pool.batch_execute(commands, parallel=False)

        assert len(results) == 3
        assert client.test.call_count >= 3

    @pytest.mark.asyncio
    async def test_execute_not_initialized_error(self):
        """Test error when executing on uninitialized pool"""
        pool = AsyncConnectionPool()

        with pytest.raises(RuntimeError, match="not initialized"):
            await pool.execute('navigate', url='https://example.com')


class TestPoolHealthCheck:
    """Test health check loop (2 tests)"""

    @pytest.mark.asyncio
    async def test_health_check_recovery(self):
        """Test connection recovery from unhealthy state"""
        pool = AsyncConnectionPool(pool_size=1, health_check_interval=1)
        pool._initialized = True

        client = AsyncMock()
        client.disconnect = AsyncMock()
        client.connect = AsyncMock()
        client.health_check = AsyncMock(return_value=True)

        connection = PoolConnection(client, "conn-0")
        connection.healthy = False
        pool.connections.append(connection)

        # Check that health check can mark it healthy again
        result = await connection.health_check()
        assert result is True
        assert connection.healthy is True

    @pytest.mark.asyncio
    async def test_get_stats(self):
        """Test getting pool statistics"""
        pool = AsyncConnectionPool(pool_size=2)

        # Create mock connections with stats
        for i in range(2):
            client = AsyncMock()
            connection = PoolConnection(client, f"conn-{i}")
            connection.healthy = True
            connection.stats.request_count = 100 + (i * 10)
            connection.stats.error_count = i
            pool.connections.append(connection)

        stats = pool.get_stats()

        assert stats['pool_size'] == 2
        assert stats['healthy_connections'] == 2
        assert stats['total_requests'] == 210
        assert stats['total_errors'] == 1
        assert 'connections' in stats
        assert len(stats['connections']) == 2


class TestConnectionPoolFactory:
    """Test pool creation factory (1 test)"""

    @pytest.mark.asyncio
    async def test_create_pool_factory(self):
        """Test create_pool factory function"""
        with patch('connection_pool.BrowserClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.connect = AsyncMock()
            mock_client.health_check = AsyncMock(return_value=True)
            mock_client_class.return_value = mock_client

            pool = await create_pool(pool_size=2, strategy='round_robin')

            assert pool is not None
            assert len(pool.connections) == 2
            assert pool.strategy == PoolStrategy.ROUND_ROBIN
            await pool.shutdown()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
