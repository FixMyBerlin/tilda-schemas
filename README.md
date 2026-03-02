# TILDA Cycling Infra Schema

Schema documentation for TILDA data downloads. The current version is **March 2026**.

## Overview

Every TILDA data download is assigned to a specific schema version. The schema defines the exact set of properties, their types, and all permitted values — making it unambiguous how to interpret and work with the downloaded data.

## Schemas

All schemas are located in the [`schemas/`](schemas/) directory:

| File | Status | Description |
|------|--------|-------------|
| [CURRENT_SCHEMA.md](schemas/CURRENT_SCHEMA.md) | ✅ Current (March 2026) | The schema in active use for all current data downloads. |
| `PLANNED_SCHEMA.md` | 🔜 Planned | Upcoming schema changes for the next release. |

The machine readable version is [BikelanesSchema.schema.json](./BikelanesSchema.schema.json)

## Usage

When you receive a TILDA data download, check the accompanying schema version tag and refer to the corresponding schema file in this repository to understand the data structure.
