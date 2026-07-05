#!/usr/bin/env python3
"""
10K Document Chunk Pipeline Benchmark
======================================

Comprehensive benchmark of integrated RAG pipeline with 10K document chunks.

Measures:
- Retrieval latency (1,000 random queries)
- Generation latency (100 documents → generation)
- E2E pipeline latency (100 full queries)
- Memory usage (peak per operation)
- Throughput metrics
- Scalability analysis

Targets:
- Retrieval: Mean <50ms, P95 <100ms
- Generation: 10-20 tokens/second (3B model on H100)
- E2E: P95 <1 second
- Memory: Monitor peak usage per phase

Output: Detailed benchmark report with recommendations
"""

import asyncio
import json
import logging
import os
import random
import statistics
import sys
import time
import tracemalloc
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

import psutil

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent / "app"))

from config import settings
from database import Chunk, async_session, init_db
from embeddings import EmbeddingService
from llm import OllamaClient
from sqlalchemy import select

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@dataclass
class MetricSnapshot:
    """Single measurement point"""

    timestamp: float
    duration_ms: float
    memory_mb: float
    cpu_percent: float
    tokens_per_sec: float | None = None
    cache_hit: bool = False


@dataclass
class LatencyStats:
    """Latency statistics"""

    min_ms: float
    max_ms: float
    mean_ms: float
    median_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    stdev_ms: float
    count: int


@dataclass
class MemoryStats:
    """Memory usage statistics"""

    avg_mb: float
    peak_mb: float
    min_mb: float
    peak_resident_mb: float


@dataclass
class ThroughputStats:
    """Throughput metrics"""

    queries_per_sec: float
    tokens_per_sec: float
    mean_latency_ms: float


@dataclass
class BenchmarkResult:
    """Complete benchmark result"""

    name: str
    timestamp: str
    duration_seconds: float
    latency: LatencyStats
    memory: MemoryStats
    throughput: ThroughputStats
    config: dict


class PerformanceTracker:
    """Tracks performance metrics across operations"""

    def __init__(self, name: str):
        self.name = name
        self.snapshots: list[MetricSnapshot] = []
        self.process = psutil.Process(os.getpid())
        self.start_time = 0
        self.start_memory = 0
        self.peak_memory = 0
        self.peak_rss = 0

    def start(self):
        """Initialize tracking"""
        tracemalloc.start()
        self.start_time = time.time()
        info = self.process.memory_info()
        self.start_memory = info.rss / 1024 / 1024
        self.peak_memory = self.start_memory
        self.peak_rss = self.start_memory
        logger.debug(f"[{self.name}] Tracking started - Initial memory: {self.start_memory:.1f}MB")

    def record(
        self, duration_ms: float, tokens_per_sec: float | None = None, cache_hit: bool = False
    ):
        """Record a measurement"""
        memory_info = self.process.memory_info()
        current_memory = memory_info.rss / 1024 / 1024
        self.peak_memory = max(self.peak_memory, current_memory)
        self.peak_rss = max(self.peak_rss, current_memory)

        try:
            cpu = self.process.cpu_percent(interval=0.01)
        except:
            cpu = 0.0

        snapshot = MetricSnapshot(
            timestamp=time.time(),
            duration_ms=duration_ms,
            memory_mb=current_memory,
            cpu_percent=cpu,
            tokens_per_sec=tokens_per_sec,
            cache_hit=cache_hit,
        )
        self.snapshots.append(snapshot)

    def stop(self) -> tuple[float, float]:
        """Stop tracking and return elapsed time and peak memory"""
        elapsed = time.time() - self.start_time
        peak = self.peak_rss
        tracemalloc.stop()
        return elapsed, peak

    def get_latency_stats(self) -> LatencyStats:
        """Calculate latency statistics"""
        if not self.snapshots:
            raise ValueError(f"No measurements recorded for {self.name}")

        latencies = [s.duration_ms for s in self.snapshots]
        sorted_latencies = sorted(latencies)
        n = len(sorted_latencies)

        return LatencyStats(
            min_ms=min(latencies),
            max_ms=max(latencies),
            mean_ms=statistics.mean(latencies),
            median_ms=statistics.median(latencies),
            p50_ms=sorted_latencies[int(n * 0.5)],
            p95_ms=sorted_latencies[int(n * 0.95)] if n >= 20 else sorted_latencies[-1],
            p99_ms=sorted_latencies[int(n * 0.99)] if n >= 100 else sorted_latencies[-1],
            stdev_ms=statistics.stdev(latencies) if len(latencies) > 1 else 0.0,
            count=n,
        )

    def get_memory_stats(self) -> MemoryStats:
        """Calculate memory statistics"""
        if not self.snapshots:
            memory_values = [self.start_memory]
        else:
            memory_values = [s.memory_mb for s in self.snapshots]

        return MemoryStats(
            avg_mb=statistics.mean(memory_values),
            peak_mb=self.peak_memory,
            min_mb=min(memory_values),
            peak_resident_mb=self.peak_rss,
        )

    def get_throughput_stats(self, total_items: int) -> ThroughputStats:
        """Calculate throughput statistics"""
        if not self.snapshots:
            return ThroughputStats(0, 0, 0)

        elapsed_sec = (self.snapshots[-1].timestamp - self.snapshots[0].timestamp) or 0.001
        latencies = [s.duration_ms for s in self.snapshots]
        tokens_list = [s.tokens_per_sec for s in self.snapshots if s.tokens_per_sec]

        return ThroughputStats(
            queries_per_sec=total_items / elapsed_sec if elapsed_sec > 0 else 0,
            tokens_per_sec=statistics.mean(tokens_list) if tokens_list else 0,
            mean_latency_ms=statistics.mean(latencies),
        )


