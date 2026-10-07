# Portal Plugin Factory — Presentation & Demo Guide

> **ANSTRAT-2497 · Branch:** `anstrat-2497-poc` in `ansible-backstage-plugins`
> **Audience:** Self-service team, portal core team, ANSTRAT-1758 content team, stakeholders
> **Purpose:** Walk through everything built, how it works, and what is still open

---

## 0. Before You Present

### Files to have open in your IDE

- `plugins/portal-extension-api/src/` — the shared contract
- `plugins/portal-extension-host/src/` — the runtime host
- `plugins/portal-plugin-sdk/src/hooks/usePortalContext.ts` — freshest addition
- `plugins/self-service/src/selfServiceManifest.ts` — real usage of the contract
- `plugins/self-service/src/components/GitRepositories/GitRepositoriesPage.tsx` — first working extensible page

### What to run beforehand

```bash
cd ansible-backstage-plugins
yarn start   # frontend on :3000
```

Navigate to the Git Repositories page — you'll use it for the live demo.

### One-sentence version (use this to open)

> "We've built the plumbing that lets any future plugin add a tab, a card, or an action
> to any Portal page — without touching the page's source code. Today I'll show you
> how it works and what we've shipped."

---

## 1. The Problem — 5 minutes

### What to say

"Before we built this, the self-service plugin was a monolith. Every tab, every card,
every detail page was hardcoded. If the content management team wanted to add a 'Trust
signals' tab to the collection detail page, they'd have to open a PR into our codebase,
wait for our review, and ship on our timeline.

That doesn't scale. We're about to have multiple teams — content management, partner
integrations, potentially community contributors — all needing to add UI to Portal.
We needed a way for anyone to contribute to the portal shell without changing the shell's
source code.

That's the problem the plugin factory solves. It's an extension system: a defined contract
that lets any plugin register what it wants to show, and a runtime host that reads those
registrations and renders them at the right place."

### Key slide / diagram to draw (on whiteboard or shared screen)

```
Without plugin factory:               With plugin factory:
┌──────────────────────┐              ┌────────────────────────────────────┐
│   self-service       │              │   portal-extension-host            │
│   CollectionDetail   │              │   reads ContributionRegistry       │
│   ├── Overview tab   │              │   renders registered contributions │
│   ├── About tab      │              └──────────┬─────────────────────────┘
│   └── (hardcoded)    │                         │ reads from singleton
└──────────────────────┘              ┌──────────▼─────────────────────────┐
                                      │   ContributionRegistry (shared)    │
                                      └──────────┬──────────────┬──────────┘
                                                 │ writes       │ writes
                                      ┌──────────▼──────┐  ┌────▼─────────────┐
                                      │  self-service   │  │  content plugin  │
                                      │  (own tabs)     │  │  (new tabs)      │
                                      └─────────────────┘  └──────────────────┘
```

---

## 2. The Architecture — 10 minutes

### 2.1 Five packages, three layers

"We shipped five packages. Think of them in three layers."

```
┌─────────────────────────────────────────────────────────┐
│  CONTRACT LAYER  (what plugins and host agree on)       │
│                                                         │
│  portal-extension-api                                   │
│    • ContributionRegistry singleton                     │
│    • PluginManifest + CapabilityContribution types      │
│    • useExtensionTabs / Cards / Actions hooks           │
│    • EXPERIENCE_IDS, CONTENT_TYPES, EXTENSION_POINTS    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  RUNTIME LAYER  (what renders contributions)            │
│                                                         │
│  portal-extension-host                                  │
│   • ExperienceSlot / ExperienceTabContent               │
│   • ExtensionRenderer (permission gating, error safety) │
│   • ErrorBoundary (per-contribution crash isolation)    │
│   • DynamicExtensionDiscovery (RHDH/Scalprum hook)      │
│   • validateManifest (rejects bad/incompatible plugins) │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  SDK LAYER  (what plugin authors use)                   │
│                                                         │
│  portal-plugin-sdk (frontend)                           │
│    • Shared React components (PageHeaderSection, etc.)  │
│    • usePortalContext() — organizationId from session   │
│    • Design tokens, hooks, cache utilities              │
│                                                         │
│  portal-plugin-node (backend)                           │
│    • createPortalPlugin() — identity, health, audit     │
│    • Identity middleware → req.portalContext            │
│    • HealthRegistry, AuditEmitter, withOrganization()   │
└─────────────────────────────────────────────────────────┘

    These all live in: plugins/portal-*/
```

