# ARIS Architecture Draft

> This is a working draft from initial architecture discussions. Not final documentation.

## Overview

ARIS is an AI-powered personal assistant. The core aggregates data from various sources and compiles a feed of contextually relevant items - similar to Google Now. The feed shows users useful information based on their current context (date, time, location).

Examples of feed items:

- Upcoming calendar events
- Nearby locations
- Current weather
- Alerts

## Design Principles

1. **Extensibility**: The core must support different data sources, including third-party sources.
2. **Separation of concerns**: Core handles data only. UI rendering is a separate system.
3. **Parallel execution**: Sources run in parallel; no inter-source dependencies.
4. **Graceful degradation**: Failed sources are skipped; partial results are returned.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  aris-core  │    │   Sources   │    │  UI Registry    │  │
│  │             │    │  (plugins)  │    │  (schemas from  │  │
│  │ - Reconciler│◄───│ - Calendar  │    │   third parties)│  │
│  │ - Context   │    │ - Weather   │    │                 │  │
│  │ - FeedItem  │    │ - Spotify   │    │                 │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│         │                                      │             │
│         ▼                                      ▼             │
│    Feed (data only)                    UI Schemas (JSON)     │
└─────────────────────────────────────────────────────────────┘
                    │                           │
                    ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Renderer                                             │   │
│  │  - Receives feed items                                │   │
│  │  - Fetches UI schema by item type                     │   │
│  │  - Renders using json-render or similar               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Package (`aris-core`)

The core is responsible for:

- Defining the context and feed item interfaces
- Providing a reconciler that orchestrates data sources
- Returning a flat list of prioritized feed items

### Key Concepts

- **Context**: Time and location (with accuracy) passed to all sources
- **FeedItem**: Has an ID (source-generated, stable), type, priority, timestamp, and JSON-serializable data
- **DataSource**: Interface that third parties implement to provide feed items
- **Reconciler**: Orchestrates sources, runs them in parallel, returns items and any errors

## Data Sources

Key decisions:

- Sources receive the full context and decide internally what to use
- Each source returns a single item type (e.g., separate "Calendar Source" and "Location Suggestion Source" rather than a combined "Google Source")
- Sources live in separate packages, not in the core
- Sources are responsible for:
  - Transforming their domain data into feed items
  - Assigning priority based on domain logic (e.g., "event starting in 10 minutes" = high priority)
  - Returning empty arrays when nothing is relevant

### Configuration

Configuration is passed at source registration time, not per reconcile call. Sources can use config for filtering/limiting (e.g., "max 3 calendar events").

## Feed Output

- Flat list of `FeedItem` objects
- No UI information (no icons, card types, etc.)
- Items are a discriminated union by `type` field
- Reconciler sorts by priority; can act as tiebreaker

## UI Rendering (Separate from Core)

The core does not handle UI. For extensible third-party UI:

1. Third-party apps register their UI schemas through the backend (UI Registry)
2. Frontend fetches UI schemas from the backend
3. Frontend matches feed items to schemas by `type` and renders accordingly

This approach:

- Keeps the core focused on data
- Works across platforms (web, React Native)
- Avoids the need for third parties to inject code into the app
- Uses a json-render style approach for declarative UI from JSON schemas

Reference: https://github.com/vercel-labs/json-render

## Open Questions

- Exact schema format for UI registry
- How third parties authenticate/register their sources and UI schemas
