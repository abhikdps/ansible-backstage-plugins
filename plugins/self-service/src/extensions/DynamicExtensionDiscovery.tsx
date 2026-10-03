import { useEffect } from 'react';
import { contributionRegistry } from '@ansible/backstage-rhaap-extension-api';
import { validateManifest } from './validateManifest';
import {
  selfServiceManifest,
  SELF_SERVICE_API_VERSION,
} from '../selfServiceManifest';

/**
 * Side-effect component that discovers and loads dynamic plugin contributions
 * in RHDH deployments.
 *
 * **Standard Backstage:** This component is a no-op. Plugins register
 * contributions synchronously at module load time via the `contributionRegistry`
 * singleton — no dynamic discovery is needed.
 *
 * **RHDH with Scalprum:** Dynamic plugins are loaded asynchronously by
 * Scalprum (Webpack Module Federation). This component would enumerate loaded
 * plugin modules and call each plugin's initialiser, which registers its
 * contributions into the shared `contributionRegistry` singleton.
 *
 * **Open question (architecture §8):** The exact Scalprum API for resolving a
 * federated module by plugin ID is not yet finalised. This component will be
 * completed once `@scalprum/react-core` usage is confirmed with the RHDH team.
 * Tracked in: ANSTRAT-2497 Phase 3.
 *
 * **Why a React component and not a plain function?**
 * Scalprum's module resolution is async and React lifecycle gives us a clean
 * place to run it once after mount without adding a global singleton that
 * conflicts with SSR or test isolation.
 */
export const DynamicExtensionDiscovery = () => {
  useEffect(() => {
    // ── Self-service manifest validation ──────────────────────────────────
    //
    // Validate the self-service plugin's own manifest before any community
    // plugin contributions are processed. This proves the manifest pipeline
    // works end-to-end (Phase 4 of ANSTRAT-2497).
    //
    // The result is logged only — no activation of contributions happens here.
    // Full slot-based activation (translating CapabilityEntryPoints into
    // TabContributions in the registry) is deferred to Phase 6 when the
    // content pages are extracted and their components can be provided.
    const selfServiceResult = validateManifest(
      selfServiceManifest,
      SELF_SERVICE_API_VERSION,
    );
    if (!selfServiceResult.valid) {
      // eslint-disable-next-line no-console
      console.error(
        '[DynamicExtensionDiscovery] Self-service manifest validation failed:',
        selfServiceResult.errors,
      );
    } else {
      // eslint-disable-next-line no-console
      console.info(
        `[DynamicExtensionDiscovery] Self-service manifest validated: ` +
          `${selfServiceResult.validCapabilities.length} capabilities declared.`,
      );
    }

    // Detect whether Scalprum is present in the runtime environment.
    // In standard Backstage it is not; in RHDH it is injected globally.
    const isRHDH =
      typeof window !== 'undefined' &&
      // @ts-ignore — Scalprum injects this global; it is absent in standard Backstage.
      typeof (window as any).__scalprum !== 'undefined';

    if (!isRHDH) {
      // Standard Backstage: contributions are registered synchronously at
      // module import time. Nothing to do.
      return;
    }

    // ── RHDH path (stub — to be completed) ────────────────────────────────
    //
    // When Scalprum is present, enumerate its loaded plugin modules and call
    // each plugin's `initializePlugin()` export, which registers contributions
    // into the shared contributionRegistry.
    //
    // Expected implementation (pending Scalprum API confirmation):
    //
    // const scalprum = (window as any).__scalprum;
    // const pluginModules: Record<string, any> = scalprum.getPluginModules?.() ?? {};
    // for (const [pluginId, module] of Object.entries(pluginModules)) {
    //   if (typeof module.initializePlugin === 'function') {
    //     try {
    //       module.initializePlugin({ registry: contributionRegistry });
    //     } catch (err) {
    //       console.error(
    //         `[DynamicExtensionDiscovery] Failed to initialise plugin "${pluginId}":`,
    //         err,
    //       );
    //     }
    //   }
    // }
    //
    // eslint-disable-next-line no-console
    console.info(
      '[DynamicExtensionDiscovery] RHDH/Scalprum environment detected. ' +
        'Dynamic extension loading is not yet implemented. ' +
        'Tracked in ANSTRAT-2497 Phase 3.',
    );
  }, []);

  // This component renders nothing — it is a pure side-effect.
  return null;
};

/**
 * Hook for components that need to know whether the dynamic extension
 * environment is active. Returns `false` in standard Backstage; `true` in RHDH.
 *
 * Useful for showing "Loading plugins..." UI while Scalprum is still
 * resolving modules.
 */
export function useIsDynamicEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-ignore
  return typeof (window as any).__scalprum !== 'undefined';
}

// Keep the registry accessible for any module that imports this file.
export { contributionRegistry };
