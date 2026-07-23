# Graph Report - savant-sanctum  (2026-07-22)

## Corpus Check
- 42 files · ~49,615 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 490 nodes · 755 edges · 30 communities (28 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `32ee5e61`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 30|Community 30]]

## God Nodes (most connected - your core abstractions)
1. `Sanctum Roadmap PRD` - 21 edges
2. `compilerOptions` - 18 edges
3. `Sanctum Style Guide` - 18 edges
4. `Session` - 15 edges
5. `Workspace` - 13 edges
6. `buildWorkspaceAthenaPrompt()` - 13 edges
7. `16. Visual Examples` - 13 edges
8. `buildSavantHeaders()` - 12 edges
9. `8. Feature Inventory` - 12 edges
10. `scripts` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AppOverlays()` --calls--> `getSessionAdapter()`  [EXTRACTED]
  src/renderer/components/AppOverlays.tsx → src/renderer/services/sessionAdapters.ts
- `AppOverlays()` --calls--> `inferSessionProvider()`  [EXTRACTED]
  src/renderer/components/AppOverlays.tsx → src/renderer/services/sessionAdapters.ts
- `App()` --calls--> `getSessionAdapter()`  [EXTRACTED]
  src/renderer/App.tsx → src/renderer/services/sessionAdapters.ts
- `App()` --calls--> `inferSessionProvider()`  [EXTRACTED]
  src/renderer/App.tsx → src/renderer/services/sessionAdapters.ts
- `AppOverlays()` --calls--> `isTaskBlocked()`  [EXTRACTED]
  src/renderer/components/AppOverlays.tsx → src/renderer/lib/taskBoard.ts

## Import Cycles
- None detected.

## Communities (30 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (31): LoginScreen(), LoginScreenProps, SessionConversation(), SessionConversationProps, WorkspaceAthenaDrawer(), WorkspaceAthenaDrawerProps, WorkspaceHeader(), WorkspaceHeaderProps (+23 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (14): 13. User Experience Requirements, 14. Technical Requirements, 15. Performance Requirements, 16. Quality Requirements, 17. Risks, 18. Open Questions, 19. Acceptance Criteria, 1. Product Summary (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (40): 10. Motion, 11. Sanctum-Specific Product Framing, 12. Implementation Notes, 13. What Sanctum Should Not Look Like, 14. Reference Alignment, 15. Design Checklist, 1. Design Direction, 2. App Shell (+32 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (40): author, dependencies, better-sqlite3, d3, lucide-react, @radix-ui/react-tooltip, react, react-dom (+32 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (32): AGY_DIR, CLAUDE_DIR, CODEX_DIR, CODEX_HISTORY_PATH, CODEX_LOGS_PATH, codexEventToMessage(), COPILOT_DIR, COPILOT_SESSION_DB_PATH (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (23): DetailBlock(), DetailRow(), IntelligencePulse(), KnowledgeNetwork(), Metric(), Row(), StatusOrb(), ActivityItem (+15 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (24): App(), adapterRegistry, buildSessionTree(), cleanPath(), formatSessionUpdated(), getConversationItems(), getSessionAdapter(), inferProviderFromFiles() (+16 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (21): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (11): scripts, build, build:electron, build:renderer, dev, dev:electron, dev:renderer, preview (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.20
Nodes (10): build, appId, dmg, files, mac, productName, publish, icon (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.19
Nodes (9): formatDateLabel(), getEarliestTimestamp(), getLatestTimestamp(), WorkspaceActivitySummary, WorkspaceNote, WorkspaceOverview(), WorkspaceOverviewProps, WorkspaceSummary (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (13): 16.10 Dense List Example, 16.11 Modal Example, 16.12 What Good Looks Like, 16.1 Global Shell, 16.2 Top Header Example, 16.3 Left Rail Example, 16.4 Right Rail Example, 16.5 Workspace Detail Example (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (12): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (15): artifacts, LocalSetupItem, navigation, notes, providers, reminders, SectionId, SectionProfile (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (12): 8.10 Terminal and Local Execution, 8.11 Knowledge and Analysis, 8.1 Core Work Management, 8.2 Session Experience, 8.3 Workspace Experience, 8.4 Provider and Session Adapter System, 8.5 API Surface, 8.6 MCP Surface (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (43): ActivityItem, AppOverlays(), AppOverlaysProps, EntityEditorState, WorkspaceJiraTicket, WorkspaceMergeRequest, ConnectionStatus, FALLBACK_PROVIDERS (+35 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (10): BottomBar(), STATUS_COLORS, StatusDot, ActivityItem, NavItem, ShellChrome(), ShellChromeProps, ToastLike (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (7): 10. Phase Plan, Phase 0: Discovery and Contract Freeze, Phase 1: App Scaffold, Phase 2: Core Domain, Phase 3: Integration Surfaces, Phase 4: Deep Session Features, Phase 5: Knowledge and Power Features

### Community 19 - "Community 19"
Cohesion: 0.40
Nodes (5): buildWorkspaceEditorPayload(), createWorkspaceEditorDraft(), createWorkspaceEditorDraftFromWorkspace(), WorkspaceEditorDraft, WorkspaceEditorMode

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (17): ATHENA_SYSTEM_DIRECTIVE, AthenaKnowledgeEdge, AthenaKnowledgeNode, buildAthenaPromptSections(), fetchGatewayMCPs(), formatGatewayMCPs(), formatWorkspaceKnowledgeGraph(), buildWorkspaceAthenaPrompt() (+9 more)

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (6): 11.1 Workspace Roadmap, 11.2 Session Roadmap, 11.3 Task and Reminder Roadmap, 11.4 Integration Roadmap, 11.5 Local Setup Roadmap, 11. Detailed Roadmap

### Community 22 - "Community 22"
Cohesion: 0.60
Nodes (3): normalizeServerWorkspace(), numericCount(), ServerWorkspace

### Community 23 - "Community 23"
Cohesion: 0.50
Nodes (4): 12.1 Reuse, 12.2 Rebuild, 12.3 Drop or Defer, 12. Migration Strategy

### Community 26 - "Community 26"
Cohesion: 0.50
Nodes (4): 5.1 Primary Entities, 5.2 Session-Attached Entities, 5.3 Support Entities, 5. Core Domain Model

### Community 27 - "Community 27"
Cohesion: 0.50
Nodes (4): 6.1 Ownership and Scope, 6.2 Key Relationships, 6.3 Source of Truth, 6. Relationship Model

### Community 28 - "Community 28"
Cohesion: 0.50
Nodes (4): 7.1 Layers, 7.2 Interaction Paths, 7.3 Architectural Constraint, 7. System Architecture

## Knowledge Gaps
- **279 isolated node(s):** `__filename`, `__dirname`, `SAVANT_DIR`, `SANCTUM_DB_PATH`, `SANCTUM_SETTINGS_PATH` (+274 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Sanctum Roadmap PRD` connect `Community 1` to `Community 15`, `Community 18`, `Community 21`, `Community 23`, `Community 26`, `Community 27`, `Community 28`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `Sanctum Style Guide` connect `Community 2` to `Community 11`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `Session` connect `Community 0` to `Community 5`, `Community 6`, `Community 10`, `Community 14`, `Community 16`, `Community 17`, `Community 20`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `__filename`, `__dirname`, `SAVANT_DIR` to the rest of the system?**
  _279 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07751937984496124 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._