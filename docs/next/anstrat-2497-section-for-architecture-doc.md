# Section: ANSTRAT-2497 Implementation Guide

### (Proposed insertion into "Content Experience Architecture" — Section 10 or as an appendix)

> **Instructions for merge:** Insert this section as **§10 — ANSTRAT-2497 Implementation
> Guide** (between the current §9 Findings and the closing section, or as an appendix).
> Update the table of contents to add the new section.
>
> This section references the full implementation plan at
> [`docs/next/anstrat-2497-implementation-guide.md`](https://github.com/ansible/ansible-backstage-plugins/blob/main/docs/next/anstrat-2497-implementation-guide.md)
> in the `ansible-backstage-plugins` repo.
>
> Remove these instructions when merging.

---

## 10. ANSTRAT-2497 — Portal Plugin Factory: Implementation

### 10.1 Jira scope and team

**[ANSTRAT-2497](https://redhat.atlassian.net/browse/ANSTRAT-2497)** is owned by the
self-service and portal core teams. It delivers:

- The **portal-core workspace** packages: `portal-extension-common`, `portal-extension-api`,
  `portal-extension-host`, `portal-plugin-sdk`, `portal-plugin-node`
- The **content/self-service boundary contracts** (§7.5 — the seven scaffolder pickers)
- The **self-service refactor** — splitting the current `self-service` monolith into
  `portal-scaffolder` (keeps templates, tasks, history) and the content modules that
  move to ANSTRAT-1758

It does **not** own content management primitives, ingestion, trust, or OCI adapters
(those are ANSTRAT-1758).

### 10.2 PoC baseline

A proof-of-concept on branch `anstrat-2497-poc` in `ansible-backstage-plugins`
validated the core patterns from this document:

- Module-level singleton `ContributionRegistry` handles async dynamic plugin late-loading
- `useExtensionTabs()` subscription re-render pattern works correctly with RHDH's async
  Scalprum loading
- Component extraction from `self-service` with re-export shims preserves backward
  compatibility during the transition
- CSS custom properties derived from `useTheme()` give theme-adaptive design tokens
  to contributed components regardless of their UI framework
- MUI v4 `ThemeProvider` wrapping gives contributed components automatic host theme
  inheritance — a contributed MUI v5 or BUI component works without re-theming

**PoC deviations from this architecture (corrected for production):**

| PoC decision                                             | Correct production decision                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `handler()` for server effects                           | `CapabilityLaunch.operationId` / `workflowId` (§6.3)                                      |
| Per-page frozen IDs (`rhaap.git-repository.detail.tabs`) | Experience + capability + entry point model (§6.2)                                        |
| Packages: `backstage-rhaap-*`                            | Packages: `portal-extension-*` / `portal-plugin-sdk` (§2.1)                               |
| Host in `self-service` plugin                            | Host in `portal-core` workspace (§2.2)                                                    |
| Single EE type                                           | Two types: `execution-environment-definition`, `execution-environment-image` (§4.2, §7.2) |
| `filter?` as sole type gate                              | `appliesToContentTypes` is the primary static gate (§6.2)                                 |

All PoC design decisions and alignment with this architecture are documented at
`docs/architecture/self-service-extension-sdk.md` — specifically §12 (Alignment with
Full Architecture).

### 10.3 Package layout (portal-core workspace)

All packages below live in `workspaces/portal-core/plugins/`:

```
portal-extension-common/
  No React, no Node. Serialisable types only.
  PluginManifest, CapabilityContribution, CapabilityEntryPoint,
  CapabilityLaunch, ExperienceDefinition, SettingsContribution,
  EntitlementDefinition, OperationDescriptor.

portal-extension-api/
  React-only. ContributionRegistry (shared module singleton),
  usePortalExtensions(), useExtensionTabs(), useExtensionCards(),
  useExtensionActions(), registerCapability().

portal-extension-host/
  React plugin. ExtensionRenderer, ExperienceSlot,
  DynamicExtensionDiscovery (Scalprum), ErrorBoundary, permission gating,
  CSS custom property injection.

portal-plugin-sdk/
  React-only. usePortalContext() (organizationId, apiClient, user),
  BUI design tokens, RJSF custom widget registration.

portal-plugin-node/
  Node-only. createPortalPlugin(), identity middleware, audit emit,
  health push, org-keyed DB helpers.
```

`portal-extension-api` must be in RHDH `sharedPackages` — it is the singleton
registry bus. Plugin manifests list it as a `peerDependency` only, never `--embed-package`.

### 10.4 Delivery phases

Phases are sequenced by dependency. Bold phases produce contracts other teams build against.

**Phase 1 — Shared component library** (`portal-plugin-sdk` frontend subset)

Extract components from current `self-service` into `portal-plugin-sdk`: shared UI
primitives, notification stack, cache utilities, hooks (`useIsSuperuser`), styles,
icons. Add `usePortalContext()`, BUI tokens, RJSF widget registration.
Provide re-export shims in `self-service` to maintain backward compatibility.

**Phase 2 — Extension contracts** (`portal-extension-common` + `portal-extension-api`)

Implement the serialisable types from §6.2–6.3 of this document. Move
`ContributionRegistry` here. Update `EXTENSION_POINTS` to experience + capability
model; keep PoC-era IDs as deprecated aliases for one release.

**Phase 3 — Extension host** (`portal-extension-host`)

`ExtensionRenderer`, `ExperienceSlot`, `DynamicExtensionDiscovery`. Experience IDs
are validated at registration. Manifest validation rejects incompatible `apiVersion`.
RJSF settings shell. `portal-extension-host` lives in `portal-core`, not in any content
or self-service plugin.

**Phase 4 — Wire self-service as first-party contributor**

Re-register self-service's detail pages (Repository, Collection, EE-definition) as
`CapabilityContribution` entries targeting the appropriate experiences. This proves the
SDK works before ANSTRAT-1758 and partner integrations depend on it.

**Phase 5 — `portal-plugin-node`**

Identity middleware, audit event emitter, health push, org-keyed DB helpers.

**Phase 6 — Content extraction** _(dependent on ANSTRAT-1758)_

Components move per §7.3. The first concrete prerequisite: ANSTRAT-1758 publishes
`automation-content-client` and the registered operations for the seven scaffolder
pickers (§7.5), with agreed schemas and permissions. Self-service re-implements the
pickers against the published client. Neither team edits the other's package.

**Phase 7 — Rename and restructure**

Rename packages, rename repo, migrate to workspace layout from §2.2. Update imports.
Add `/self-service/*` redirects. This is the last phase — done once packages are stable.

### 10.5 Contracts published for ANSTRAT-1758

| Package                            | What it provides                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `@ansible/portal-extension-common` | `PluginManifest`, `CapabilityContribution`, `CapabilityLaunch`, canonical content type ID strings |
| `@ansible/portal-extension-api`    | `ContributionRegistry`, `registerCapability()`, React hooks                                       |
| `@ansible/portal-plugin-sdk`       | `usePortalContext()`, BUI tokens, RJSF widget registration                                        |
| `@ansible/portal-plugin-node`      | Identity middleware, audit emit, health push                                                      |

ANSTRAT-1758 depends on these packages. Breaking changes to them require coordination
and a major semver bump with a migration guide.

### 10.6 The boundary agreement needed first (§7.5)

Before Phase 6 can begin, the two Jiras must agree on five things:

1. Operation ID and input/output schema for `content.collections.list`
2. Operation ID and input/output schema for `content.executionEnvironments.listBaseImages`
3. Operation ID and input/output schema for `content.executionEnvironments.listTags`
4. Whether these go through `automation-content-client` or a separate picker API
5. Required permission for each operation

These are the seven scaffolder pickers (§7.5 of this document). Settling their shape
unblocks parallel development of the picker field components (self-service team) and
the operation handlers (content team).

### 10.7 Full implementation plan

The complete phase-by-phase plan, work item status, open questions, and documentation
deliverables are maintained in:

> [`docs/next/anstrat-2497-implementation-guide.md`](https://github.com/ansible/ansible-backstage-plugins/blob/main/docs/next/anstrat-2497-implementation-guide.md)
> in the `ansible-backstage-plugins` repository

That document is the single source of truth for this ticket's implementation details.
This section in the architecture document is the architectural summary and pointer.
