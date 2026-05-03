# Roadmap

This document outlines the strategic directions and major technical milestones for the project.

## M1: Engine Expansion and Player Capabilities
- Consolidate all the v2 engine refactors.
- Refine player trait parsing in the newly expanded attribute scope.
- Investigate and calibrate engine tuning parameters for tactical setups.

## M2: Squad and Data Management UI
- **Phase 1: Basic Admin Pages** 
  Establish `/admin` layouts with basic viewing properties for clubs, dataset versions, etc.
- **Phase 2: Squad Manager Integration** 
  Create `/admin/squad-manager` providing classic BBC Sport-inspired UX for squads, transfers, and player editing.
- **Phase 3: AI-Assisted Verification (Data Veracity)**
  Implement a server-side AI assistant backing the Squad Manager.
  - **Football-data.org API Ingestion**: Fetch real-world squad structures via `http://api.football-data.org/v4/teams/{id}`, keeping strict rate limiting protocols (Free-tier constraint: 10 calls/minute) to act as the primary baseline matrix. (See saved reference under `docs/football-data-api-docs/`).
  - **Gemini Contextualization**: Feed the fetched Football-Data array alongside our local DB state into Gemini 2.5. Rather than relying on generic web-searches, Gemini will intelligently reconcile the two structures—identifying mistyped attributes, recognizing identical players with variable namings (e.g., "Alexander-Arnold" vs "Trent Alexander-Arnold"), providing delta discrepancy reports, and estimating physical stats not provided by the raw API response.

## M3: Live Gameplay Experiences
- Expand the 2D Visualizer into a fully independent reactive replay ecosystem.
- Implement mid-game Player adjustments ("Diving", etc.) as flagged in the Backlog.
