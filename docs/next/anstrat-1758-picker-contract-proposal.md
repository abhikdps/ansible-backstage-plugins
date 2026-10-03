# Picker Operation Contract Proposal
## ANSTRAT-2497 → ANSTRAT-1758 Boundary

> **From:** Portal Plugin Factory team (ANSTRAT-2497)
> **To:** Content Management team (ANSTRAT-1758)
> **Date:** 2026-10-01
> **Status:** Draft — awaiting ANSTRAT-1758 feedback
> **Context:** §7.5 of the implementation guide (`docs/next/anstrat-2497-implementation-guide.md`)

---

## 1. Background

The self-service plugin currently contains seven scaffolder field pickers. During Phase 6
of ANSTRAT-2497 (content extraction), these pickers are split:

- Pickers that query **Ansible content** (collections, EE images) will be re-implemented
  against operations that ANSTRAT-1758 declares.
- Pickers that query **AAP resources** (organizations, inventories, projects) continue to
  use the existing AAP API routes and are not part of this contract.
- Pickers that are **pure user-input** (tags, pip package names, file names, MCP servers,
  SCM choices) require no content operation and are out of scope here.

**This document defines the operation contract for the content-facing pickers only.**
Agreement on this contract unblocks Phase 6 for both teams.

### The three pickers in scope

| Picker component | Content it queries | Operations needed |
|---|---|---|
| `CollectionsPickerExtension` | Ansible collections from PAH / Galaxy / OCI | 3 |
| `BaseImagePickerExtension` | Built EE images from the EE catalog | 1–2 |

---

## 2. Current Behaviour (What We Ship Today)

Understanding the current implementation makes the required API surface explicit.

### 2.1 CollectionsPicker

The picker calls `scaffolderApi.autocomplete` with three separate `resource` strings:

```
resource: 'collections',
  context: { searchQuery: 'spec.type=ansible-collection' }
  → returns: [{ name, namespace?, sources?: string[], versions?: SourceVersionDetail[] | string[], sourceVersions?: Record<sourceId, string[]> }]

resource: 'collection_sources',
  context: { collection: collectionName }
  → returns: [{ name: string, id: string }]

resource: 'collection_versions',
  context: { collection: collectionName, source: sourceId }
  → returns: [{ name: string, label?: string, version: string | null }]
```

The user flow is a three-step cascade: pick a collection name → pick a source →
(optionally) pick a version. The output stored in the template form is:

```typescript
interface CollectionItem {
  name: string;      // collection name, e.g. "community.general"
  source: string;    // source/repository ID
  version?: string;  // version string or null for "latest"
}
```

### 2.2 BaseImagePicker

Currently **static** — the available base images are provided as a JSON schema `enum` in the
template YAML and rendered as a radio list. No API call is made at runtime.

The recommended image is hardcoded:
```
registry.redhat.io/ansible-automation-platform/ee-minimal-rhel8:2.18
```

Phase 6 requires this to become **dynamic** — fetching available base images from the EE
content catalog so that new AAP releases appear automatically without template edits.

---

## 3. Proposed Operation Contract

We propose the following operation IDs and schemas. These follow the `operationId` model
from §4.3 of the implementation guide — no raw HTTP endpoint, no plugin-provided handler URL.
All calls go through `automation-content-client`.

---

### 3.1 `content.collections.search`

**Purpose:** Full-text / name-filtered search across all collections available to the
current organization. Powers the first autocomplete in CollectionsPicker.

**Input:**
```typescript
interface CollectionSearchInput {
  /** Free-text search. Empty string returns all collections (paginated). */
  query?: string;
  /** Max results to return. Default: 50, max: 200. */
  limit?: number;
  /** Cursor for pagination (opaque string from previous response). */
  cursor?: string;
}
```

**Output:**
```typescript
interface CollectionSearchOutput {
  items: CollectionSummary[];
  /** Present when more results are available. */
  nextCursor?: string;
}

interface CollectionSummary {
  /** Fully qualified name, e.g. "community.general". */
  name: string;
  /** Human-readable description (optional). */
  description?: string;
  /**
   * Known source IDs for this collection — allows the UI to pre-populate the
   * source dropdown without a second round-trip.
   * May be omitted if the backend cannot determine this cheaply.
   */
  knownSourceIds?: string[];
}
```

**Permission:** `ansible.collections.view` (already declared in `backstage-rhaap-common`).

**Question for 1758:** Should `knownSourceIds` be a guaranteed field or best-effort?
If best-effort, the UI will always do a second call to `content.collections.listSources`.

---

### 3.2 `content.collections.listSources`

**Purpose:** List the sources (PAH instances, Galaxy, OCI registries) where a specific
collection is available. Powers the "Source" autocomplete after a collection is selected.

**Input:**
```typescript
interface CollectionSourcesInput {
  /** Fully qualified collection name, e.g. "community.general". */
  collectionName: string;
}
```

**Output:**
```typescript
interface CollectionSourcesOutput {
  sources: CollectionSource[];
}

interface CollectionSource {
  /** Opaque ID used to fetch versions and identify the source at EE build time. */
  id: string;
  /** Human-readable label, e.g. "Red Hat Automation Hub", "Galaxy". */
  label: string;
  /** Short URL shown as secondary text in the dropdown (optional). */
  url?: string;
}
```

