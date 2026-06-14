"""
Async connection pool for Basset Hound Browser Python SDK
Provides connection pooling with health checks and load balancing
Phase 5: Connection Pool (3 hours)
"""

import asyncio
import logging
import time
from typing import Optional, List, Dict, Any, Literal, cast
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from basset_hound import BrowserClient, CommandResponse

logger = logging.getLogger(__name__)


class PoolStrategy(Enum):
    """Load balancing strategies"""
    ROUND_ROBIN = "round_robin"
    LEAST_BUSY = "least_busy"
    RANDOM = "random"


@dataclass
class PoolStats:
    """Statistics for a pool connection"""
    connection_id: str
    created_at: datetime
    last_used_at: datetime
    request_count: int = 0
    error_count: int = 0
    total_latency: float = 0.0
    active_requests: int = 0

    @property
    def avg_latency(self) -> float:
        """Average latency per request"""
        return self.total_latency / max(1, self.request_count)

    @property
    def uptime_seconds(self) -> float:
        """Uptime in seconds"""
        return (datetime.now() - self.created_at).total_seconds()

    @property
    def success_rate(self) -> float:
        """Success rate as percentage"""
        total = self.request_count
        if total == 0:
            return 100.0
        return ((total - self.error_count) / total) * 100


class PoolConnection:
    """Wrapper for client connection in pool"""

    def __init__(self, client: BrowserClient, connection_id: str) -> None:
        self.client = client
        self.id = connection_id
        self.stats = PoolStats(connection_id, datetime.now(), datetime.now())
        self.healthy = True
        self._lock = asyncio.Lock()

    async def execute(self, command: str, **kwargs: Any) -> CommandResponse:
        """Execute command with stats tracking"""
        async with self._lock:
            self.stats.active_requests += 1
            start_time = time.time()

            try:
                method = getattr(self.client, command, None)
                if method is None:
                    raise AttributeError(f"Unknown command: {command}")

                response = await method(**kwargs)
                elapsed = time.time() - start_time

                self.stats.request_count += 1
                self.stats.total_latency += elapsed
                self.stats.last_used_at = datetime.now()

                if not response.success:
                    self.stats.error_count += 1
                    # Mark unhealthy after 5 consecutive errors
                    if self.stats.error_count > 5:
                        self.healthy = False

                return cast(CommandResponse, response)

            except Exception as e:
                self.stats.error_count += 1
                if self.stats.error_count > 5:
                    self.healthy = False
                logger.error(f"Connection {self.id} error: {e}")
                raise

            finally:
                self.stats.active_requests = max(0, self.stats.active_requests - 1)

    async def health_check(self) -> bool:
        """Check connection health"""
        try:
            response = await self.client.health_check()
            self.healthy = response
            return response
        except Exception as e:
            logger.error(f"Health check failed for {self.id}: {e}")
            self.healthy = False
            return False


