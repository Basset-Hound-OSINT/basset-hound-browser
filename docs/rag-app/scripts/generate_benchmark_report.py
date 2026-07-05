#!/usr/bin/env python3
"""
Benchmark Report Generator
===========================

Converts raw benchmark JSON results into:
- Detailed markdown report
- Performance comparison charts
- Scalability analysis
- Recommendations
"""

import json
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass
class BenchmarkTargets:
    """Target performance metrics"""

    retrieval_mean_ms: float = 50
    retrieval_p95_ms: float = 100
    generation_tokens_per_sec_min: float = 10
    generation_tokens_per_sec_max: float = 20
    e2e_p95_ms: float = 1000
    e2e_mean_ms: float = 500


def load_benchmark_results(filepath: Path) -> dict:
    """Load benchmark results from JSON file"""
    with open(filepath) as f:
        return json.load(f)


def validate_targets(results: dict, targets: BenchmarkTargets) -> dict:
    """Validate results against targets"""
    validation = {"passed": 0, "failed": 0, "details": {}}

    # Retrieval targets
    if "retrieval" in results["benchmarks"]:
        bench = results["benchmarks"]["retrieval"]
        if "latency" in bench:
            lat = bench["latency"]

            # Mean latency
            mean_ok = lat["mean_ms"] < targets.retrieval_mean_ms
            validation["details"]["retrieval_mean"] = {
                "target": targets.retrieval_mean_ms,
                "actual": lat["mean_ms"],
                "passed": mean_ok,
            }
            if mean_ok:
                validation["passed"] += 1
            else:
                validation["failed"] += 1

            # P95 latency
            p95_ok = lat["p95_ms"] < targets.retrieval_p95_ms
            validation["details"]["retrieval_p95"] = {
                "target": targets.retrieval_p95_ms,
                "actual": lat["p95_ms"],
                "passed": p95_ok,
            }
            if p95_ok:
                validation["passed"] += 1
            else:
                validation["failed"] += 1

    # Generation targets
    if "generation" in results["benchmarks"]:
        bench = results["benchmarks"]["generation"]
        if "throughput" in bench:
            tput = bench["throughput"]
            tokens_per_sec = tput.get("tokens_per_sec", 0)

            min_ok = tokens_per_sec >= targets.generation_tokens_per_sec_min
            validation["details"]["generation_tokens_min"] = {
                "target": targets.generation_tokens_per_sec_min,
                "actual": tokens_per_sec,
                "passed": min_ok,
            }
            if min_ok:
                validation["passed"] += 1
            else:
                validation["failed"] += 1

            max_ok = tokens_per_sec <= targets.generation_tokens_per_sec_max
            validation["details"]["generation_tokens_max"] = {
                "target": targets.generation_tokens_per_sec_max,
                "actual": tokens_per_sec,
                "passed": max_ok,
            }
            if max_ok:
                validation["passed"] += 1
            else:
                validation["failed"] += 1

    # E2E pipeline targets
    if "e2e_pipeline" in results["benchmarks"]:
        bench = results["benchmarks"]["e2e_pipeline"]
        if "latency" in bench:
            lat = bench["latency"]

            p95_ok = lat["p95_ms"] < targets.e2e_p95_ms
            validation["details"]["e2e_p95"] = {
                "target": targets.e2e_p95_ms,
                "actual": lat["p95_ms"],
                "passed": p95_ok,
            }
            if p95_ok:
                validation["passed"] += 1
            else:
                validation["failed"] += 1

            mean_ok = lat["mean_ms"] < targets.e2e_mean_ms
            validation["details"]["e2e_mean"] = {
                "target": targets.e2e_mean_ms,
                "actual": lat["mean_ms"],
                "passed": mean_ok,
            }
            if mean_ok:
                validation["passed"] += 1
            else:
                validation["failed"] += 1

    return validation