### 2.2 Why is the contract layer a separate package?

"This is the most important thing to understand. In standard Backstage, everything is
one bundle, so it doesn't matter that the registry is a separate package. But in RHDH,
plugins are loaded dynamically at runtime using a technology called Scalprum (webpack
module federation). Each plugin gets its own JavaScript bundle.

If the registry lived inside the host package, each dynamically loaded plugin would get
its own copy of the registry and they'd never talk to each other.

By putting the registry in `portal-extension-api` and marking it as a `sharedPackage`
in RHDH's config, we guarantee exactly one copy of the registry lives in memory, shared
by every plugin. It's the same reason React itself is listed as a shared package — you
can't have two React instances rendering together.

So this package separation isn't cosmetic. It's what makes RHDH dynamic plugins work."

---

## 3. The Contribution Model — 10 minutes

### 3.1 Simple explanation first

"Here's the core idea in one sentence: a plugin calls `registerTab()` to say 'I have a tab
to show on the collection detail page', and the collection detail page calls
`useExtensionTabs()` to ask 'what tabs should I show?'. The registry is the middleman.

The plugin doesn't know where it will appear. The page doesn't know what plugins exist.
They only know the shared contract — an extension point ID like
`'rhaap.collection.detail.tabs'`."

### 3.2 Show the actual code

**File: `plugins/portal-extension-api/src/types.ts`**

Walk through `TabContribution`:

- `id` — unique identifier for this tab across all plugins
- `label` — what the user sees in the tab strip
- `component` — the React component to render when selected
- `appliesToContentTypes` — which content types this tab applies to (collection, EE, playbook-repo)
- `filter` — optional extra predicate (e.g. "only show on entities with annotation X")
- `permission` — optional Backstage permission required to see this tab
- `priority` — where in the tab ordering it appears

**File: `plugins/portal-extension-api/src/registry.ts` (lines 60–120)**

Show `ContributionRegistry`:

- `registerTab(extensionPoint, contribution)` — how plugins add their tabs
- `getMatchingTabs(extensionPoint, entity?, contentType?)` — how the host reads them
- Filtering chain: disabled → contentType → entity filter → sort by priority
- `subscribe(listener)` / `unsubscribe(listener)` — how React hooks know to re-render when a new plugin loads

### 3.3 Talking point: the two-level model

"You'll notice we have two sets of types: the lower-level `TabContribution` / `CardContribution` /
`ActionContribution` that the registry directly uses, and a higher-level `PluginManifest` /
`CapabilityContribution` in `manifest.ts`.

The lower-level types are the PoC model — they map directly onto UI slots. The higher-level
manifest model maps onto the architecture doc's 'experience + capability + entry point' model.

Right now, `selfServiceManifest.ts` uses the manifest model for declaration and validation,
but the actual rendering still goes through the lower-level registry. Connecting them end-to-end
is Phase 6. Think of it as having both the old wiring and the new wiring installed in the wall,
with the switch not yet moved over."

---

## 4. The Extension Host — 10 minutes

### 4.1 ExperienceSlot

"The host package has two main components that pages use."

**File: `plugins/portal-extension-host/src/ExperienceSlot.tsx`**

Show `ExperienceCardSlot`:

- Takes an `extensionPoint` string and an optional `entity` + `contentType`
- Calls `useExtensionCards(extensionPoint, entity, contentType)` — the hook asks the registry
- If no contributions are registered, returns `null` (no empty state — the page decides that)
- For each card: wraps in `ErrorBoundary` → `Suspense` → renders the component

"Notice that the page doesn't import any plugin component. It doesn't know what will appear here.
It just says 'render whatever is registered for this slot'. This is the whole point."

Show `ExperienceTabContent`:

- Takes `extensionPoint` and `activeTabIndex`
- The tab _strip_ (the tab labels) is still owned by the page, because it has to interleave
  built-in tabs and extension tabs in the right visual order
