# Data Ingestion Feature Research and Implementation

**Date:** January 5, 2026
**Author:** Claude Code
**Related Phase:** Phase 13 - Web Content Data Ingestion

## Executive Summary

This document covers the research, design, and initial implementation of automatic data type detection and ingestion features for the basset-hound-browser. These features enable automated extraction of OSINT-relevant data from web pages with configurable supervision modes.

## Research Findings

### 1. basset-hound Repository Analysis

The external basset-hound OSINT platform uses:

**Entity Types** (from `api/models/entity_types.py`):
- Person, Organization, Device, Location, Event, Document
- Each type has configurable sections and fields
- Cross-type relationships are supported (EMPLOYED_BY, OWNS_DEVICE, etc.)

**Orphan Data Model**:
- Identifier-based storage for unattached data points
- Types include: email, phone, social_media, crypto_address, ip_address, domain, url, username, etc.
- Supports provenance tracking and tagging
- Confidence scoring for data quality

**Data Configuration** (`data_config.yaml`):
- Defines identifier types and their patterns
- Configurable sections per entity type
- Relationship type definitions

### 2. Web Data Extraction Best Practices

**Pattern-Based Detection**:
- Regular expressions for structured data (email, phone, crypto addresses)
- Validation layers to reduce false positives
- Context extraction for provenance

**Confidence Scoring**:
- Pattern match quality
- Validation pass/fail
- Context relevance

**Deduplication Strategies**:
- Local caching with TTL
- API-based checking against existing data
- Normalized value comparison

### 3. Ingestion Mode Design

Based on user workflow analysis:

| Mode | Use Case | Automation Level |
|------|----------|------------------|
| Automatic | High-volume collection | Full |
| Selective | Precision investigations | Manual |
| Type-Filtered | Semi-automated workflows | Hybrid |
| Confirmation | Training/learning | Per-item |
| Batch | Multi-page processing | Configurable |

## Implementation

### Files Created

1. **extraction/data-type-detector.js**
   - Core detection engine with 25+ data type patterns
   - Validation layer for each pattern type
   - Configurable confidence thresholds
   - Context extraction and deduplication
   - Custom pattern support

2. **extraction/ingestion-processor.js**
   - Multi-mode ingestion workflow
   - Queue management for selective mode
   - Provenance generation
   - basset-hound orphan data formatting
   - Statistics and history tracking

3. **websocket/commands/ingestion-commands.js**
   - 14 WebSocket API commands
   - Page processing endpoints
   - Configuration management
   - Queue operations
   - Export functionality

4. **tests/unit/data-type-detector.test.js**
   - 50+ test cases for detection
   - Validator tests
   - Pattern coverage tests

5. **tests/unit/ingestion-processor.test.js**
   - Mode switching tests
   - Queue management tests
   - Deduplication tests
   - Provenance tests

6. **tests/integration/ingestion-workflow.test.js**
   - End-to-end workflow tests
   - Batch processing tests
   - Error handling tests

### Supported Data Types

| Category | Types |
|----------|-------|
| Contact | email, phone_us, phone_international, phone_uk |
| Crypto | crypto_btc, crypto_eth, crypto_xmr, crypto_ltc |
| Social | twitter, instagram, linkedin, facebook, github, telegram |
| Technical | ip_v4, ip_v6, domain, url, mac_address |
| Financial | credit_card (detection only), currency_usd, currency_eur |
| Identity | ssn (sensitive), imei, license_plate_us |
| Temporal | date_iso, date_us |
| Location | address_us |

### WebSocket API Commands

```javascript
// Detection
detect_data_types         // Scan page for data types
get_detection_types       // List available types

// Configuration
configure_ingestion       // Set mode and options
get_ingestion_config      // Get current config
set_ingestion_mode        // Quick mode switch

// Processing
process_page_for_ingestion // Full page processing

// Queue Management
get_ingestion_queue       // View pending items
ingest_selected           // Ingest specific items
ingest_all                // Ingest all queued
clear_ingestion_queue     // Clear pending
remove_from_ingestion_queue // Remove specific items

// History & Stats
get_ingestion_history     // View history
get_ingestion_stats       // Get statistics
reset_ingestion_stats     // Reset counters

// Export
export_detections         // Export to JSON

// Patterns
add_detection_pattern     // Add custom pattern
remove_detection_pattern  // Remove pattern
```

## Integration with basset-hound

### Orphan Data Format

The generated orphan data matches basset-hound's expected format:

```json
{
  "identifier_type": "email",
  "identifier_value": "test@example.com",
  "source": "https://example.com/contact",
  "notes": "Detected as Email Address with 95% confidence",
  "tags": ["email", "gmail"],
  "confidence_score": 0.95,
  "metadata": {
    "detection_type": "email",
    "detection_name": "Email Address",
    "context": "...contact us at test@example.com for...",
    "position": { "start": 245, "end": 267 }
  },
  "discovered_date": "2026-01-05T10:30:00Z"
}
```

### Future API Integration

Planned for Phase 13 completion:
- Direct HTTP calls to basset-hound API
- Orphan creation endpoint integration
- Entity creation for rich data
- Relationship inference
- Real-time duplicate checking

## Roadmap Updates

Updated ROADMAP.md with:
- Phase 13: Web Content Data Ingestion (comprehensive)
- Phase 14: Advanced Image Ingestion (planned)

## Next Steps

1. **Integration Testing**: Test with actual basset-hound instance
2. **UI Components**: Build ingestion sidebar panel
3. **Python/Node Clients**: Add ingestion mixins
4. **Rate Limiting**: Implement configurable delays
5. **basset-hound API**: Direct API integration
6. **Learning Mode**: Track user preferences

## Conclusion

The initial implementation provides a solid foundation for automated OSINT data ingestion. The modular architecture supports future expansion while maintaining compatibility with the existing basset-hound platform.
