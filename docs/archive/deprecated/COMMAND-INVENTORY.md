# Complete Command Inventory & Classification

**Generated:** 2026-06-21  
**Total Files:** 56  
**Total Commands:** ~622  
**Status:** Analysis Complete

---

## Table of Contents
1. [Forensic Commands (14 files)](#forensic-commands)
2. [Evasion & Anonymization Commands (10 files)](#evasion--anonymization-commands)
3. [Monitoring & Tracking Commands (8 files)](#monitoring--tracking-commands)
4. [Core Browser Commands (15 files)](#core-browser-commands)
5. [Export/Import & Data Commands (5 files)](#exportimport--data-commands)
6. [Admin & Integration Commands (4 files)](#admin--integration-commands)
7. [Consolidation Mapping](#consolidation-mapping)

---

## FORENSIC COMMANDS

### Category: Legal Compliance, Evidence Capture, Chain-of-Custody

**Total Files:** 14  
**Estimated Commands:** ~140

#### 1. evidence-commands.js
**Location:** `websocket/commands/evidence-commands.js`  
**Size:** 323 lines  
**Commands:** ~8  
**Purpose:** Individual evidence capture (screenshot, archive, HAR, DOM, console, cookies, storage)

```
- capture_screenshot_evidence
- capture_page_archive_evidence
- capture_har_evidence
- capture_dom_evidence
- capture_console_evidence
- capture_cookies_evidence
- capture_storage_evidence
- get_evidence_types
```

**Target Location:** `websocket/commands/forensic/evidence.js`  
**Status:** Move + Merge with evidence-packaging.js and evidence-correlation-commands.js

---

#### 2. evidence-packaging.js
**Location:** `websocket/commands/evidence-packaging.js`  
**Size:** 562 lines  
**Commands:** ~18  
**Purpose:** Evidence packaging, preservation, and export

```
- create_evidence_package
- add_evidence_to_package
- remove_evidence_from_package
- list_evidence_in_package
- export_evidence_package
- import_evidence_package
- seal_evidence_package
- verify_package_integrity
- generate_chain_of_custody
- get_package_metadata
- (and more)
```

**Target Location:** `websocket/commands/forensic/evidence.js`  
**Status:** Merge into evidence.js

---

#### 3. evidence-correlation-commands.js
**Location:** `websocket/commands/evidence-correlation-commands.js`  
**Size:** 574 lines  
**Commands:** ~5  
**Purpose:** Cross-site evidence analysis and correlation

```
- correlate_evidence
- detect_correlation_patterns
- generate_correlation_report
- list_correlations
- get_correlation_metadata
```

**Target Location:** `websocket/commands/forensic/evidence.js`  
**Status:** Merge into evidence.js

---

#### 4. legal-compliance-commands.js
**Location:** `websocket/commands/legal-compliance-commands.js`  
**Size:** 582 lines  
**Commands:** ~6  
**Purpose:** Legal compliance and chain of custody documentation

```
- record_legal_notice
- document_consent
- create_audit_trail
- verify_chain_of_custody
- export_for_court
- get_compliance_status
```

**Target Location:** `websocket/commands/forensic/legal-compliance.js`  
**Status:** Move + Merge with phase2-p0-legal-compliance-commands.js

---

#### 5. phase2-p0-legal-compliance-commands.js
**Location:** `websocket/commands/phase2-p0-legal-compliance-commands.js`  
**Size:** 413 lines  
**Commands:** ~0 (phase placeholder)  
**Purpose:** Phase 2 legal compliance features

**Target Location:** `websocket/commands/forensic/legal-compliance.js`  
**Status:** Merge into legal-compliance.js

---

#### 6. network-forensics-commands.js
**Location:** `websocket/commands/network-forensics-commands.js`  
**Size:** 738 lines  
**Commands:** ~26  
**Purpose:** Network traffic forensic capture and analysis

```
- capture_network_trace
- analyze_http_requests
- extract_header_metadata
- detect_request_anomalies
- capture_dns_queries
- extract_tls_certificate_info
- capture_redirect_chain
- detect_request_timing_anomalies
- extract_websocket_metadata
- analyze_request_patterns
- (and more)
```

**Target Location:** `websocket/commands/forensic/network-forensics.js`  
**Status:** Move (standalone)

---

#### 7. session-tracking-commands.js
**Location:** `websocket/commands/session-tracking-commands.js`  
**Size:** 517 lines  
**Commands:** ~3  
**Purpose:** Session footprint tracking for forensic purposes

```
- track_session_footprint
- correlate_session_markers
- generate_session_chain_of_custody
```

**Target Location:** `websocket/commands/forensic/session-tracking.js`  
**Status:** Move (standalone)

---

#### 8. screenshot-commands.js
**Location:** `websocket/commands/screenshot-commands.js`  
**Size:** 589 lines  
**Commands:** ~15  
**Purpose:** Screenshot evidence capture with annotations and verification

```
- capture_full_page_screenshot
- capture_element_screenshot
- capture_viewport_screenshot
- annotate_screenshot
- timestamp_screenshot
- verify_screenshot_hash
- export_screenshot_as_evidence
- (and more)
```

**Target Location:** 
- `websocket/commands/forensic/screenshots.js` (forensic version)
- `websocket/commands/browser/screenshots.js` (general version - COPY)

**Status:** Copy (shared between forensic and browser modules)

---

#### 9. dom-snapshot-commands.js
**Location:** `websocket/commands/dom-snapshot-commands.js`  
**Size:** 354 lines  
**Commands:** ~7  
**Purpose:** DOM snapshot capture with integrity verification

```
- snapshot_dom
- extract_dom_metadata
- validate_dom_integrity
- compare_dom_snapshots
- (and more)
```

**Target Location:** `websocket/commands/forensic/screenshots.js`  
**Status:** Merge into forensic/screenshots.js (related to content capture)

---

#### 10. javascript-console-extraction.js
**Location:** `websocket/commands/javascript-console-extraction.js`  
**Size:** 742 lines  
**Commands:** ~10  
**Purpose:** Console logs and JavaScript execution evidence extraction

```
- extract_console_logs
- capture_console_state
- extract_errors
- extract_warnings
- extract_debug_messages
- correlate_console_errors
- (and more)
```

**Target Location:** `websocket/commands/forensic/extraction.js`  
**Status:** Move + Merge with html-capture-commands.js

---

#### 11. html-capture-commands.js
**Location:** `websocket/commands/html-capture-commands.js`  
**Size:** 302 lines  
**Commands:** ~6  
**Purpose:** HTML content forensic capture with metadata

```
- capture_html_content
- capture_html_with_metadata
- extract_inner_html
- export_as_mhtml
- (and more)
```

**Target Location:** `websocket/commands/forensic/extraction.js`  
**Status:** Merge into extraction.js

---

#### 12. video-recording-commands.js
**Location:** `websocket/commands/video-recording-commands.js`  
**Size:** 588 lines  
**Commands:** ~14  
**Purpose:** Video recording for forensic record

```
- start_video_recording
- stop_video_recording
- pause_video_recording
- get_recording_metadata
- export_video_evidence
- verify_video_integrity
- (and more)
```

**Target Location:** `websocket/commands/forensic/recordings.js`  
**Status:** Move + Merge with recording-commands.js

---

#### 13. recording-commands.js
**Location:** `websocket/commands/recording-commands.js`  
**Size:** 670 lines  
**Commands:** ~20  
**Purpose:** User interaction recording for audit

```
- record_user_interactions
- playback_recording
- export_interaction_log
- verify_recording_integrity
- get_recording_statistics
- (and more)
```

**Target Location:** `websocket/commands/forensic/recordings.js`  
**Status:** Merge into recordings.js

---

#### 14. report-generation.js
**Location:** `websocket/commands/report-generation.js`  
**Size:** 622 lines  
**Commands:** ~0 (utility module)  
**Purpose:** Forensic report generation and formatting

**Target Location:** `websocket/commands/forensic/reports.js`  
**Status:** Move (standalone utility)

---

## EVASION & ANONYMIZATION COMMANDS

### Category: Bot Detection Evasion, Fingerprinting, Behavioral Anonymization

**Total Files:** 10  
**Estimated Commands:** ~100

#### 1. evasion-commands.js
**Location:** `websocket/commands/evasion-commands.js`  
**Size:** 1049 lines  
**Commands:** ~29  
**Purpose:** Core bot detection evasion (fingerprinting spoofing, behavior injection)

```
- enable_canvas_evasion
- enable_webgl_evasion
- enable_audio_context_evasion
- enable_plugin_evasion
- inject_human_behavior
- randomize_user_agent
- spoof_screen_properties
- (and more)
```

**Target Location:** `websocket/commands/evasion/fingerprinting.js`  
**Status:** Move + Merge with extended-evasion-commands.js

---

#### 2. extended-evasion-commands.js
**Location:** `websocket/commands/extended-evasion-commands.js`  
**Size:** 529 lines  
**Commands:** ~6  
**Purpose:** Extended bot evasion vectors (WebRTC, fonts, plugins)

```
- prevent_webrtc_leak
- spoof_font_list
- hide_plugins
- spoof_timezone
- (and more)
```

**Target Location:** `websocket/commands/evasion/fingerprinting.js`  
**Status:** Merge into fingerprinting.js

---

#### 3. behavioral-anonymization-commands.js
**Location:** `websocket/commands/behavioral-anonymization-commands.js`  
**Size:** 383 lines  
**Commands:** ~0  
**Purpose:** Behavioral pattern obscuration

**Target Location:** `websocket/commands/evasion/behavioral.js`  
**Status:** Move

---

#### 4. anonymity-commands.js
**Location:** `websocket/commands/anonymity-commands.js`  
**Size:** 495 lines  
**Commands:** ~11  
**Purpose:** General anonymity features and cross-site tracking prevention

```
- enable_anonymity_mode
- prevent_cross_site_tracking
- block_third_party_cookies
- prevent_fingerprinting
- (and more)
```

**Target Location:** `websocket/commands/evasion/anonymity.js`  
**Status:** Move (standalone)

---

#### 5. fake-data-commands.js
**Location:** `websocket/commands/fake-data-commands.js`  
**Size:** 334 lines  
**Commands:** ~8  
**Purpose:** Fake data generation for evasion

```
- generate_fake_user_profile
- generate_fake_device_id
- generate_fake_fingerprint
- generate_fake_network_signature
- (and more)
```

**Target Location:** `websocket/commands/evasion/detection-bypass.js`  
**Status:** Move + Merge with location-commands.js and tech-detection.js

---

#### 6. location-commands.js
**Location:** `websocket/commands/location-commands.js`  
**Size:** 330 lines  
**Commands:** ~11  
**Purpose:** Geolocation and location spoofing

```
- spoof_geolocation
- set_fake_timezone
- set_fake_ip_location
- set_fake_gps_coordinates
- (and more)
```

**Target Location:** `websocket/commands/evasion/detection-bypass.js`  
**Status:** Merge into detection-bypass.js

---

#### 7. coherence-check.js
**Location:** `websocket/commands/coherence-check.js`  
**Size:** 615 lines  
**Commands:** ~11  
**Purpose:** Session coherence validation across evasion vectors

```
- validate_fingerprint_consistency
- check_behavioral_coherence
- detect_inconsistencies
- validate_timing_coherence
- (and more)
```

**Target Location:** `websocket/commands/evasion/coherence.js`  
**Status:** Move + Merge with coherence-validation-commands.js

---

#### 8. coherence-validation-commands.js
**Location:** `websocket/commands/coherence-validation-commands.js`  
**Size:** 394 lines  
**Commands:** ~8  
**Purpose:** Multi-detector coherence validation

```
- validate_across_detection_services
- detect_service_fingerprinting
- check_consistency
- (and more)
```

**Target Location:** `websocket/commands/evasion/coherence.js`  
**Status:** Merge into coherence.js

---

#### 9. behavior-scoring.js
**Location:** `websocket/commands/behavior-scoring.js`  
**Size:** 528 lines  
**Commands:** ~10  
**Purpose:** Behavioral pattern scoring for evasion optimization

```
- score_behavioral_pattern
- calculate_suspicion_metric
- optimize_evasion_parameters
- (and more)
```

**Target Location:** `websocket/commands/evasion/behavioral.js`  
**Status:** Merge into behavioral.js

---

#### 10. tech-detection.js
**Location:** `websocket/commands/tech-detection.js`  
**Size:** 452 lines  
**Commands:** ~8  
**Purpose:** Technology detection and evasion recommendation

```
- detect_anti_bot_service
- identify_defense_mechanism
- recommend_evasion_vector
- (and more)
```

**Target Location:** `websocket/commands/evasion/detection-bypass.js`  
**Status:** Merge into detection-bypass.js

---

## MONITORING & TRACKING COMMANDS

### Category: Competitive Intelligence, Website Tracking, Change Detection, Analytics

**Total Files:** 8  
**Estimated Commands:** ~120

#### 1. competitor-monitoring-commands.js
**Location:** `websocket/commands/competitor-monitoring-commands.js`  
**Size:** 622 lines  
**Commands:** ~23  
**Purpose:** Competitor website monitoring and alert configuration

```
- add_competitor_monitor
- remove_competitor_monitor
- update_monitor_frequency
- configure_alerts
- list_monitors
- get_monitor_status
- (and more)
```

**Target Location:** `websocket/commands/monitoring/competitor.js`  
**Status:** Move (standalone)

---

#### 2. monitoring-commands.js
**Location:** `websocket/commands/monitoring-commands.js`  
**Size:** 518 lines  
**Commands:** ~16  
**Purpose:** General page monitoring and content analysis

```
- monitor_page_changes
- analyze_content
- get_monitoring_status
- (and more)
```

**Target Location:** `websocket/commands/monitoring/metrics.js`  
**Status:** Merge (part of metrics consolidation)

---

#### 3. monitoring-advanced.js
**Location:** `websocket/commands/monitoring-advanced.js`  
**Size:** 742 lines  
**Commands:** ~17  
**Purpose:** Advanced monitoring with pattern detection and anomaly detection

```
- detect_patterns
- detect_anomalies
- predict_changes
- (and more)
```

**Target Location:** `websocket/commands/monitoring/metrics.js`  
**Status:** Merge into metrics.js

---

#### 4. monitoring-continuous.js
**Location:** `websocket/commands/monitoring-continuous.js`  
**Size:** 569 lines  
**Commands:** ~9  
**Purpose:** Continuous background monitoring

```
- enable_continuous_monitoring
- configure_check_schedule
- get_continuous_status
- (and more)
```

**Target Location:** `websocket/commands/monitoring/metrics.js`  
**Status:** Merge into metrics.js

---

#### 5. monitoring-metrics-commands.js
**Location:** `websocket/commands/monitoring-metrics-commands.js`  
**Size:** 568 lines  
**Commands:** ~16  
**Purpose:** Metrics collection and monitoring consent management

```
- collect_metrics
- get_metrics_summary
- export_metrics
- (and more)
```

**Target Location:** `websocket/commands/monitoring/metrics.js`  
**Status:** Merge into metrics.js

---

#### 6. change-detection.js
**Location:** `websocket/commands/change-detection.js`  
**Size:** 494 lines  
**Commands:** ~9  
**Purpose:** Website change detection and timeline tracking

```
- detect_content_changes
- track_dom_mutations
- generate_change_report
- (and more)
```

**Target Location:** `websocket/commands/monitoring/change-detection.js`  
**Status:** Move (standalone)

---

#### 7. analytics-advanced.js
**Location:** `websocket/commands/analytics-advanced.js`  
**Size:** 759 lines  
**Commands:** ~11  
**Purpose:** Advanced website analytics and behavior analysis

```
- analyze_user_behavior
- track_event
- generate_analytics_report
- (and more)
```

**Target Location:** `websocket/commands/monitoring/analytics.js`  
**Status:** Move (standalone)

---

#### 8. performance-metrics.js
**Location:** `websocket/commands/performance-metrics.js`  
**Size:** 618 lines  
**Commands:** ~12  
**Purpose:** Performance monitoring and optimization

```
- measure_performance
- get_performance_metrics
- recommend_optimization
- (and more)
```

**Target Location:** `websocket/commands/monitoring/metrics.js`  
**Status:** Merge into metrics.js

---

## CORE BROWSER COMMANDS

### Category: Basic Browser Automation, Session Management, Profile Handling

**Total Files:** 15  
**Estimated Commands:** ~175

#### 1. screenshot-commands.js (General Browser Version)
**Location:** `websocket/commands/screenshot-commands.js`  
**Size:** 589 lines  
**Commands:** ~15  
**Purpose:** Screenshot capture (general, non-forensic)

**Target Location:** `websocket/commands/browser/screenshots.js`  
**Status:** Copy (dual: also in forensic/screenshots.js)

**Note:** This file is dual-purpose. Forensic version includes chain-of-custody, general version is simplified.

---

#### 2. image-commands.js
**Location:** `websocket/commands/image-commands.js`  
**Size:** 569 lines  
**Commands:** ~12  
**Purpose:** Image metadata extraction and handling

```
- extract_image_metadata
- analyze_image
- get_image_properties
- (and more)
```

**Target Location:** `websocket/commands/browser/screenshots.js`  
**Status:** Merge into screenshots.js

---

#### 3. extraction-commands.js
**Location:** `websocket/commands/extraction-commands.js`  
**Size:** 385 lines  
**Commands:** ~11  
**Purpose:** Data extraction templates and automation

```
- extract_text
- extract_links
- extract_tables
- (and more)
```

**Target Location:** `websocket/commands/browser/extraction.js`  
**Status:** Move

---

#### 4. form-commands.js
**Location:** `websocket/commands/form-commands.js`  
**Size:** 436 lines  
**Commands:** ~10  
**Purpose:** Smart form filling and submission

```
- fill_form
- submit_form
- validate_form
- (and more)
```

**Target Location:** `websocket/commands/browser/form-automation.js`  
**Status:** Move

---

#### 5. multi-page-commands.js
**Location:** `websocket/commands/multi-page-commands.js`  
**Size:** 395 lines  
**Commands:** ~15  
**Purpose:** Multi-page session and tab management

```
- open_new_page
- close_page
- switch_page
- (and more)
```

**Target Location:** `websocket/commands/browser/session-management.js`  
**Status:** Merge into session-management.js

---

#### 6. session-management.js
**Location:** `websocket/commands/session-management.js`  
**Size:** 831 lines  
**Commands:** ~19  
**Purpose:** Session lifecycle management

```
- create_session
- destroy_session
- get_session_state
- (and more)
```

**Target Location:** `websocket/commands/browser/session-management.js`  
**Status:** Move + Merge with other session files

---

#### 7. session-persistence-commands.js
**Location:** `websocket/commands/session-persistence-commands.js`  
**Size:** 393 lines  
**Commands:** ~6  
**Purpose:** Session persistence v1

```
- save_session
- restore_session
- list_sessions
- (and more)
```

**Target Location:** `websocket/commands/browser/session-management.js`  
**Status:** Merge into session-management.js

---

#### 8. session-persistence-v2.js
**Location:** `websocket/commands/session-persistence-v2.js`  
**Size:** 425 lines  
**Commands:** ~15  
**Purpose:** Session persistence v2

**Target Location:** `websocket/commands/browser/session-management.js`  
**Status:** Merge into session-management.js

---

#### 9. session-persistence-v3.js
**Location:** `websocket/commands/session-persistence-v3.js`  
**Size:** 400 lines  
**Commands:** ~0 (v3 placeholder)  
**Purpose:** Session persistence v3

**Target Location:** `websocket/commands/browser/session-management.js`  
**Status:** Merge into session-management.js

---

#### 10. session-persistence-week2-commands.js
**Location:** `websocket/commands/session-persistence-week2-commands.js`  
**Size:** 617 lines  
**Commands:** ~24  
**Purpose:** Session persistence week 2 implementation

**Target Location:** `websocket/commands/browser/session-management.js`  
**Status:** Merge into session-management.js

---

#### 11. profile-template-commands.js
**Location:** `websocket/commands/profile-template-commands.js`  
**Size:** 364 lines  
**Commands:** ~13  
**Purpose:** Browser profile template management

```
- create_profile_template
- list_profile_templates
- apply_profile_template
- (and more)
```

**Target Location:** `websocket/commands/browser/profiles.js`  
**Status:** Move

---

#### 12. cookie-commands.js
**Location:** `websocket/commands/cookie-commands.js`  
**Size:** 374 lines  
**Commands:** ~16  
**Purpose:** Cookie management (get, set, delete, clear)

```
- get_cookies
- set_cookie
- delete_cookie
- clear_cookies
- (and more)
```

**Target Location:** `websocket/commands/browser/cookies.js`  
**Status:** Move + Merge with credentials-commands.js

---

#### 13. credentials-commands.js
**Location:** `websocket/commands/credentials-commands.js`  
**Size:** 406 lines  
**Commands:** ~6  
**Purpose:** Credentials and TOTP/HOTP handling

```
- store_credentials
- get_credentials
- generate_totp
- (and more)
```

**Target Location:** `websocket/commands/browser/cookies.js`  
**Status:** Merge into cookies.js

---

#### 14. proxy-partner-commands.js
**Location:** `websocket/commands/proxy-partner-commands.js`  
**Size:** 461 lines  
**Commands:** ~14  
**Purpose:** Proxy partner integration

```
- configure_proxy_partner
- get_proxy_partner_status
- (and more)
```

**Target Location:** `websocket/commands/browser/profiles.js`  
**Status:** Merge into profiles.js (profile-related)

---

#### 15. extended-features-commands.js
**Location:** `websocket/commands/extended-features-commands.js`  
**Size:** 790 lines  
**Commands:** ~22  
**Purpose:** Extended browser features (notification, geolocation, permissions)

```
- request_permission
- set_permission
- handle_notification
- (and more)
```

**Target Location:** `websocket/commands/browser/extraction.js`  
**Status:** Merge into extraction.js (extended features)

---

## EXPORT/IMPORT & DATA COMMANDS

### Category: Data Export/Import, Formatting, Batch Operations

**Total Files:** 5  
**Estimated Commands:** ~50

#### 1. export-formats.js
**Location:** `websocket/commands/export-formats.js`  
**Size:** 1043 lines  
**Commands:** ~8  
**Purpose:** Export format definitions and conversion

```
- export_as_json
- export_as_csv
- export_as_xml
- export_as_pdf
- (and more)
```

**Target Location:** `websocket/commands/export/formats.js`  
**Status:** Move

---

#### 2. export-templates-commands.js
**Location:** `websocket/commands/export-templates-commands.js`  
**Size:** 577 lines  
**Commands:** ~13  
**Purpose:** Export template management

```
- create_export_template
- list_export_templates
- apply_export_template
- (and more)
```

**Target Location:** `websocket/commands/export/templates.js`  
**Status:** Move

---

#### 3. encrypted-export-commands.js
**Location:** `websocket/commands/encrypted-export-commands.js`  
**Size:** 570 lines  
**Commands:** ~8  
**Purpose:** Encrypted data export

```
- export_encrypted
- import_encrypted
- set_encryption_key
- (and more)
```

**Target Location:** `websocket/commands/export/encryption.js`  
**Status:** Move

---

#### 4. batch-operations-commands.js
**Location:** `websocket/commands/batch-operations-commands.js`  
**Size:** 584 lines  
**Commands:** ~11  
**Purpose:** Batch operations and deduplication

```
- execute_batch_operation
- deduplicate_data
- batch_export
- (and more)
```

**Target Location:** `websocket/commands/export/batch.js`  
**Status:** Move + Merge with correlation-commands.js

---

#### 5. correlation-commands.js
**Location:** `websocket/commands/correlation-commands.js`  
**Size:** 405 lines  
**Commands:** ~10  
**Purpose:** Data correlation and pattern detection

```
- correlate_data
- detect_patterns
- generate_correlation_map
- (and more)
```

**Target Location:** `websocket/commands/export/batch.js`  
**Status:** Merge into batch.js (data transformation)

---

## ADMIN & INTEGRATION COMMANDS

### Category: System Administration, Integrations, Updates

**Total Files:** 4  
**Estimated Commands:** ~35

#### 1. dashboard-commands.js
**Location:** `websocket/commands/dashboard-commands.js`  
**Size:** 587 lines  
**Commands:** ~18  
**Purpose:** Dashboard management and real-time monitoring

```
- get_dashboard_data
- update_dashboard_widget
- configure_dashboard
- (and more)
```

**Target Location:** `websocket/commands/admin/dashboard.js`  
**Status:** Move

---

#### 2. slack-commands.js
**Location:** `websocket/commands/slack-commands.js`  
**Size:** 259 lines  
**Commands:** ~8  
**Purpose:** Slack integration for notifications

```
- send_slack_message
- post_slack_alert
- configure_slack_webhook
- (and more)
```

**Target Location:** `websocket/commands/admin/notifications.js`  
**Status:** Move + Merge with slack-routing-commands.js

---

#### 3. slack-routing-commands.js
**Location:** `websocket/commands/slack-routing-commands.js`  
**Size:** 354 lines  
**Commands:** ~10  
**Purpose:** Slack alert routing and management

```
- configure_alert_routing
- route_alert
- list_routing_rules
- (and more)
```

**Target Location:** `websocket/commands/admin/notifications.js`  
**Status:** Merge into notifications.js

---

#### 4. updater.js
**Location:** `websocket/commands/updater.js`  
**Size:** 407 lines  
**Commands:** ~10  
**Purpose:** System update management

```
- check_for_updates
- download_update
- install_update
- get_update_status
- (and more)
```

**Target Location:** `websocket/commands/admin/updates.js`  
**Status:** Move

---

## CONSOLIDATION MAPPING

### Summary Table

| Current File | Files to Merge | Target Location | Commands | Consolidation |
|---|---|---|---|---|
| evidence-commands.js | packaging, correlation | forensic/evidence.js | 31 | 3→1 |
| legal-compliance-commands.js | phase2-p0 | forensic/legal-compliance.js | 6 | 2→1 |
| network-forensics-commands.js | — | forensic/network-forensics.js | 26 | 1→1 |
| session-tracking-commands.js | — | forensic/session-tracking.js | 3 | 1→1 |
| screenshot-commands.js | dom-snapshot | forensic/screenshots.js | 22 | 2→1 |
| javascript-console-extraction.js | html-capture | forensic/extraction.js | 16 | 2→1 |
| video-recording-commands.js | recording | forensic/recordings.js | 34 | 2→1 |
| report-generation.js | — | forensic/reports.js | 0 | 1→1 |
| evasion-commands.js | extended-evasion | evasion/fingerprinting.js | 35 | 2→1 |
| anonymity-commands.js | — | evasion/anonymity.js | 11 | 1→1 |
| fake-data-commands.js | location, tech-detection | evasion/detection-bypass.js | 27 | 3→1 |
| coherence-check.js | coherence-validation | evasion/coherence.js | 19 | 2→1 |
| behavioral-anonymization.js | behavior-scoring | evasion/behavioral.js | 10 | 2→1 |
| competitor-monitoring.js | — | monitoring/competitor.js | 23 | 1→1 |
| monitoring-commands.js | advanced, continuous, metrics, performance | monitoring/metrics.js | 70 | 5→1 |
| change-detection.js | — | monitoring/change-detection.js | 9 | 1→1 |
| analytics-advanced.js | — | monitoring/analytics.js | 11 | 1→1 |
| screenshot-commands.js (copy) | image | browser/screenshots.js | 27 | 2→1 |
| extraction-commands.js | extended-features | browser/extraction.js | 33 | 2→1 |
| form-commands.js | — | browser/form-automation.js | 10 | 1→1 |
| session-management.js | multi-page, persistence v1-3, week2 | browser/session-management.js | 79 | 6→1 |
| profile-template.js | proxy-partner | browser/profiles.js | 27 | 2→1 |
| cookie-commands.js | credentials | browser/cookies.js | 22 | 2→1 |
| export-formats.js | — | export/formats.js | 8 | 1→1 |
| export-templates.js | — | export/templates.js | 13 | 1→1 |
| encrypted-export.js | — | export/encryption.js | 8 | 1→1 |
| batch-operations.js | correlation | export/batch.js | 21 | 2→1 |
| dashboard-commands.js | — | admin/dashboard.js | 18 | 1→1 |
| slack-commands.js | slack-routing | admin/notifications.js | 18 | 2→1 |
| updater.js | — | admin/updates.js | 10 | 1→1 |

### Consolidation Statistics

| Metric | Value |
|---|---|
| Current Files | 56 |
| Target Files | 29 |
| Reduction | 48% |
| Forensic Files | 14 → 8 |
| Evasion Files | 10 → 5 |
| Monitoring Files | 8 → 4 |
| Browser Files | 15 → 6 |
| Export Files | 5 → 4 |
| Admin Files | 4 → 3 |
| Total Current Commands | ~622 |
| Commands Lost | 0 |
| Code Duplication | 1 file (screenshot, intentional) |

---

## Notes

### Forensic Module
- **14 files → 8 modules** (consolidated from 56 original files)
- ~140 commands focused on legal compliance and evidence capture
- Includes chain-of-custody, timestamp verification, hash validation
- All commands designed for legal admissibility

### Evasion Module
- **10 files → 5 modules**
- ~100 commands for bot detection evasion
- Clearly separated from forensic capabilities
- Fingerprinting, behavioral anonymization, detection service evasion

### Monitoring Module
- **8 files → 4 modules**
- ~120 commands for competitive intelligence
- NOT forensic in nature
- Change detection, analytics, performance metrics

### Browser Module
- **15 files → 6 modules**
- ~175 commands for core browser automation
- Session management, form filling, screenshots
- General-purpose automation

### Export Module
- **5 files → 4 modules**
- ~50 commands for data export/import
- Format conversion, encryption, batch operations

### Admin Module
- **4 files → 3 modules**
- ~35 commands for system admin
- Dashboard, notifications, updates

---

## Migration Checklist

- [ ] Create forensic/ directory
- [ ] Create evasion/ directory
- [ ] Create monitoring/ directory
- [ ] Create browser/ directory
- [ ] Create export/ directory
- [ ] Create admin/ directory
- [ ] Consolidate forensic commands
- [ ] Consolidate evasion commands
- [ ] Consolidate monitoring commands
- [ ] Consolidate browser commands
- [ ] Consolidate export commands
- [ ] Consolidate admin commands
- [ ] Update websocket/server.js imports
- [ ] Create module index.js files
- [ ] Create module README.md files
- [ ] Update API documentation
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Verify backward compatibility
- [ ] Deploy and monitor

