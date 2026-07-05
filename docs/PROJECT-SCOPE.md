# Basset Hound Browser - Project Scope (Forensic Focus)

**Version:** 2.0  
**Last Updated:** June 20, 2026  
**Status:** Production-Ready  
**Focus:** Forensic data extraction, evidence capture, and bot evasion

## Core Mission
Basset Hound Browser is a **forensic data collection and evidence capture tool**—a specialized browser designed for legitimate investigations, security research, and forensic analysis. The browser provides unrestricted access to web page content, metadata, network traffic, and execution context, enabling comprehensive evidence collection with cryptographic integrity verification.

**Core Mission:** Provide forensic-grade evidence capture capabilities through a WebSocket API, enabling external agents and automation systems to collect, analyze, and preserve web-based evidence.

## Primary Purpose
This browser provides a foundation for:
- **Forensic-grade evidence extraction** from websites with SHA-256 integrity verification
- **Complete data capture** (HTML, DOM, JavaScript, CSS, network, storage, metadata) without filtering
- **Chain-of-custody documentation** with timestamps and audit trails for legal compliance
- **Bot detection evasion** for accessing sites that block legitimate investigation tools
- **Content modification & injection** for forensic testing and page analysis

## Core Forensic Principles

### 1. Forensic-Grade Evidence Capture
- **Integrity:** All captures include SHA-256 hashing for proof of authenticity
- **Completeness:** Extract 100% of page data without filtering or modification
- **Preservation:** Maintain original encoding, metadata, and timestamps
- **Auditability:** Complete chain-of-custody logging for all operations
- **Reproducibility:** Identical captures produce identical hashes for legal admissibility

### 2. Unrestricted Research Access
- The browser is a **forensic/research tool**, not a security-hardened application
- Users have complete access to page content, DOM, storage, and network traffic
- No content filtering, sanitization, or security restrictions
- Designed for legitimate investigations by trained analysts
- All capabilities exist to support valid forensic purposes

### 3. External Intelligence Layer
- **Browser role:** Capture raw, unprocessed forensic data
- **Agent role:** Analyze data and make intelligence decisions
- The browser is a **DATA COLLECTION TOOL**, not an intelligent system
- External agents use captured data for analysis, pattern detection, correlation
- Separation of concerns keeps browser focused on what it does best

### 4. API-First Forensic Architecture
Basset Hound Browser is built as a **language-agnostic WebSocket API**, deployed in standardized Docker containers. This architecture prioritizes:
- **Stateless Operations:** Each forensic extraction is independent
- **Language Independence:** Users integrate in their preferred tech stack
- **Auto-Generated Documentation:** Clear, maintainable API specs
- **Concurrent Support:** Handle multiple simultaneous forensic investigations
- **Platform Agnostic:** Runs anywhere Docker is available

### What This Is NOT (And Why)
- **Not an SDK Library:** No SDK maintenance burden (Python SDKs, JavaScript client libraries, etc.)
- **Not a Cloud Service:** Users deploy and manage their own containers
- **Not a Production Browser:** Not designed for end-user web browsing
- **Not a Content Filter:** No built-in protection from malicious content
- **Not a Safety System:** No automatic safeguards or security boundaries

## Design Philosophy

### What This Is
- A tool for researchers, developers, and analysts to extract and analyze web content
- A platform for understanding website behavior and structure at all levels
- A system that prioritizes user agency and data access over restrictions
- An API that provides raw capabilities without imposed limitations
- A Docker-native system designed for integration with external tooling

### What This Is NOT
- A production web browser for end users
- A system designed to protect users from malicious content
- A tool to prevent user mistakes or enforce security boundaries
- A system with content filtering or access restrictions
- A managed SDK ecosystem (users write scripts in their language of choice)

## Key Principles

### 1. **Raw Data Access**
- Users receive unfiltered, complete data from every request
- No automatic sanitization or filtering of content
- Full visibility into network traffic, headers, and responses
- Direct access to all extracted information

### 2. **User Control**
- Users control exactly what data they extract via API commands
- Users decide how to interpret and use extracted content
- Users can inject content, modify pages, and interact at the lowest level
- No implicit constraints on what users can do with the browser

### 3. **Research-First Architecture**
- All features are designed to maximize information access
- Forensic capabilities take priority over user safety features
- Network inspection and logging are core features, not afterthoughts
- Advanced capabilities (fingerprinting, evasion, proxy integration) exist to expand research options