**Permission:** `ansible.collections.view`.

---

### 3.3 `content.collections.listVersions`

**Purpose:** List available versions of a collection at a specific source. Powers the
optional "Version" autocomplete after source selection.

**Input:**
```typescript
interface CollectionVersionsInput {
  collectionName: string;
  sourceId: string;
}
```

**Output:**
```typescript
interface CollectionVersionsOutput {
  versions: CollectionVersion[];
}

interface CollectionVersion {
  /** The version string, e.g. "1.4.2" or null for "latest". */
  version: string | null;
  /** Human-readable label shown in the dropdown. */
  label: string;
  /**
   * Optional: git ref or OCI digest this version resolves to.
   * Used for reproducible builds. If present, stored in the EE definition.
   */
  ref?: string;
}
```

**Permission:** `ansible.collections.view`.

---

### 3.4 `content.executionEnvironments.listBaseImages`

**Purpose:** List built EE images that can be used as a base image in an EE definition.
Replaces the current static enum in `BaseImagePickerExtension`.

**Input:**
```typescript
interface EEBaseImageListInput {
  /** Optional: filter by AAP platform version tag. Default: return all. */
  platformVersion?: string;
  /** Whether to include images from Red Hat CDN (registry.redhat.io). Default: true. */
  includeRhcdn?: boolean;
  /** Whether to include custom/org-managed images from org's PAH. Default: true. */
  includeCustom?: boolean;
}
```

**Output:**
```typescript
interface EEBaseImageListOutput {
  images: EEBaseImage[];
}

interface EEBaseImage {
  /**
   * Fully qualified image reference: `registry/image:tag`.
   * This is the value written into `execution-environment.yml`.
   */
  imageRef: string;
  /** Human-readable name, e.g. "EE Minimal RHEL 8 (2.18)". */
  label: string;
  /** Short description of what ansible-core version / platform this image includes. */
  description?: string;
  /**
   * True if this is the Red Hat-recommended base image for new EE definitions.
   * The UI renders this with a "Recommended" badge.
   * At most one image should have this set to true per query.
   */
  recommended?: boolean;
  /**
   * OCI digest (sha256:...) for reproducible pinning. Optional but preferred
   * for production EE definitions.
   */
  digest?: string;
}
```

**Permission:** `ansible.execution-environments.view` (already declared).

---

## 4. Open Questions for ANSTRAT-1758

These five questions **must be answered before Phase 6 begins**. Both teams are blocked
on them.

| # | Question | Impact |
|---|---|---|
| **Q1** | Do all three collection operations go through `automation-content-client`, or is there a separate scaffolder-autocomplete API that proxies to PAH? | Determines what the pickers import and how they authenticate |
| **Q2** | Is `content.collections.search` backed by PAH's Galaxy v3 search, or by the Backstage catalog index? | Latency, offline behaviour, and whether search is live-typed or request-on-open |
| **Q3** | Are the `sourceId` values in §3.1–3.3 stable across PAH upgrades? The EE definition stores this ID — a rename would break existing definitions. | Data model stability |
| **Q4** | What permission gates `content.executionEnvironments.listBaseImages`? Is it the same `ansible.execution-environments.view` permission, or a new one? | RBAC configuration for the scaffolder |
| **Q5** | Is `listBaseImages` scoped to the user's organization (only images in their org's PAH), or does it include CDN images from `registry.redhat.io` regardless of org? | Affects the `includeRhcdn` input field in §3.4 |

### Nice-to-have for Phase 6 planning

- **Gitea support for `playbook-repository`:** Will ANSTRAT-1758 deliver Gitea as a
  supported SCM provider, or is it a deferred deviation? This determines whether the
  `ScmSelector` picker stays static (GitHub/GitLab only) or needs a dynamic list.

---

## 5. What We Commit To (ANSTRAT-2497 Side)

Once the five questions above are answered, we commit to:

1. Implementing the three CollectionsPicker operations against the agreed client within
   Phase 6 (no changes to the picker UI — only the data-fetching layer changes).
2. Implementing `BaseImagePicker` dynamic fetching against `content.executionEnvironments.listBaseImages`.
3. Publishing the `CollectionItem` and `EEBaseImage` types in `portal-extension-common`
   so both teams can import from a single source.
4. Not calling any PAH or content API directly from a frontend picker — all calls go
   through the registered operation pipeline.

---

## 6. Non-Content Pickers (Out of Scope for This Contract)

For completeness, the other five pickers are not part of this boundary agreement:

| Picker | Current data source | Phase 6 fate |
|---|---|---|
| `EETagsPicker` | User-provided free text | Stays in self-service → portal-scaffolder |
| `PackagesPicker` | User-provided free text (pip package names) | Stays in portal-scaffolder |
| `MCPServersPicker` | Static schema enum from template YAML | Stays in portal-scaffolder |
| `AAResourcePicker` | AAP API (organizations, inventories, projects) | Stays in portal-scaffolder, continues to use AAP proxy |
| `ScmSelector` | Static enum (GitHub, GitLab) | Stays in portal-scaffolder; may add Gitea if 1758 supports it |