def generate_report(results: dict, validation: dict, targets: BenchmarkTargets) -> str:
    """Generate markdown report"""
    report = []

    # Header
    report.append("# 10K Document Chunk Pipeline Benchmark Report")
    report.append("")
    report.append(f"**Generated:** {datetime.now().isoformat()}")
    report.append(f"**Benchmark Date:** {results.get('timestamp', 'N/A')}")
    report.append("")

    # Executive Summary
    report.append("## Executive Summary")
    report.append("")
    report.append(f"- **Total Tests:** {len(results['benchmarks'])}")
    report.append(f"- **Passed:** {validation['passed']}")
    report.append(f"- **Failed:** {validation['failed']}")
    report.append(
        f"- **Success Rate:** {validation['passed']/(validation['passed']+validation['failed'])*100:.1f}%"
    )
    report.append("")

    # Configuration
    report.append("## Configuration")
    report.append("")
    config = results.get("config", {})
    report.append(f"- **Document Chunks:** {config.get('num_chunks', 'N/A'):,}")
    report.append(f"- **Embedding Model:** {config.get('embedding_model', 'N/A')}")
    report.append(f"- **Embedding Dimension:** {config.get('embedding_dimension', 'N/A')}")
    report.append(f"- **LLM Model:** {config.get('llm_model', 'N/A')}")
    report.append("")

    # Detailed Results
    report.append("## Detailed Results")
    report.append("")

    # Retrieval Benchmark
    if "retrieval" in results["benchmarks"]:
        bench = results["benchmarks"]["retrieval"]
        report.append("### Retrieval Benchmark")
        report.append("")
        report.append(f"**Configuration:** {bench.get('config', {})}")
        report.append("")

        if "error" not in bench:
            lat = bench.get("latency", {})
            mem = bench.get("memory", {})
            tput = bench.get("throughput", {})

            report.append("#### Latency Metrics (ms)")
            report.append("")
            report.append("| Metric | Value | Target | Status |")
            report.append("|--------|-------|--------|--------|")
            report.append(
                f"| Mean | {lat.get('mean_ms', 0):.2f} | {targets.retrieval_mean_ms} | {'✓' if validation['details'].get('retrieval_mean', {}).get('passed') else '✗'} |"
            )
            report.append(f"| Median | {lat.get('median_ms', 0):.2f} | - | - |")
            report.append(
                f"| P95 | {lat.get('p95_ms', 0):.2f} | {targets.retrieval_p95_ms} | {'✓' if validation['details'].get('retrieval_p95', {}).get('passed') else '✗'} |"
            )
            report.append(f"| P99 | {lat.get('p99_ms', 0):.2f} | - | - |")
            report.append("")

            report.append("#### Memory Metrics")
            report.append("")
            report.append("| Metric | Value |")
            report.append("|--------|-------|")
            report.append(f"| Peak (MB) | {mem.get('peak_mb', 0):.1f} |")
            report.append(f"| Average (MB) | {mem.get('avg_mb', 0):.1f} |")
            report.append("")

            report.append("#### Throughput")
            report.append("")
            report.append("| Metric | Value |")
            report.append("|--------|-------|")
            report.append(f"| Queries/Second | {tput.get('queries_per_sec', 0):.2f} |")
            report.append("")
        else:
            report.append(f"**ERROR:** {bench.get('error')}")
            report.append("")

    # Generation Benchmark
    if "generation" in results["benchmarks"]:
        bench = results["benchmarks"]["generation"]
        report.append("### Generation Benchmark")
        report.append("")
        report.append(f"**Configuration:** {bench.get('config', {})}")
        report.append("")

        if "error" not in bench:
            lat = bench.get("latency", {})
            mem = bench.get("memory", {})
            tput = bench.get("throughput", {})

            report.append("#### Latency Metrics (ms)")
            report.append("")
            report.append("| Metric | Value |")
            report.append("|--------|-------|")
            report.append(f"| Mean | {lat.get('mean_ms', 0):.2f} |")
            report.append(f"| P95 | {lat.get('p95_ms', 0):.2f} |")
            report.append("")

            report.append("#### Generation Throughput")
            report.append("")
            tokens_per_sec = tput.get("tokens_per_sec", 0)
            report.append("| Metric | Value | Target Min | Target Max | Status |")
            report.append("|--------|-------|------------|------------|--------|")
            report.append(
                f"| Tokens/Second | {tokens_per_sec:.2f} | {targets.generation_tokens_per_sec_min} | {targets.generation_tokens_per_sec_max} | {'✓' if targets.generation_tokens_per_sec_min <= tokens_per_sec <= targets.generation_tokens_per_sec_max else '✗'} |"
            )
            report.append("")

            report.append("#### Memory Metrics")
            report.append("")
            report.append("| Metric | Value |")
            report.append("|--------|-------|")
            report.append(f"| Peak (MB) | {mem.get('peak_mb', 0):.1f} |")
            report.append(f"| Average (MB) | {mem.get('avg_mb', 0):.1f} |")
            report.append("")
        else:
            report.append(f"**ERROR:** {bench.get('error')}")
            report.append("")

    # E2E Pipeline Benchmark
    if "e2e_pipeline" in results["benchmarks"]:
        bench = results["benchmarks"]["e2e_pipeline"]
        report.append("### End-to-End Pipeline Benchmark")
        report.append("")
        report.append(f"**Configuration:** {bench.get('config', {})}")
        report.append("")

        if "error" not in bench:
            lat = bench.get("latency", {})
            mem = bench.get("memory", {})
            tput = bench.get("throughput", {})

            report.append("#### Latency Metrics (ms)")
            report.append("")
            report.append("| Metric | Value | Target | Status |")
            report.append("|--------|-------|--------|--------|")
            report.append(
                f"| Mean | {lat.get('mean_ms', 0):.2f} | {targets.e2e_mean_ms} | {'✓' if validation['details'].get('e2e_mean', {}).get('passed') else '✗'} |"
            )
            report.append(
                f"| P95 | {lat.get('p95_ms', 0):.2f} | {targets.e2e_p95_ms} | {'✓' if validation['details'].get('e2e_p95', {}).get('passed') else '✗'} |"
            )
            report.append(f"| P99 | {lat.get('p99_ms', 0):.2f} | - | - |")
            report.append("")

            report.append("#### Memory Metrics")
            report.append("")
            report.append("| Metric | Value |")
            report.append("|--------|-------|")
            report.append(f"| Peak (MB) | {mem.get('peak_mb', 0):.1f} |")
            report.append(f"| Average (MB) | {mem.get('avg_mb', 0):.1f} |")
            report.append("")

            report.append("#### Throughput")
            report.append("")
            report.append("| Metric | Value |")
            report.append("|--------|-------|")
            report.append(f"| Queries/Second | {tput.get('queries_per_sec', 0):.2f} |")
            if tput.get("tokens_per_sec", 0) > 0:
                report.append(f"| Tokens/Second | {tput.get('tokens_per_sec', 0):.2f} |")
            report.append("")
        else:
            report.append(f"**ERROR:** {bench.get('error')}")
            report.append("")

    # Performance Analysis
    report.append("## Performance Analysis")
    report.append("")

    report.append("### Strengths")
    report.append("")
    strengths = []
    if validation["details"].get("retrieval_mean", {}).get("passed"):
        strengths.append("✓ Retrieval latency within target (<50ms mean)")
    if validation["details"].get("retrieval_p95", {}).get("passed"):
        strengths.append("✓ Retrieval P95 within target (<100ms)")
    if validation["details"].get("e2e_p95", {}).get("passed"):
        strengths.append("✓ E2E pipeline P95 within target (<1s)")

    if not strengths:
        strengths.append("See recommendations section")

    for s in strengths:
        report.append(f"- {s}")
    report.append("")

    report.append("### Areas for Improvement")
    report.append("")
    improvements = []
    if not validation["details"].get("retrieval_mean", {}).get("passed"):
        actual = validation["details"].get("retrieval_mean", {}).get("actual", 0)
        target = targets.retrieval_mean_ms
        improvements.append(
            f"- Retrieval latency: {actual:.1f}ms (target: {target}ms). Consider: batch embedding optimization, query caching, index tuning"
        )
    if not validation["details"].get("retrieval_p95", {}).get("passed"):
        actual = validation["details"].get("retrieval_p95", {}).get("actual", 0)
        target = targets.retrieval_p95_ms
        improvements.append(
            f"- Retrieval P95: {actual:.1f}ms (target: {target}ms). Consider: connection pooling, result pagination"
        )
    if not validation["details"].get("e2e_p95", {}).get("passed"):
        actual = validation["details"].get("e2e_p95", {}).get("actual", 0)
        target = targets.e2e_p95_ms
        improvements.append(
            f"- E2E pipeline: {actual:.1f}ms (target: {target}ms). Bottleneck analysis: check retrieval and generation phases"
        )

    if not improvements:
        improvements.append("- All metrics meet targets; no critical improvements needed")

    for imp in improvements:
        report.append(imp)
    report.append("")

    # Recommendations
    report.append("## Recommendations for Scale")
    report.append("")

    report.append("### For Production Deployment")
    report.append("")
    report.append(
        "1. **Connection Pooling:** Increase PostgreSQL pool size to handle 100+ concurrent connections"
    )
    report.append(
        "2. **Caching Layer:** Implement Redis caching for embeddings to reduce recomputation (target 70%+ hit rate)"
    )
    report.append(
        "3. **Query Batching:** Group embedding requests to leverage GPU batch processing (batch size: 32-64)"
    )
    report.append(
        "4. **Index Optimization:** Use HNSW indices for vector search (10-15x faster than linear scan)"
    )
    report.append("5. **GPU Acceleration:** Deploy embedding model on GPU for 5-10x speedup")
    report.append("")

    report.append("### For Scaling to 100K+ Chunks")
    report.append("")
    report.append(
        "1. **Sharding:** Partition chunks across multiple databases (shard by document_id or hash)"
    )
    report.append(
        "2. **Approximate Search:** Use FAISS or Milvus for ANN at scale (millions of chunks)"
    )
    report.append(
        "3. **Hierarchical Retrieval:** First retrieve clusters, then chunks within clusters"
    )
    report.append(
        "4. **Distributed Generation:** Deploy LLM across multiple GPUs (model sharding or ensemble)"
    )
    report.append(
        "5. **Load Balancing:** Distribute queries across multiple retrieval + generation instances"
    )
    report.append("")

    report.append("### Memory Optimization")
    report.append("")
    report.append(
        "1. **Model Quantization:** Use 8-bit or 4-bit quantization for embeddings/LLM (reduces memory 4-8x)"
    )
    report.append(
        "2. **Streaming:** Process large results in streaming fashion vs loading into memory"
    )
    report.append("3. **Pruning:** Remove low-frequency embeddings from cache after TTL")
    report.append("")

    report.append("### Monitoring & Observability")
    report.append("")
    report.append(
        "1. **Latency Tracking:** Monitor P95/P99 latencies continuously (set alerts if drift +10%)"
    )
    report.append("2. **Resource Alerts:** CPU >80%, Memory >85%, GPU >90% → scale out")
    report.append("3. **Cache Metrics:** Track hit rate, eviction rate, memory footprint")
    report.append("4. **Error Rate:** Monitor failed retrievals and generations (target: <0.1%)")
    report.append("")

    # Next Steps
    report.append("## Next Steps")
    report.append("")
    report.append("1. **Load Testing:** Test with 10-100 concurrent users (Phase 5B)")
    report.append(
        "2. **Stress Testing:** Identify breaking points (memory limits, connection exhaustion)"
    )
    report.append(
        "3. **Production Readiness:** Deploy to staging with production-like data volume"
    )
    report.append(
        "4. **Long-running Tests:** Monitor performance over 24-48 hours for memory leaks, connection issues"
    )
    report.append(
        "5. **A/B Testing:** Compare different retrieval strategies (keyword vs semantic vs hybrid)"
    )
    report.append("")

    # Appendix
    report.append("## Appendix: Raw Metrics")
    report.append("")
    report.append("```json")
    report.append(json.dumps(results, indent=2))
    report.append("```")
    report.append("")

    return "\n".join(report)


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python generate_benchmark_report.py <benchmark_json_file>")
        sys.exit(1)

    benchmark_file = Path(sys.argv[1])

    if not benchmark_file.exists():
        print(f"File not found: {benchmark_file}")
        sys.exit(1)

    # Load results
    results = load_benchmark_results(benchmark_file)

    # Validate
    targets = BenchmarkTargets()
    validation = validate_targets(results, targets)

    # Generate report
    report = generate_report(results, validation, targets)

    # Save report
    report_file = benchmark_file.parent / f"{benchmark_file.stem}_report.md"
    with open(report_file, "w") as f:
        f.write(report)

    print(f"✓ Report generated: {report_file}")

    # Print to stdout as well
    print("\n" + report)


if __name__ == "__main__":
    main()