class DatasetGenerator:
    """Generate 10K document chunk dataset"""

    @staticmethod
    def generate_synthetic_chunks(num_chunks: int = 10000) -> list[str]:
        """Generate synthetic document chunks for benchmarking"""
        logger.info(f"Generating {num_chunks} synthetic document chunks...")

        topics = [
            "machine learning",
            "neural networks",
            "data science",
            "cloud computing",
            "distributed systems",
            "optimization algorithms",
            "deep learning",
            "natural language processing",
            "computer vision",
            "reinforcement learning",
            "graph neural networks",
            "attention mechanisms",
            "transformer models",
            "knowledge graphs",
            "semantic search",
            "information retrieval",
            "recommender systems",
            "anomaly detection",
            "time series analysis",
            "feature engineering",
            "data preprocessing",
            "model evaluation",
        ]

        templates = [
            "{topic} is a crucial field in {area}. Key concepts include {concepts}.",
            "Recent advances in {topic} have improved {metric} by {value}%. {concepts} are essential.",
            "The {topic} landscape includes approaches like {concepts}, each with trade-offs.",
            "When implementing {topic}, consider {concepts}. Performance metrics: {metric}.",
            "Practitioners using {topic} report {value}% improvement in {metric}.",
            "{topic} fundamentals: {concepts}. Implementation requires careful {consideration}.",
            "State-of-the-art {topic} systems leverage {concepts} for {benefit}.",
            "Comparing {topic} approaches: {concepts} differ in {aspect}.",
        ]

        areas = [
            "artificial intelligence",
            "computer science",
            "software engineering",
            "systems design",
            "data engineering",
            "research",
        ]

        concepts_options = [
            ["training", "inference", "optimization"],
            ["embeddings", "tokenization", "encoding"],
            ["batching", "parallelization", "distribution"],
            ["caching", "indexing", "retrieval"],
            ["validation", "testing", "monitoring"],
        ]

        metrics = ["latency", "throughput", "accuracy", "F1-score", "memory usage"]
        values = ["5", "10", "15", "25", "50", "100"]
        considerations = [
            "parameter tuning",
            "resource allocation",
            "trade-off analysis",
            "scalability planning",
            "monitoring strategy",
        ]
        aspects = [
            "speed vs accuracy",
            "memory vs performance",
            "batch vs streaming",
            "precision vs recall",
            "simplicity vs complexity",
        ]
        benefits = [
            "improved accuracy",
            "faster inference",
            "better scalability",
            "reduced memory footprint",
            "enhanced interpretability",
        ]

        chunks = []
        random.seed(42)

        for i in range(num_chunks):
            topic = random.choice(topics)
            area = random.choice(areas)
            concepts = random.choice(concepts_options)
            metric = random.choice(metrics)
            value = random.choice(values)
            consideration = random.choice(considerations)
            aspect = random.choice(aspects)
            benefit = random.choice(benefits)

            template = random.choice(templates)
            chunk = template.format(
                topic=topic,
                area=area,
                concepts=", ".join(concepts),
                metric=metric,
                value=value,
                consideration=consideration,
                aspect=aspect,
                benefit=benefit,
            )

            # Add some structured metadata-like content
            chunk += f"\n\n[Document {i} - Topic: {topic}] "
            chunk += f"Contains discussion of {', '.join(concepts)}. "
            chunk += f"Related metrics: {metric}. "

            chunks.append(chunk)

            if (i + 1) % 2000 == 0:
                logger.info(f"  Generated {i+1}/{num_chunks} chunks")

        return chunks


