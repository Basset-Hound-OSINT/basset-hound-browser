# ATC Document Category Research

> Researched 2026-02-11. Informs the manuals/ folder structure.

## FAA Documentation Ecosystem

FAA documentation is organized by authority level and purpose. This hierarchy is reflected in the `manuals/` folder structure.

## Category Mapping

### 1. `manuals/orders/` - FAA Orders (JO Series)

Internal directives that prescribe procedures for FAA personnel. These are the operational manuals controllers use daily.

**Key documents:**
- **JO 7110.65** - Air Traffic Control (the "bible" - procedures and phraseology)
- **JO 7210.3** - Facility Operation and Administration
- **JO 7110.10** - Flight Services
- **JO 7610.4** - Special Operations
- **JO 7930.2** - Notices to Airmen (NOTAM procedures)
- **JO 7340.2** - Contractions
- **JO 7400.2** - Airspace Matters
- **JO 8260.3** - TERPS (instrument procedure design)

**RAG query examples:** "What is the correct procedure for...?" / "How should a controller handle...?"

### 2. `manuals/regulations/` - Federal Aviation Regulations (14 CFR)

Legally binding rules from the Code of Federal Regulations.

**Key parts:**
- **Part 71** - Airspace Designation
- **Part 73** - Special Use Airspace
- **Part 91** - General Operating and Flight Rules
- **Part 97** - Standard Instrument Procedures (TERPS)

**RAG query examples:** "Is the pilot legally required to...?" / "What are the regulatory minimums for...?"

### 3. `manuals/aeronautical_publications/` - Reference Publications

Shared reference documents for both pilots and controllers.

**Key documents:**
- **AIM** - Aeronautical Information Manual
- **Pilot/Controller Glossary (PCG)** - Official terminology definitions
- **Chart Supplements** - Airport/Facility Directory data
- **AIP** - Aeronautical Information Publication

**RAG query examples:** "What does the term X mean?" / "What information is published about airport Y?"

### 4. `manuals/advisory_circulars/` - Advisory Circulars (ACs)

Non-binding guidance on how to comply with regulations. Valuable for explaining rationale and acceptable methods.

**Key series:**
- **AC 90 series** - Air Traffic and General Operations
- **AC 120 series** - Air Carrier Operations
- **AC 150 series** - Airport-related

**RAG query examples:** "What is the recommended way to...?" / "How can we comply with regulation X?"

### 5. `manuals/safety_alerts/` - Safety Alerts & Notices

Time-sensitive, operationally critical information.

**Document types:**
- **SAFOs** - Safety Alerts for Operators (urgent safety info)
- **InFOs** - Information for Operators (lower-urgency operational info)
- **NOTAMs** - Notices to Airmen (airspace changes, facility outages)

**RAG query examples:** "Are there any current restrictions on...?" / "What safety concerns have been identified for...?"

### 6. `manuals/training_and_reference/` - Training & Handbooks

Training materials, handbooks, and facility-specific procedures.

**Document types:**
- Instrument Flying Handbook
- Pilot's Handbook of Aeronautical Knowledge
- Facility-specific SOPs
- ATC career field training materials

**RAG query examples:** "How do I learn about...?" / "What does the training manual say about...?"

## Design Rationale

This 6-category structure is optimized for RAG because:

1. **Authority hierarchy**: Regulations > Orders > Advisory Circulars > Alerts. Helps the LLM provide answers with appropriate authority context.
2. **Configurable ingestion**: Comment out categories in config.yaml to ingest only what you need.
3. **Update frequency**: Regulations change rarely, orders semi-annually, safety alerts frequently. Grouping by cadence simplifies document lifecycle.
4. **Query routing**: Different question types naturally map to different categories.