class AsyncConnectionPool:
    """Async connection pool with health management"""

    def __init__(
        self,
        ws_url: str = "ws://localhost:8765",
        pool_size: int = 5,
        strategy: PoolStrategy = PoolStrategy.ROUND_ROBIN,
        health_check_interval: int = 30,
        timeout: float = 30.0,
        max_retries: int = 3
    ) -> None:
        """
        Initialize connection pool

        Args:
            ws_url: WebSocket URL for all connections
            pool_size: Number of connections in pool
            strategy: Load balancing strategy
            health_check_interval: Seconds between health checks
            timeout: Command timeout in seconds
            max_retries: Max retries per command
        """
        self.ws_url = ws_url
        self.pool_size = pool_size
        self.strategy = strategy
        self.health_check_interval = health_check_interval
        self.timeout = timeout
        self.max_retries = max_retries

        self.connections: List[PoolConnection] = []
        self._initialized = False
        self._round_robin_index = 0
        self._health_check_task: Optional[asyncio.Task[None]] = None
        self._lock = asyncio.Lock()

    async def initialize(self) -> bool:
        """Initialize all connections in pool"""
        try:
            logger.info(f"Initializing connection pool with {self.pool_size} connections")

            for i in range(self.pool_size):
                client = BrowserClient(
                    ws_url=self.ws_url,
                    timeout=self.timeout,
                    max_retries=self.max_retries
                )
                await client.connect()

                connection = PoolConnection(client, f"conn-{i:03d}")
                self.connections.append(connection)
                logger.info(f"Connection {i} initialized")

            # Start health check loop
            self._health_check_task = asyncio.create_task(self._health_check_loop())
            self._initialized = True
            logger.info("Connection pool initialized successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize connection pool: {e}")
            await self.shutdown()
            return False

    async def _health_check_loop(self) -> None:
        """Background health check loop"""
        try:
            while self._initialized:
                await asyncio.sleep(self.health_check_interval)

                for connection in self.connections:
                    if not connection.healthy:
                        try:
                            # Attempt to reconnect
                            await connection.client.disconnect()
                            await asyncio.sleep(1)
                            await connection.client.connect()
                            connection.healthy = await connection.health_check()
                            if connection.healthy:
                                logger.info(f"Connection {connection.id} recovered")
                        except Exception as e:
                            logger.error(f"Failed to recover connection {connection.id}: {e}")
                    else:
                        # Regular health check
                        await connection.health_check()

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Health check loop error: {e}")

    def _get_next_connection(self) -> PoolConnection:
        """Get next connection based on strategy"""
        healthy = [c for c in self.connections if c.healthy]

        if not healthy:
            raise RuntimeError("No healthy connections available")

        if self.strategy == PoolStrategy.ROUND_ROBIN:
            connection = healthy[self._round_robin_index % len(healthy)]
            self._round_robin_index += 1
            return connection

        elif self.strategy == PoolStrategy.LEAST_BUSY:
            return min(healthy, key=lambda c: c.stats.active_requests)

        elif self.strategy == PoolStrategy.RANDOM:
            import random
            return random.choice(healthy)

        return healthy[0]

    async def execute(self, command: str, **kwargs: Any) -> CommandResponse:
        """Execute command using next available connection"""
        if not self._initialized:
            raise RuntimeError("Pool not initialized. Call initialize() first")

        connection = self._get_next_connection()
        return await connection.execute(command, **kwargs)

    async def batch_execute(
        self,
        commands: List[Dict[str, Any]],
        parallel: bool = True
    ) -> List[CommandResponse]:
        """
        Execute batch of commands

        Args:
            commands: List of command dicts with 'command' key
            parallel: Execute in parallel or sequentially

        Returns:
            List of responses
        """
        if parallel:
            tasks = [
                self.execute(cmd.pop('command'), **cmd)
                for cmd in commands
            ]
            return await asyncio.gather(*tasks, return_exceptions=False)
        else:
            results = []
            for cmd in commands:
                command_name = cmd.pop('command')
                result = await self.execute(command_name, **cmd)
                results.append(result)
            return results

    async def shutdown(self) -> None:
        """Shutdown pool and close all connections"""
        logger.info("Shutting down connection pool")

        # Stop health check loop
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass

        # Close all connections
        for connection in self.connections:
            try:
                await connection.client.disconnect()
            except Exception as e:
                logger.error(f"Error closing connection {connection.id}: {e}")

        self.connections.clear()
        self._initialized = False
        logger.info("Connection pool shutdown complete")

    def get_stats(self) -> Dict[str, Any]:
        """Get pool statistics"""
        healthy_count = sum(1 for c in self.connections if c.healthy)
        total_requests = sum(c.stats.request_count for c in self.connections)
        total_errors = sum(c.stats.error_count for c in self.connections)
        avg_latency = sum(c.stats.avg_latency for c in self.connections) / max(1, len(self.connections))

        return {
            'pool_size': len(self.connections),
            'healthy_connections': healthy_count,
            'total_requests': total_requests,
            'total_errors': total_errors,
            'total_success_rate': ((total_requests - total_errors) / max(1, total_requests)) * 100,
            'avg_latency': avg_latency,
            'strategy': self.strategy.value,
            'connections': [
                {
                    'id': c.id,
                    'healthy': c.healthy,
                    'requests': c.stats.request_count,
                    'errors': c.stats.error_count,
                    'avg_latency': c.stats.avg_latency,
                    'success_rate': c.stats.success_rate,
                    'active_requests': c.stats.active_requests,
                    'uptime_seconds': c.stats.uptime_seconds
                }
                for c in self.connections
            ]
        }

    async def __aenter__(self) -> 'AsyncConnectionPool':
        """Context manager entry"""
        await self.initialize()
        return self

    async def __aexit__(
        self,
        exc_type: Optional[type],
        exc_val: Optional[BaseException],
        exc_tb: Optional[Any]
    ) -> None:
        """Context manager exit"""
        await self.shutdown()


# Convenience factory function
async def create_pool(
    ws_url: str = "ws://localhost:8765",
    pool_size: int = 5,
    strategy: str = "round_robin"
) -> AsyncConnectionPool:
    """Create and initialize a connection pool"""
    pool = AsyncConnectionPool(
        ws_url=ws_url,
        pool_size=pool_size,
        strategy=PoolStrategy[strategy.upper()]
    )
    await pool.initialize()
    return pool


__all__ = [
    'AsyncConnectionPool',
    'PoolConnection',
    'PoolStats',
    'PoolStrategy',
    'create_pool'
]