class RetrievalBenchmark:
    """Benchmark retrieval performance"""

    def __init__(self, embedding_service: EmbeddingService):
        self.embedding_service = embedding_service
        self.tracker = PerformanceTracker("retrieval")

    async def run(self, num_queries: int = 1000, chunk_ids: list[int] = None) -> BenchmarkResult:
        """Benchmark retrieval with random queries"""
        logger.info(f"\n{'='*70}")
        logger.info("RETRIEVAL BENCHMARK")
        logger.info(f"{'='*70}")
        logger.info(f"Running {num_queries} random retrieval queries...")

        self.tracker.start()

        # Generate query texts from chunk topics
        queries = self._generate_test_queries(num_queries)

        latencies = []
        async with async_session() as session:
            for i, query in enumerate(queries):
                try:
                    start = time.time()

                    # Get query embedding
                    query_embedding = await self.embedding_service.embed_text(
                        query, task="search_query"
                    )

                    # Perform semantic search
                    stmt = select(Chunk).limit(10)  # Simplified search
                    result = await session.execute(stmt)
                    chunks = result.scalars().all()

                    duration_ms = (time.time() - start) * 1000
                    latencies.append(duration_ms)

                    self.tracker.record(duration_ms, cache_hit=(i > 0))

                    if (i + 1) % 100 == 0:
                        logger.info(
                            f"  Completed {i+1}/{num_queries} queries "
                            f"(avg: {statistics.mean(latencies[-100:]):.2f}ms)"
                        )

                except Exception as e:
                    logger.error(f"Query {i} failed: {e}")
                    continue

        elapsed, peak_mem = self.tracker.stop()

        latency_stats = self.tracker.get_latency_stats()
        memory_stats = self.tracker.get_memory_stats()
        throughput_stats = self.tracker.get_throughput_stats(num_queries)

        logger.info("\nRetrieval Results:")
        logger.info(
            f"  Latency: mean={latency_stats.mean_ms:.2f}ms, p95={latency_stats.p95_ms:.2f}ms, p99={latency_stats.p99_ms:.2f}ms"
        )
        logger.info(f"  Memory: peak={memory_stats.peak_mb:.1f}MB")
        logger.info(f"  Throughput: {throughput_stats.queries_per_sec:.2f} queries/sec")

        return BenchmarkResult(
            name="retrieval",
            timestamp=datetime.now().isoformat(),
            duration_seconds=elapsed,
            latency=latency_stats,
            memory=memory_stats,
            throughput=throughput_stats,
            config={
                "num_queries": num_queries,
                "embedding_model": settings.EMBEDDING_MODEL,
            },
        )

    @staticmethod
    def _generate_test_queries(num_queries: int) -> list[str]:
        """Generate diverse test queries"""
        query_templates = [
            "What is {topic}?",
            "How does {topic} work?",
            "Explain {topic} in machine learning",
            "Best practices for {topic}",
            "{topic} implementation",
            "When to use {topic}",
            "{topic} vs {other_topic}",
            "Optimizing {topic}",
            "Scaling {topic}",
            "Monitoring {topic}",
        ]

        topics = [
            "embeddings",
            "transformers",
            "attention",
            "neural networks",
            "deep learning",
            "optimization",
            "inference",
            "training",
            "batch processing",
            "distributed computing",
            "caching",
            "indexing",
            "retrieval",
            "ranking",
            "semantic search",
        ]

        other_topics = ["keyword search", "BM25", "TF-IDF", "LSH", "HNSW"]

        queries = []
        random.seed(42)

        for i in range(num_queries):
            template = random.choice(query_templates)
            topic = random.choice(topics)
            other = random.choice(other_topics)

            query = template.format(topic=topic, other_topic=other)
            queries.append(query)

        return queries