- This component renders the _content panel_ for the selected extension tab

### 4.2 ErrorBoundary

**File: `plugins/portal-extension-host/src/ErrorBoundary.tsx`**

"One of the design rules in the architecture doc is that a broken plugin must never take
down the portal. We use a React class component with `getDerivedStateFromError` for this.

Each contribution gets its own error boundary. If the 'Trust signals' tab throws an
unhandled exception, the portal shows 'Extension "trust-signals" failed to render'
in that tab only. The rest of the page — and all other tabs — keep working normally.

This is why we wrap at the contribution level, not at the page level."

### 4.3 ExtensionRenderer

**File: `plugins/portal-extension-host/src/ExtensionRenderer.tsx`**

Show `ExtensionTabContent`:

- Uses `usePermission(contribution.permission)` from Backstage permission framework
- If `loading` — renders null (prevents a flash of unauthorized content)
- If `!allowed` — renders null (silently hidden, not an error)
- If allowed — renders `<Suspense>` wrapping the contribution component

"The permission gating is automatic. A plugin declares `permission: { type: 'basic', name: 'ansible.collections.view' }` on its tab, and the host gates visibility without the plugin
doing anything else. The plugin author doesn't write any permission-checking code."

Show `useActionActivation`:

- Actions can have an `onActivate` callback for pure UI effects (navigation, opening a dialog)
- The callback receives `entity` and `getApi` — it can open a Backstage dialog or navigate
- For server-side effects, the plugin uses `launches.type: 'operation'` instead, not a URL
- The `try/catch` around `onActivate` ensures a throwing callback doesn't break the menu

### 4.4 DynamicExtensionDiscovery

"This is the RHDH integration point. In standard Backstage, plugins register contributions
synchronously at module load time — they call `registerTab()` when the module is imported.
In RHDH, plugins are loaded asynchronously via Scalprum, so we need a hook that fires after
mount to kick off discovery.

