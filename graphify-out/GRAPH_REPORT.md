# Graph Report - savant-sanctum  (2026-07-04)

## Corpus Check
- 35 files · ~42,717 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 470 nodes · 664 edges · 26 communities (24 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `042d56b4`
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

## God Nodes (most connected - your core abstractions)
1. `Sanctum Roadmap PRD` - 21 edges
2. `compilerOptions` - 18 edges
3. `Sanctum Style Guide` - 18 edges
4. `Session` - 14 edges
5. `16. Visual Examples` - 13 edges
6. `8. Feature Inventory` - 12 edges
7. `compilerOptions` - 11 edges
8. `compilerOptions` - 11 edges
9. `scripts` - 9 edges
10. `Workspace` - 9 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `getSessionAdapter()`  [EXTRACTED]
  src/renderer/App.tsx → src/renderer/services/sessionAdapters.ts
- `App()` --calls--> `inferSessionProvider()`  [EXTRACTED]
  src/renderer/App.tsx → src/renderer/services/sessionAdapters.ts
- `AppOverlays()` --calls--> `getSessionAdapter()`  [EXTRACTED]
  src/renderer/components/AppOverlays.tsx → src/renderer/services/sessionAdapters.ts
- `AppOverlays()` --calls--> `inferSessionProvider()`  [EXTRACTED]
  src/renderer/components/AppOverlays.tsx → src/renderer/services/sessionAdapters.ts

## Import Cycles
- None detected.

## Communities (26 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (34): ActivityItem, AppOverlaysProps, EntityEditorState, WorkspaceJiraTicket, WorkspaceMergeRequest, SessionConversation(), SessionConversationProps, ChatMessage (+26 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (43): 10. Phase Plan, 11.1 Workspace Roadmap, 11.2 Session Roadmap, 11.3 Task and Reminder Roadmap, 11.4 Integration Roadmap, 11.5 Local Setup Roadmap, 11. Detailed Roadmap, 12.1 Reuse (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (40): 10. Motion, 11. Sanctum-Specific Product Framing, 12. Implementation Notes, 13. What Sanctum Should Not Look Like, 14. Reference Alignment, 15. Design Checklist, 1. Design Direction, 2. App Shell (+32 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (38): author, build, appId, dmg, files, mac, productName, dependencies (+30 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (28): AGY_DIR, CLAUDE_DIR, CODEX_DIR, CODEX_HISTORY_PATH, CODEX_LOGS_PATH, codexEventToMessage(), COPILOT_DIR, COPILOT_SESSION_DB_PATH (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (16): ActivityItem, ChatMessage, EntityFlags, providerRoutePrefix, SavedUiState, sectionIcons, ServerJiraTicket, ServerMergeRequest (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (25): AppOverlays(), App(), adapterRegistry, buildSessionTree(), cleanPath(), formatSessionUpdated(), getConversationItems(), getSessionAdapter() (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (21): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx (+13 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (17): devDependencies, concurrently, cross-env, electron, electron-builder, tailwindcss, @tailwindcss/vite, tw-animate-css (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.17
Nodes (15): artifacts, LocalSetupItem, navigation, notes, providers, reminders, SectionId, SectionProfile (+7 more)

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
Cohesion: 0.18
Nodes (10): WorkspaceHeader(), WorkspaceHeaderProps, SectionHero, SessionFileGroup, WorkspaceSurface(), WorkspaceSurfaceProps, apiSurface, localSetup (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (12): 8.10 Terminal and Local Execution, 8.11 Knowledge and Analysis, 8.1 Core Work Management, 8.2 Session Experience, 8.3 Workspace Experience, 8.4 Provider and Session Adapter System, 8.5 API Surface, 8.6 MCP Surface (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (10): ChatMessage, DOMAIN_HULL_COLORS, Edge, KNOWLEDGE_NODE_TYPES, KnowledgeGraph(), KnowledgeGraphProps, Node, NODE_TYPE_COLORS (+2 more)

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (8): BottomBar(), STATUS_COLORS, StatusDot, ActivityItem, NavItem, ShellChrome(), ShellChromeProps, ToastLike

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (9): ConnectionStatus, FALLBACK_PROVIDERS, normalizeUrl(), ServiceConfig, ServicePanel(), SettingsModal(), SettingsModalProps, TabId (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (7): DetailBlock(), DetailRow(), IntelligencePulse(), KnowledgeNetwork(), Metric(), Row(), StatusOrb()

### Community 20 - "Community 20"
Cohesion: 0.25
Nodes (6): ATHENA_SYSTEM_DIRECTIVE, AthenaKnowledgeEdge, AthenaKnowledgeNode, buildAthenaPromptSections(), fetchWorkspaceKnowledgeGraph(), formatWorkspaceKnowledgeGraph()

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (6): buildWorkspaceEditorPayload(), createWorkspaceEditorDraft(), createWorkspaceEditorDraftFromWorkspace(), WorkspaceEditorDraft, WorkspaceEditorMode, Workspace

### Community 22 - "Community 22"
Cohesion: 0.60
Nodes (4): getGatewayBaseUrl(), invokeRunAgent(), RunAgentPayload, runAgentViaGateway()

## Knowledge Gaps
- **272 isolated node(s):** `__filename`, `__dirname`, `SAVANT_DIR`, `SANCTUM_DB_PATH`, `CODEX_DIR` (+267 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Sanctum Roadmap PRD` connect `Community 1` to `Community 15`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `Sanctum Style Guide` connect `Community 2` to `Community 11`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `Session` connect `Community 0` to `Community 5`, `Community 6`, `Community 9`, `Community 10`, `Community 14`, `Community 17`, `Community 19`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `__filename`, `__dirname`, `SAVANT_DIR` to the rest of the system?**
  _272 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06711915535444947 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._