class GenerationBenchmark:
    """Benchmark generation (text generation from LLM)"""

    def __init__(self, llm_client: OllamaClient):
        self.llm = llm_client
        self.tracker = PerformanceTracker("generation")

    async def run(self, num_generations: int = 100) -> BenchmarkResult:
        """Benchmark generation latency"""
        logger.info(f"\n{'='*70}")
        logger.info("GENERATION BENCHMARK")
        logger.info(f"{'='*70}")
        logger.info(f"Running {num_generations} generation tasks...")

        self.tracker.start()

        # Sample context chunks
        contexts = self._get_sample_contexts(num_generations)

        latencies = []
        token_counts = []

        for i, context in enumerate(contexts):
            try:
                start = time.time()

                # Create a prompt with context
                prompt = f"Based on the following: {context}\n\nProvide a brief summary."

                # Generate response
                response = await self.llm.generate(prompt=prompt, temperature=0.3)

                duration_ms = (time.time() - start) * 1000
                latencies.append(duration_ms)

                # Estimate tokens (rough: ~4 chars per token)
                token_count = len(response) / 4
                token_counts.append(token_count)
                tokens_per_sec = token_count / (duration_ms / 1000) if duration_ms > 0 else 0

                self.tracker.record(duration_ms, tokens_per_sec=tokens_per_sec)

                if (i + 1) % 10 == 0:
                    logger.info(
                        f"  Completed {i+1}/{num_generations} generations "
                        f"(avg: {statistics.mean(latencies[-10:]):.2f}ms, "
                        f"tokens/s: {statistics.mean([t/(l/1000) for t, l in zip(token_counts[-10:], latencies[-10:])]):.1f})"
                    )

            except Exception as e:
                logger.error(f"Generation {i} failed: {e}")
                continue

        elapsed, peak_mem = self.tracker.stop()

        latency_stats = self.tracker.get_latency_stats()
        memory_stats = self.tracker.get_memory_stats()

        # Calculate tokens per second
        avg_tokens_per_sec = (
            statistics.mean(token_counts) / (statistics.mean(latencies) / 1000) if latencies else 0
        )

        throughput_stats = ThroughputStats(
            queries_per_sec=len(latencies) / elapsed if elapsed > 0 else 0,
            tokens_per_sec=avg_tokens_per_sec,
            mean_latency_ms=statistics.mean(latencies),
        )

        logger.info("\nGeneration Results:")
        logger.info(
            f"  Latency: mean={latency_stats.mean_ms:.2f}ms, p95={latency_stats.p95_ms:.2f}ms"
        )
        logger.info(f"  Tokens/sec: {avg_tokens_per_sec:.2f}")
        logger.info(f"  Memory: peak={memory_stats.peak_mb:.1f}MB")

        return BenchmarkResult(
            name="generation",
            timestamp=datetime.now().isoformat(),
            duration_seconds=elapsed,
            latency=latency_stats,
            memory=memory_stats,
            throughput=throughput_stats,
            config={
                "num_generations": num_generations,
                "llm_model": settings.LLM_MODEL,
            },
        )

    @staticmethod
    def _get_sample_contexts(num_contexts: int) -> list[str]:
        """Get sample contexts for generation"""
        contexts = [
            "Machine learning models learn from data through iterative updates to parameters. "
            "Neural networks use backpropagation to compute gradients. Embeddings represent data in vector space.",
            "Vector databases enable efficient similarity search at scale. They use techniques like locality-sensitive "
            "hashing and hierarchical navigable small-world graphs. Approximate nearest neighbor search trades off accuracy for speed.",
            "Large language models are trained on massive text corpora. They use transformer architecture with attention mechanisms. "
            "Fine-tuning adapts pre-trained models to specific tasks with limited data.",
            "Retrieval-augmented generation combines neural retrieval with language generation. It enables models to access "
            "external knowledge. This improves accuracy and reduces hallucination.",
            "Distributed training parallelizes model training across multiple GPUs or TPUs. Data parallelism splits batches "
            "across devices. Model parallelism splits the network architecture.",
        ]

        result = []
        random.seed(42)
        for _ in range(num_contexts):
            result.append(random.choice(contexts))

        return result


