# Forensic Commands Index

This directory contains all forensic and evidence-related commands for Basset Hound Browser.

## Directory Structure

- **evidence/** - Evidence collection and management commands (29 total)
  - evidence-commands.js - Core evidence capture and retrieval
  - evidence-correlation-commands.js - Evidence linking and relationship analysis

- **legal/** - Legal compliance and chain of custody commands (101 total)
  - legal-compliance-commands.js - Compliance tracking and SWGDE reporting (75 commands)
  - phase2-p0-legal-compliance-commands.js - Phase 2 legal compliance extensions (26 commands)

- **network/** - Network forensics commands (12 total)
  - network-forensics-commands.js - Network traffic analysis and forensic extraction

- **correlation/** - Data correlation and analysis commands (26 total)
  - correlation-commands.js - Cross-evidence correlation and relationship mapping

- **packaging/** - Evidence packaging and export commands (44 total)
  - evidence-packaging.js - Evidence assembly, sealing, and export formatting

## Total Command Count

- **Evidence:** 29 commands
- **Legal & Compliance:** 101 commands
- **Network Forensics:** 12 commands
- **Correlation:** 26 commands
- **Packaging:** 44 commands
- **TOTAL: 212 forensic commands**

## Integration

All forensic commands are registered via the main WebSocket server at startup. Commands are accessible via the standard WebSocket API with standard error handling, logging, and monitoring.

## Reference

For command details, see `/docs/PHASE1-FORENSIC-COMMANDS-COMPLETION.md`