### 4. **Transparency**
- Users have visibility into all browser operations
- Network requests, responses, and modifications are fully exposed
- Browser state and configuration are always accessible
- No hidden processing or background decision-making

## Capabilities (164 WebSocket Commands)

### Navigation & Interaction
- Full page navigation control
- Click, type, fill, and scroll operations
- Form submission and element interaction
- Custom JavaScript execution

### Data Extraction
- Complete HTML and text extraction
- Image and media capture
- Metadata and structured data extraction
- Network request/response logging
- Cookie and local storage access

### Content Modification
- Custom header injection
- Request blocking and modification
- JavaScript injection and execution
- DOM manipulation and CSS modification
- Cookie and storage manipulation

### Research & Forensics
- Complete screenshot capture (page, element, full-page)
- Network request interception and inspection
- DevTools access for deep inspection
- Proxy integration for network control
- User-Agent rotation and fingerprint spoofing
- Bot detection evasion (behavioral, fingerprint, honeypot detection)

### Infrastructure
- Isolated browser profiles for parallel work
- Proxy support (HTTP/HTTPS/SOCKS4/5/Tor)
- Session persistence and recovery
- Resource usage monitoring
- Concurrent operation support

## Data Handling Philosophy

### Collected Data
- All extracted data belongs to the user
- Raw data format is preserved without interpretation
- Users have full access to forensic evidence
- No filtering or modification of findings

### User Responsibility
- Users are responsible for lawful use of extraction capabilities
- Users decide which sites to target and what data to collect
- Users control interpretation and analysis of results
- Browser provides tools; users determine application

## Security Boundaries

### What is NOT Enforced
- Content filtering or blocking (except what user explicitly configures)
- User access restrictions or parental controls
- Malicious content detection or warnings
- Automatic safety mechanisms or rate limiting (except network-level)
- Privacy protections or tracking prevention (except user-configured proxies)

### What IS Provided
- Complete visibility and control for informed decision-making
- Network proxy support for traffic inspection and routing
- Request/response logging for forensic analysis
- Low-level browser capabilities for technical investigation

## Intended Users
- Security researchers analyzing website security
- Web forensics professionals conducting investigations
- Web developers testing site behavior and interaction
- Data analysts extracting structured information
- Competitive researchers analyzing competitor sites
- Developers building custom browser automation workflows

## Success Criteria
- Complete, unfiltered data access achieved
- All forensic investigation capabilities available
- Users have maximal control and transparency
- Performance and reliability under research workloads
- Integration with external analysis and automation systems

## What We Don't Do

### SDK Maintenance (Discontinued)
We do NOT maintain, develop, or support:
- **Python SDKs or clients** - Users write Python scripts using the WebSocket API
- **JavaScript/Node.js client libraries** - Users write JS/Node scripts directly against the API
- **Language-specific wrappers** - No Go, Java, Ruby, PHP, or other language SDKs
- **SDK documentation** - Auto-generated API docs replace SDK docs

**Rationale:** API-first architecture with auto-generated documentation allows users to write integration scripts in their language of choice, without the maintenance burden of managing SDKs across multiple languages.

### API-First Principles
We focus on:
- **High-Quality WebSocket API** with clear command semantics
- **Auto-Generated API Documentation** (OpenAPI/Swagger)
- **Example Scripts** in multiple languages for common integration patterns
- **Clear Error Messages** for API calls
- **Stable, Versioned Endpoints** for backward compatibility

Users implement their own clients using:
- Standard WebSocket libraries (available in every language)
- Auto-generated API reference documentation
- Community-contributed example scripts

### What This Means for Integration
- **User Responsibility:** Developers integrate the browser using their preferred language/framework
- **Language Agnostic:** Any language with WebSocket support can integrate
- **Documentation Over Code:** Clear API specs + examples > maintained SDKs
- **Faster Innovation:** API improvements don't require SDK updates
- **Lower Maintenance:** No SDK versioning, compatibility, or release management

## Examples Policy

### Core Principle
**Examples are curated, high-quality reference material—not auto-generated artifacts.**

Examples exist to help users understand common integration patterns and API usage. They are NOT automatically updated with every feature release or API change.

### Examples Are Updated Only When
- ✅ Explicit human or operator approval is given
- ✅ A feature warrants a new example (major new capability)
- ✅ An example has a documented bug or security issue
- ✅ An example's pattern is no longer supported (breaking API change)