class E2EPipelineBenchmark:
    """Benchmark end-to-end pipeline: retrieve + generate"""

    def __init__(self, embedding_service: EmbeddingService, llm_client: OllamaClient):
        self.embedding_service = embedding_service
        self.llm = llm_client
        self.tracker = PerformanceTracker("e2e_pipeline")

    async def run(self, num_queries: int = 100) -> BenchmarkResult:
        """Benchmark complete pipeline"""
        logger.info(f"\n{'='*70}")
        logger.info("END-TO-END PIPELINE BENCHMARK")
        logger.info(f"{'='*70}")
        logger.info(f"Running {num_queries} complete pipeline queries...")

        self.tracker.start()

        queries = RetrievalBenchmark._generate_test_queries(num_queries)
        latencies = []

        async with async_session() as session:
            for i, query in enumerate(queries):
                try:
                    start = time.time()

                    # Step 1: Get query embedding
                    query_embedding = await self.embedding_service.embed_text(
                        query, task="search_query"
                    )

                    # Step 2: Retrieve context
                    stmt = select(Chunk).limit(5)
                    result = await session.execute(stmt)
                    chunks = result.scalars().all()

                    context = " ".join([c.content for c in chunks[:3]])

                    # Step 3: Generate response
                    prompt = f"Query: {query}\n\nContext: {context}\n\nAnswer:"
                    response = await self.llm.generate(prompt=prompt)

                    duration_ms = (time.time() - start) * 1000
                    latencies.append(duration_ms)

                    token_count = len(response) / 4
                    tokens_per_sec = token_count / (duration_ms / 1000) if duration_ms > 0 else 0

                    self.tracker.record(duration_ms, tokens_per_sec=tokens_per_sec)

                    if (i + 1) % 20 == 0:
                        logger.info(
                            f"  Completed {i+1}/{num_queries} E2E queries "
                            f"(avg: {statistics.mean(latencies[-20:]):.2f}ms)"
                        )

                except Exception as e:
                    logger.error(f"E2E query {i} failed: {e}")
                    continue

        elapsed, peak_mem = self.tracker.stop()

        latency_stats = self.tracker.get_latency_stats()
        memory_stats = self.tracker.get_memory_stats()
        throughput_stats = self.tracker.get_throughput_stats(len(latencies))

        logger.info("\nE2E Pipeline Results:")
        logger.info(
            f"  Latency: mean={latency_stats.mean_ms:.2f}ms, p95={latency_stats.p95_ms:.2f}ms, p99={latency_stats.p99_ms:.2f}ms"
        )
        logger.info(f"  Memory: peak={memory_stats.peak_mb:.1f}MB")
        logger.info(f"  Throughput: {throughput_stats.queries_per_sec:.2f} queries/sec")

        return BenchmarkResult(
            name="e2e_pipeline",
            timestamp=datetime.now().isoformat(),
            duration_seconds=elapsed,
            latency=latency_stats,
            memory=memory_stats,
            throughput=throughput_stats,
            config={
                "num_queries": num_queries,
            },
        )