Right now this component validates first-party manifests (like self-service's own manifest)
on startup, which proves the validation pipeline works. The Scalprum part — where it would
enumerate all loaded dynamic plugins and call each one's `initializePlugin()` — is stubbed
out. We know the architecture; we're waiting on confirmation of the exact Scalprum API from
the RHDH team."

---

## 5. The Manifest Contract — 8 minutes

### 5.1 PluginManifest

**File: `plugins/portal-extension-api/src/manifest.ts`**

Walk through the shape:

```typescript
{
  id: 'portal-scaffolder',
  version: '1.0.0',
  apiVersion: '0.1.0',        // ← contract version this plugin was built against
  capabilities: [...],
  entitlements: [],            // ← future: feature gating per org/tier
}
```

"Every plugin publishes one of these. The host validates it before activating any contribution
from that plugin. The `apiVersion` field is critical — it's how we handle breaking changes
to the host contract. If the plugin says `apiVersion: '0.1.0'` and the host is on `0.2.0`,
the host rejects all capabilities from that plugin with a clear error, instead of silently
rendering broken UI."

### 5.2 CapabilityContribution

Walk through a real example from `selfServiceManifest.ts`:

```typescript
{
  id: 'portal-scaffolder.collection-detail',
  experienceId: 'content-quality-assessment',   // ← host-owned region
  appliesToContentTypes: ['collection'],          // ← static type gate
  entryPoints: [{
    kind: 'entity-tab',
    surface: 'entity-page',
    label: 'Overview',
    launches: { type: 'slot', targetSlot: 'collection-detail-main' },
  }],
  minimumHostApiVersion: '0.1.0',
}
```

Key points to call out:

- `experienceId` must match a value the host has declared — unknown IDs are rejected
- `appliesToContentTypes` is evaluated statically before any component mounts — it's a
  declarative filter, not a runtime predicate
- `launches.type: 'slot'` means "mount a federated module" — never a URL, never a fetch call
- This security rule is enforced in the type system: there is no `apiEndpoint` or `handlerUrl`
  field anywhere in the manifest

### 5.3 Show validation

**File: `plugins/portal-extension-host/src/validateManifest.ts`**

"This runs on every manifest before its capabilities are accepted. It checks:

1. Is the `apiVersion` compatible with the host's version?
2. Does each capability's `experienceId` match a known experience?
3. Does each capability's `minimumHostApiVersion` fit within the current host?

Invalid capabilities are skipped individually. The plugin doesn't fail to load."

---

## 6. The Backend SDK — 5 minutes

**File: `plugins/portal-plugin-node/src/createPortalPlugin.ts`**

"The backend SDK is what plugin backends use. It gives a plugin three things out of the box."

**Identity middleware:**

```typescript
const portalPlugin = createPortalPlugin({ pluginId: 'my-plugin' });
app.use(portalPlugin.createMiddleware({ httpAuth, userInfo, logger }));

// Now in any route handler:
app.get('/my-route', (req, res) => {
  const { organizationId, userId } = req.portalContext;
  // organizationId is the Backstage namespace — never from the request params
});
```

"The `organizationId` always comes from the authenticated Backstage session, not from
query parameters or headers the caller supplies. This is a security invariant: you
cannot elevate to another tenant by adding `?org=red-hat` to a request."

**Health push:**

```typescript
portalPlugin.pushHealthStatus({ state: 'READY', message: 'All workers up.' });
```

"Plugins push their health to a registry on the host side. The portal can aggregate
these into a status panel — 'N of 10 plugins healthy'. The display aggregator isn't
built yet, but the push pipeline works end to end."

**Audit emit:**

```typescript
portalPlugin.emitAuditEvent({
  operationId: 'content.collections.publish',
  userId: req.portalContext.userId,
  organizationId: req.portalContext.organizationId,
  outcome: 'success',
});
```

"Every server-side operation is audited. Today this goes to structured logs. The
durable store (so you can query 'show me all publish operations in the last 7 days')
is a later phase."

---

## 7. Live Demo — 15 minutes

### Setup

- Browser: Portal running at localhost:3000
- IDE: `plugins/self-service/src/components/GitRepositories/GitRepositoriesPage.tsx`
  and `plugins/portal-extension-api/src/helpers/git-repository.ts` open side by side

### Step 1 — Show the base state

Navigate to the Git Repositories page. Show the tab strip: "Catalog" and "CI Activity".

"These two tabs are the built-in tabs. Right now there are no external plugins registered.
Let's add one."

### Step 2 — Show the registered tab

**Before the demo:** `packages/app/src/demoExtensions.tsx` is already wired in via
a single import in `App.tsx`. It calls `registerGitRepoListTab()` and
`registerGitRepoDetailTab()` at module load time — exactly what a real external plugin
would do.

Navigate to `/self-service/git-repositories`. You'll see a **"Security Scan"** tab
alongside the built-in "Catalog" and "CI Activity" tabs.

**What to say while showing this:**

> "This tab was not put there by GitRepositoriesPage.tsx. Open that file — there is no
> reference to 'Security Scan', no import of the demo plugin, nothing. The page only
> calls `useExtensionTabs()` and renders whatever comes back. The tab appeared because
> a separate file called `registerGitRepoListTab()` when the app loaded. That's the
> entire integration surface."

**Then open `packages/app/src/demoExtensions.tsx`** and walk through it:

- Two `register*` calls, each with an `id`, a `label`, a `component`, and a `priority`
- No routing config, no plugin manifest file, no PR into self-service
- The `priority: 99` places it after the built-in tabs (which use 0–20)

**Then open `packages/app/src/App.tsx`** and show the single import line:

```typescript
import './demoExtensions';
```

> "In production, this import would live inside the external plugin's own module. When
> RHDH loads the dynamic plugin bundle, the module executes, `registerGitRepoListTab()`
> runs, and the tab appears — without restarting the portal."

### Step 3 — Show what the page does

Open `GitRepositoriesPage.tsx` and find `useExtensionTabs`:

"Notice the page doesn't import any component from any plugin. It just asks the registry
'give me the tabs for this extension point'. The `Security Scan` tab we just registered
appeared automatically."

Point to the `activeExtTabIndex` state and how it drives rendering — the page manages
the tab strip position; `ExperienceTabContent` renders the content.

### Step 4 — Show the manifest validation

Open the browser **DevTools → Console tab**. Reload the page (Cmd+R / Ctrl+R).

You should see:

```
[DynamicExtensionDiscovery] Manifest "portal-scaffolder" validated: 4 capabilities declared.
```

If it's buried in other logs, filter the console by typing `DynamicExtensionDiscovery` in the filter box.

> "Every time the portal loads, the manifest is validated against the host's current API version.
> If a plugin was built against a newer contract than the host supports, it fails here with a
> clear message rather than crashing at render time."

**Tip:** `console.info` is sometimes hidden by default in Chrome. If you don't see it, make sure
"Info" level messages are visible — click the dropdown next to the filter box and ensure
"Info" is checked (it's separate from "Verbose").

### Step 5 — Break one manifest on purpose (optional, high-impact)

In `selfServiceManifest.ts`, temporarily change `apiVersion` to `'9.9.9'`. Save.
Show the console error:

```
[DynamicExtensionDiscovery] Manifest "portal-scaffolder" validation failed: [incompatible apiVersion]
```

The page still loads — only the manifest validation fails. Revert.

### Step 6 — Show `usePortalContext`

Open `plugins/portal-plugin-sdk/src/hooks/usePortalContext.ts`.
"The freshest addition. A plugin frontend calls this to get the org the current user
belongs to. It reads from the Backstage identity API — the same mechanism the backend
middleware uses — so the frontend and backend always agree on which org they're operating in."

---

## 8. PoC vs. Intended Architecture

"I want to be clear about what is production-quality and what is still scaffolding."

### Production-quality (can be depended on now)

| What                                       | Why it's solid                                      |
| ------------------------------------------ | --------------------------------------------------- |
| `portal-extension-api` types and registry  | Full test coverage; API is stable                   |
| `portal-extension-host` rendering pipeline | ErrorBoundary, permission gating, Suspense all work |
| `portal-plugin-node` identity + audit      | 34 tests; security invariants enforced              |
| `usePortalContext()` with `organizationId` | Unblocked; straightforward identity API usage       |
| `validateManifest` + `selfServiceManifest` | Works end-to-end; real manifest validates correctly |
| Tab extension on GitRepositoriesPage       | First live proof of the model                       |

### Still scaffolding / pending

| What                            | Status                                                                         | Blocker                                                       |
| ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Scalprum dynamic plugin loading | Stub — logs RHDH detection, no actual module enumeration                       | Need RHDH team to confirm `@scalprum/react-core` API          |
| Full slot-based activation      | Capabilities declared in manifest, but rendering still uses page-level imports | Phase 6 + content extraction                                  |
| `usePortalContext().apiClient`  | Not implemented                                                                | ANSTRAT-1758 must publish `automation-content-client`         |
| RJSF settings shell             | Not started                                                                    | Design not finalised                                          |
| Health display aggregator       | Push side works; host display side not built                                   | —                                                             |
| CSS custom property injection   | Spec written in `tokens.ts` comments                                           | Low priority — needed when non-MUI plugin contributors arrive |

---

## 9. How This Maps to the Architecture Document

"Our implementation tracks §6 of the Content Experience Architecture document exactly.
Let me show you where each major decision comes from."

| Architecture doc rule                                                          | Where we enforce it                                                                          |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| "Plugins contribute to experiences; they do not own them" (§1.3)               | `experienceId` must match a known `ExperienceDefinition`; unknown IDs rejected at validation |
| "Operations are registered, not proxied" (§1.3)                                | `CapabilityLaunch` has no `apiEndpoint` or `handlerUrl`; `onActivate` is pure-UI only        |
| "portal-core is stateless" (§6.6)                                              | `portal-extension-host` has no database; all state is in the registry singleton              |
| "Plugins declare `appliesToContentTypes`; host evaluates it statically" (§6.3) | `matchesContentType()` in registry; checked before any component mounts                      |
| `portal-extension-api` as `sharedPackage` (§6.4)                               | Documented in `sharedPackages` section; singleton pattern enforced                           |
| Organization-keyed backend state (§6.6)                                        | `withOrganization()` in `portal-plugin-node` rejects empty `orgId` at call site              |

### What the doc says we still need to build

The doc's §3–5 is ANSTRAT-1758's territory: the content service, source adapters, ingestion
pipeline, trust primitives. We haven't started those. Our job (§6) is to make the portal
extensible so the content team can plug in without modifying our code. That part is done.

---

## 10. What Is Still Open — Decision Points

### Decision 1: Scalprum API confirmation (blocks RHDH live demos)

"We need confirmation from the RHDH team of which `@scalprum/react-core` method we should
use to enumerate loaded federated modules. The comment in `DynamicExtensionDiscovery.tsx`
has our best guess (`scalprum.getPluginModules?.()`). One conversation unblocks this."

### Decision 2: Seven picker contracts (blocks Phase 6)

"The self-service plugin has seven form pickers that query content data — collections,
EE base images, EE tags. When we split the content pages out (Phase 6), these pickers
need to call a content service operation instead of calling AAP directly.

We've sent a draft contract proposal to the content team in
`docs/next/anstrat-1758-picker-contract-proposal.md`. We're waiting on their feedback.
The five questions that need answers:

1. Operation IDs and schemas for `content.collections.list` and the EE list variants
2. Whether these go through `automation-content-client` or a separate picker API
3. Permission requirement for each

This is the only thing blocking Phase 6 from starting."

### Decision 3: `usePortalContext().apiClient` shape

"Once ANSTRAT-1758 publishes `automation-content-client`, we need to agree on how it's
exposed. Do plugins import it directly from that package? Or does the host inject it
through `usePortalContext()`? The architecture doc says the latter — it's the 'single
transport' rule. But the exact typing depends on how the content team structures their
client package."

---

## 11. Anticipated Questions & How to Answer Them

### "Why not just use Backstage plugin extensions natively?"

"Backstage has its own extension framework (the new `createExtensionPoint` API). We
evaluated it. The problem is that it requires plugins to be present at startup — it
doesn't handle async dynamic loading the way RHDH's Scalprum does. Our model is also
more explicit about content types and experiences, which gives us the static filtering
that the architecture requires. We're compatible with how Backstage extensions work
conceptually; we just built our own for tighter control."

### "What happens if two plugins register a tab with the same ID?"

"The second registration overwrites the first, and a warning is logged. In practice this
shouldn't happen because tab IDs are namespaced by plugin ID
(e.g. `portal-scaffolder.collection-detail.overview-tab`). We could make this an error
in a future version, but for now overwriting is safer than silently dropping contributions."

### "How does a plugin outside this repo integrate?"

"It installs `@ansible/portal-extension-api` as a peer dependency. It calls
`registerTab(EXTENSION_POINTS.COLLECTION_DETAIL_TABS, { ... })` at module load time.
It declares `@ansible/portal-extension-api` in RHDH's `sharedPackages` list so it shares
the same registry instance. That's the entire integration surface — no PR into our repo
required."

### "Is this a replacement for the Backstage catalog?"

"No. The catalog is still the source of truth for entities. The extension system is purely
UI — it adds tabs and cards to entity detail pages. The content management system
(ANSTRAT-1758) will push entities into the catalog via entity providers; our extension
system controls what appears when you open one of those entities."

### "What about the repo rename? ansible-backstage-plugins → automation-portal-plugins?"

"That's in the plan (Phase 7 in the architecture doc) but requires coordination across
all teams. The package names are already updated — everything is `@ansible/portal-*`.
The directory rename within `plugins/` is also done. The repo rename itself needs a
GitHub redirect setup and alignment with CI, release engineering, and other consumers
of the repo URL. It's not blocking any technical work."

### "What does 'experience' mean? Is it a page?"

"An experience is a host-owned UX region — think of it as a named section of the portal
that groups related content and capabilities. We have four right now: `content-quality-assessment`,
`content-authoring`, `content-migration`, and `self-service`. Plugins don't create experiences;
they register capabilities _into_ an experience. An unknown experience ID is rejected, which
prevents plugins from inventing their own uncontrolled pages. The host always decides what
experiences exist."

### "How is this different from an iframe-based plugin?"

"Completely different approach. There are no iframes. Plugins contribute React components
that are rendered directly into the portal's React tree. This means they share the same
MUI theme, the same router, the same Backstage API context — they look and behave like
native portal pages. The trade-off is that a badly-written plugin can theoretically affect
the portal's React tree, which is why the ErrorBoundary isolation per contribution is
critical."

### "Are tests passing?"

"Yes. 198 test suites, ~4,000+ tests. All green. Each package has its own test suite:
registry filtering, manifest validation, error boundary behavior, extension renderer
permission gating, backend identity middleware, and now `usePortalContext`."

---

## 12. Closing / Next Steps

### Talking points for closing

"So to summarize what we've shipped:

- The contract that any plugin must follow to contribute to Portal
- The runtime that reads those contracts and renders them safely
- The frontend and backend SDKs that make building a plugin straightforward
- Self-service wired as the first real plugin using the contract, proving it end-to-end

The two things that will unlock the most progress:

1. **RHDH team confirms the Scalprum API** → we can complete dynamic extension discovery
2. **Content team responds to the picker contract proposal** → Phase 6 can start

If there are no other blockers, I'd suggest scheduling a 30-minute working session with
the content team specifically on the seven picker contracts. That's the critical path."

---

## Appendix: Package Quick Reference

| Package                          | Directory                        | Key exports                                                                                                                         | Used by                            |
| -------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `@ansible/portal-extension-api`  | `plugins/portal-extension-api/`  | `contributionRegistry`, `useExtensionTabs`, `PluginManifest`, `EXPERIENCE_IDS`, `CONTENT_TYPES`, `EXTENSION_POINTS`                 | All plugins, portal-extension-host |
| `@ansible/portal-extension-host` | `plugins/portal-extension-host/` | `ExperienceCardSlot`, `ExperienceTabContent`, `ExtensionRenderer`, `DynamicExtensionDiscovery`, `ErrorBoundary`, `validateManifest` | Shell / host app                   |
| `@ansible/portal-plugin-sdk`     | `plugins/portal-plugin-sdk/`     | `usePortalContext`, `PageHeaderSection`, `useIsSuperuser`, `syncPollingService`, `PaginatedEntityCache`                             | All frontend plugins               |
| `@ansible/portal-plugin-node`    | `plugins/portal-plugin-node/`    | `createPortalPlugin`, `createIdentityMiddleware`, `HealthRegistry`, `AuditEmitter`, `withOrganization`                              | All backend plugins                |
| `@ansible/portal-scaffolder`     | `plugins/self-service/`          | Self-service pages, scaffolder templates, `selfServiceManifest`                                                                     | Portal shell                       |

## Appendix: Key File Map

| File                                                                  | What to show                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `portal-extension-api/src/types.ts`                                   | `TabContribution`, `CardContribution`, `ActionContribution` — the lower-level API |
| `portal-extension-api/src/manifest.ts`                                | `PluginManifest`, `CapabilityContribution` — the higher-level manifest model      |
| `portal-extension-api/src/registry.ts`                                | `ContributionRegistry` — the singleton bus; filtering chain                       |
| `portal-extension-api/src/extensionPoints.ts`                         | `EXTENSION_POINTS`, `EXPERIENCE_IDS`, `CONTENT_TYPES`                             |
| `portal-extension-host/src/ExperienceSlot.tsx`                        | How pages consume contributions                                                   |
| `portal-extension-host/src/ExtensionRenderer.tsx`                     | Permission gating, Suspense, `onActivate` safety                                  |
| `portal-extension-host/src/ErrorBoundary.tsx`                         | Per-contribution crash isolation                                                  |
| `portal-extension-host/src/DynamicExtensionDiscovery.tsx`             | RHDH hook + manifest validation on mount                                          |
| `portal-extension-host/src/validateManifest.ts`                       | API version compat + known experience check                                       |
| `portal-plugin-node/src/middleware.ts`                                | `organizationId` derivation from entity ref namespace                             |
| `portal-plugin-node/src/withOrganization.ts`                          | Tenant isolation enforcement                                                      |
| `portal-plugin-sdk/src/hooks/usePortalContext.ts`                     | Frontend `organizationId`                                                         |
| `self-service/src/selfServiceManifest.ts`                             | Real manifest declaration — Phase 4 proof                                         |
| `self-service/src/components/GitRepositories/GitRepositoriesPage.tsx` | First live extensible page                                                        |
