# FAA Document Sources - Download Links

> Researched 2026-02-11. All documents current as of January 2026.

## Priority Downloads (Core ATC Documents)

### 1. JO 7110.65BB - Air Traffic Control

The ATC "bible" - prescribes all ATC procedures and phraseology.

| Version | URL |
|---------|-----|
| **Consolidated (Basic + Changes 1 & 2)** | https://www.faa.gov/documentLibrary/media/Order/7110.65BB_Bsc_w_Chg_1_and_2_dtd_1-22-26_Final.pdf |
| Basic only | https://www.faa.gov/documentLibrary/media/Order/7110.65BB_Basic_dtd_2-20-25.pdf |
| Change 1 only | https://www.faa.gov/documentLibrary/media/Order/7110.65BB_Chg_1_dtd_8-7-25.pdf |
| Change 2 only | https://www.faa.gov/documentLibrary/media/Order/7110.65BB_Chg_2_dtd_1-22-26.pdf |
| HTML version | https://www.faa.gov/air_traffic/publications/atpubs/atc_html/ |

**Download to:** `manuals/orders/`
**Est. size:** 15-25 MB

### 2. Aeronautical Information Manual (AIM)

Bridge document between pilots and controllers. Covers all aspects of flight operations.

| Version | URL |
|---------|-----|
| **Consolidated (Basic + Changes 1 & 2)** | https://www.faa.gov/air_traffic/publications/media/AIM_Basic_w_Chg_1_and_2_dtd_1-22-26.pdf |
| Change 1 only | https://www.faa.gov/air_traffic/publications/media/AIM_Chg_1_dtd_8-7-25_FINAL.pdf |
| Change 2 only | https://www.faa.gov/air_traffic/publications/media/AIM_Chg2_dtd_1-22-26.pdf |
| HTML version | https://www.faa.gov/air_traffic/publications/atpubs/aim_html/index.html |

**Download to:** `manuals/aeronautical_publications/`
**Est. size:** 15-30 MB

### 3. Pilot/Controller Glossary (PCG)

Authoritative definitions for aviation terminology.

| Version | URL |
|---------|-----|
| **Consolidated (Basic + Changes 1 & 2)** | https://www.faa.gov/air_traffic/publications/media/PCG_Bsc_w_Chg_1_and_2_dtd_1-22-26.pdf |
| Basic only | https://www.faa.gov/air_traffic/publications/media/PCG_Bsc_dtd_2-20-25_POST.pdf |
| Change 1 only | https://www.faa.gov/air_traffic/publications/media/PCG_Chg_1_dtd_8-7-25.pdf |
| Change 2 only | https://www.faa.gov/air_traffic/publications/media/PCG_Chg_2_dtd_1-22-26.pdf |
| HTML version | https://www.faa.gov/air_traffic/publications/atpubs/pcg_html/index.html |

**Download to:** `manuals/aeronautical_publications/`
**Est. size:** 1-3 MB

### 4. JO 7210.3EE - Facility Operation and Administration

Guidance for operating and managing ATC facilities.

| Version | URL |
|---------|-----|
| **Consolidated (Basic + Changes 1 & 2)** | https://www.faa.gov/documentLibrary/media/Order/7210.3EE_Bsc_w_Chg_1_and_2_dtd_1-22-26_Final.pdf |
| Basic only | https://www.faa.gov/documentLibrary/media/Order/7210.3EE_Basic_dtd_2-20-25.pdf |
| Change 1 only | https://www.faa.gov/documentLibrary/media/Order/2025-06-02_7210.3EE_Chg_1_dtd_8-7-25.pdf |
| Change 2 only | https://www.faa.gov/documentLibrary/media/Order/7210.3EE_Chg_2_dtd_1-22-26_Final.pdf |
| HTML version | https://www.faa.gov/air_traffic/publications/atpubs/foa_html/ |

**Download to:** `manuals/orders/`
**Est. size:** 10-20 MB

## Quick Download Commands

Download all 4 consolidated PDFs:

```bash
cd /home/devel/exudeai/rag-atc-testing

# JO 7110.65BB (ATC procedures)
curl -L -o manuals/orders/JO_7110.65BB_consolidated.pdf \
  "https://www.faa.gov/documentLibrary/media/Order/7110.65BB_Bsc_w_Chg_1_and_2_dtd_1-22-26_Final.pdf"

# AIM (Aeronautical Information Manual)
curl -L -o manuals/aeronautical_publications/AIM_consolidated.pdf \
  "https://www.faa.gov/air_traffic/publications/media/AIM_Basic_w_Chg_1_and_2_dtd_1-22-26.pdf"

# PCG (Pilot/Controller Glossary)
curl -L -o manuals/aeronautical_publications/PCG_consolidated.pdf \
  "https://www.faa.gov/air_traffic/publications/media/PCG_Bsc_w_Chg_1_and_2_dtd_1-22-26.pdf"

# JO 7210.3EE (Facility Operations)
curl -L -o manuals/orders/JO_7210.3EE_consolidated.pdf \
  "https://www.faa.gov/documentLibrary/media/Order/7210.3EE_Bsc_w_Chg_1_and_2_dtd_1-22-26_Final.pdf"
```

## Additional Documents (Future)

| Document | Category | Where to find |
|----------|----------|---------------|
| JO 7110.10 (Flight Services) | orders/ | https://www.faa.gov/regulations_policies/orders_notices/ |
| JO 7610.4 (Special Operations) | orders/ | https://www.faa.gov/regulations_policies/orders_notices/ |
| JO 7930.2 (NOTAMs) | orders/ | https://www.faa.gov/regulations_policies/orders_notices/ |
| JO 7340.2 (Contractions) | orders/ | https://www.faa.gov/regulations_policies/orders_notices/ |
| 14 CFR Part 91 | regulations/ | https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91 |
| 14 CFR Part 71 | regulations/ | https://www.ecfr.gov/current/title-14/chapter-I/subchapter-E/part-71 |
| Advisory Circulars (AC 90 series) | advisory_circulars/ | https://www.faa.gov/regulations_policies/advisory_circulars/ |
| SAFOs | safety_alerts/ | https://www.faa.gov/other_visit/aviation_industry/airline_operators/airline_safety/safo/all_safos |

## Update Cycle

All four core documents follow the same change cycle:
- **Basic edition:** February 20, 2025
- **Change 1:** August 7, 2025
- **Change 2:** January 22, 2026

When new changes are published, download the latest consolidated PDF and re-ingest.

## Main Hub

All FAA Air Traffic publications: https://www.faa.gov/air_traffic/publications/