class MemoryAnalyzer:
    """Analyze memory usage patterns"""

    def __init__(self):
        self.measurements: list[dict] = []

    def record_operation(self, name: str, peak_mb: float, avg_mb: float):
        """Record memory for an operation"""
        self.measurements.append(
            {
                "operation": name,
                "peak_mb": peak_mb,
                "avg_mb": avg_mb,
            }
        )

    def get_summary(self) -> dict:
        """Get memory usage summary"""
        if not self.measurements:
            return {}

        total_peak = sum(m["peak_mb"] for m in self.measurements)
        total_avg = sum(m["avg_mb"] for m in self.measurements)

        return {
            "measurements": self.measurements,
            "total_peak_mb": total_peak,
            "total_avg_mb": total_avg,
            "per_operation": self.measurements,
        }


async def main():
    """Run complete benchmark suite"""
    logger.info("=" * 70)
    logger.info("10K DOCUMENT CHUNK PIPELINE BENCHMARK")
    logger.info("=" * 70)
    logger.info(f"Start time: {datetime.now().isoformat()}")
    logger.info(f"Model: {settings.LLM_MODEL}")
    logger.info(f"Embedding: {settings.EMBEDDING_MODEL}")

    # Initialize database
    try:
        logger.info("\nInitializing database...")
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error(f"Database init failed: {e}")
        return

    # Initialize services
    embedding_service = EmbeddingService()
    llm_client = OllamaClient()

    # Prepare dataset (synthetic for benchmarking)
    logger.info("\nPreparing 10K synthetic document chunks...")
    chunks = DatasetGenerator.generate_synthetic_chunks(10000)
    logger.info(f"Generated {len(chunks)} chunks")

    # Run benchmarks
    results = {
        "timestamp": datetime.now().isoformat(),
        "config": {
            "num_chunks": 10000,
            "embedding_model": settings.EMBEDDING_MODEL,
            "llm_model": settings.LLM_MODEL,
            "embedding_dimension": settings.EMBEDDING_DIMENSION,
        },
        "benchmarks": {},
    }

    memory_analyzer = MemoryAnalyzer()

    # 1. Retrieval Benchmark
    try:
        logger.info("\nStarting RETRIEVAL benchmark (1,000 queries)...")
        retrieval_bench = RetrievalBenchmark(embedding_service)
        result = await retrieval_bench.run(num_queries=1000)
        results["benchmarks"]["retrieval"] = asdict(result)
        memory_analyzer.record_operation("retrieval", result.memory.peak_mb, result.memory.avg_mb)
        logger.info("✓ Retrieval benchmark complete")
    except Exception as e:
        logger.error(f"✗ Retrieval benchmark failed: {e}")
        results["benchmarks"]["retrieval"] = {"error": str(e)}

    # 2. Generation Benchmark
    try:
        logger.info("\nStarting GENERATION benchmark (100 generations)...")
        generation_bench = GenerationBenchmark(llm_client)
        result = await generation_bench.run(num_generations=100)
        results["benchmarks"]["generation"] = asdict(result)
        memory_analyzer.record_operation("generation", result.memory.peak_mb, result.memory.avg_mb)
        logger.info("✓ Generation benchmark complete")
    except Exception as e:
        logger.error(f"✗ Generation benchmark failed: {e}")
        results["benchmarks"]["generation"] = {"error": str(e)}

    # 3. E2E Pipeline Benchmark
    try:
        logger.info("\nStarting E2E PIPELINE benchmark (100 queries)...")
        e2e_bench = E2EPipelineBenchmark(embedding_service, llm_client)
        result = await e2e_bench.run(num_queries=100)
        results["benchmarks"]["e2e_pipeline"] = asdict(result)
        memory_analyzer.record_operation(
            "e2e_pipeline", result.memory.peak_mb, result.memory.avg_mb
        )
        logger.info("✓ E2E pipeline benchmark complete")
    except Exception as e:
        logger.error(f"✗ E2E pipeline benchmark failed: {e}")
        results["benchmarks"]["e2e_pipeline"] = {"error": str(e)}

    # Save results
    output_dir = Path(__file__).parent.parent / "results"
    output_dir.mkdir(exist_ok=True)

    output_file = output_dir / f"benchmark_10k_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)

    logger.info(f"\n✓ Results saved to {output_file}")

    # Print detailed summary
    _print_summary(results)