### Examples Are NOT Updated
- ❌ Automatically on every feature addition
- ❌ To maintain "perfect" consistency with latest API state
- ❌ To chase feature additions in real time
- ❌ To provide examples for every possible API combination
- ❌ Without explicit human review and approval

### Rationale
- **Quality Over Currency:** Curated examples provide better learning material than auto-generated samples
- **Maintenance Cost:** Auto-update cycles create endless churn with minimal user benefit
- **Intentional Focus:** Only important patterns get examples; users read the API reference for edge cases
- **Documentation Clarity:** Examples reflect stable, well-tested patterns, not cutting-edge feature combinations
- **Reviewer Accountability:** Human approval ensures examples match actual best practices

### Implementation
- Examples live in `examples/` directory (tracked in git)
- Generated artifacts (screenshots, test outputs) are in `.claude/`, `blocking-data/`, `backups/` (not tracked)
- Example updates require:
  1. Code change in source files
  2. Example update proposal
  3. Explicit human approval
  4. Git commit documenting the change

## Data Organization & Generated Files

### Repository Structure Enforcement

This project maintains strict data organization to keep the repository clean and focused on source code:

**Root Directory - ALLOWED FILES ONLY:**
```
/home/devel/basset-hound-browser/
├── package.json                  ✅ KEEP
├── package-lock.json             ✅ KEEP
├── README.md                      ✅ KEEP
├── .gitignore                     ✅ KEEP
├── .dockerignore                  ✅ KEEP
├── Makefile                       ✅ KEEP (if applicable)
└── [NOTHING ELSE]                 ❌ NEVER IN ROOT
```

### Generated Data Categories & Locations

All generated files, reports, and temporary data MUST go to `./tmp/` or appropriate subdirectories. The rule is simple: **If you created it during development (not part of source code), it goes to tmp/ or a designated archive location.**

**Category Mapping:**

| Data Type | Location | Examples |
|-----------|----------|----------|
| **Test Results & Reports** | `tmp/test-results/` | test output, coverage reports, timing data |
| **Performance Reports** | `tmp/reports/` | load test results, benchmarks, metrics |
| **Screenshots & Captures** | `tmp/screenshots/` | test screenshots, UI captures, evidence captures |
| **Logs** | `tmp/logs/` | debug logs, runtime logs, execution traces |
| **Build Artifacts** | `tmp/build/` | compiled output, temporary builds, caches |
| **Temporary Data** | `tmp/data/` | session files, temp databases, scratch files |
| **Documentation - Generated** | `docs/archive/generated/` | reports, summaries, historical records (tracked in git) |
| **Documentation - Source** | `docs/*/` | API docs, guides, security docs (tracked in git) |

### The Rule

**NEVER put generated data in root directory or commit it to git.** Use this checklist:

1. **Before finalizing work:**
   ```bash
   find . -maxdepth 1 -type f \( -name "*.md" ! -name "README.md" -o -name "*.txt" -o -name "*.json" ! -name "package.json" ! -name "package-lock.json" \)
   ```
   If this returns ANY files, move them immediately.

2. **Generated files** → `tmp/[category]/`
3. **Handoff documentation** → `docs/handoffs/` (if historical value for future developers)
4. **Archive documentation** → `docs/archive/generated/` (only if needed for reference)

### Why This Matters

- **Repository Signal:** Developers see source code, not build artifacts
- **Git Cleanliness:** Prevents accidentally committing temporary data
- **Integration Clean:** External systems pull from root, not from noise
- **CI/CD Safety:** Temporary files don't interfere with deployments
- **.gitignore Enforcement:** Clear patterns protect against accidents

### Implementation in .gitignore

```
# Root-level generated files (MUST BE IN tmp/ or docs/archive/)
# Do NOT commit .md or .txt reports to root
# Use: tmp/test-results/, tmp/reports/, tmp/logs/, etc.

# Temporary files and directories
/tmp/**/*
!/tmp/
!/tmp/.gitkeep
```

## Future Development Direction
All future enhancements should prioritize:
1. Expanded data extraction capabilities
2. Greater transparency and user visibility
3. More research and forensics features
4. Improved integration with analysis tools
5. Support for new investigation scenarios
6. API quality and auto-generated documentation improvements
7. Multi-language example scripts for common integration patterns

---

**Version:** 2.1  
**Last Updated:** June 21, 2026  
**Status:** Current Project Scope Definition - API-First Architecture + Data Organization Enforcement