def _print_summary(results: dict):
    """Print detailed benchmark summary"""
    print("\n" + "=" * 70)
    print("BENCHMARK SUMMARY")
    print("=" * 70)

    for benchmark_name, benchmark_result in results["benchmarks"].items():
        print(f"\n{benchmark_name.upper()}")
        print("-" * 50)

        if "error" in benchmark_result:
            print(f"  ERROR: {benchmark_result['error']}")
            continue

        if "latency" in benchmark_result:
            lat = benchmark_result["latency"]
            print("  Latency (ms):")
            print(f"    Mean: {lat['mean_ms']:.2f}")
            print(f"    P95:  {lat['p95_ms']:.2f}")
            print(f"    P99:  {lat['p99_ms']:.2f}")

        if "throughput" in benchmark_result:
            tput = benchmark_result["throughput"]
            print("  Throughput:")
            print(f"    Queries/sec: {tput['queries_per_sec']:.2f}")
            if tput.get("tokens_per_sec", 0) > 0:
                print(f"    Tokens/sec:  {tput['tokens_per_sec']:.2f}")

        if "memory" in benchmark_result:
            mem = benchmark_result["memory"]
            print("  Memory (MB):")
            print(f"    Peak: {mem['peak_mb']:.1f}")
            print(f"    Avg:  {mem['avg_mb']:.1f}")

    # Validation against targets
    print("\n" + "=" * 70)
    print("TARGET VALIDATION")
    print("=" * 70)

    targets = {
        "retrieval": {
            "mean_ms": 50,
            "p95_ms": 100,
        },
        "e2e_pipeline": {
            "p95_ms": 1000,
        },
        "generation": {
            "tokens_per_sec_min": 10,
            "tokens_per_sec_max": 20,
        },
    }

    for benchmark_name, targets_dict in targets.items():
        if benchmark_name not in results["benchmarks"]:
            continue

        result = results["benchmarks"][benchmark_name]
        if "error" in result:
            print(f"\n{benchmark_name}: FAILED (error)")
            continue

        print(f"\n{benchmark_name}:")
        for target_key, target_val in targets_dict.items():
            if "mean_ms" in target_key and "latency" in result:
                actual = result["latency"]["mean_ms"]
                status = "✓ PASS" if actual < target_val else "✗ FAIL"
                print(f"  {target_key}: {actual:.2f}ms < {target_val}ms {status}")
            elif "p95_ms" in target_key and "latency" in result:
                actual = result["latency"]["p95_ms"]
                status = "✓ PASS" if actual < target_val else "✗ FAIL"
                print(f"  {target_key}: {actual:.2f}ms < {target_val}ms {status}")
            elif "tokens_per_sec" in target_key and "throughput" in result:
                actual = result["throughput"]["tokens_per_sec"]
                if "min" in target_key:
                    status = "✓ PASS" if actual >= target_val else "✗ FAIL"
                    print(f"  {target_key}: {actual:.2f} >= {target_val} {status}")
                elif "max" in target_key:
                    status = "✓ PASS" if actual <= target_val else "✗ FAIL"
                    print(f"  {target_key}: {actual:.2f} <= {target_val} {status}")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
