/* eslint-disable no-console */
import { render } from '@testing-library/react';
import {
  DynamicExtensionDiscovery,
  useIsDynamicEnvironment,
} from './DynamicExtensionDiscovery';
import { renderHook } from '@testing-library/react';
import type { PluginManifest } from '@ansible/portal-extension-api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeManifest = (
  overrides: Partial<PluginManifest> = {},
): PluginManifest => ({
  id: 'test-plugin',
  version: '0.1.0',
  apiVersion: '0.1.0',
  capabilities: [],
  entitlements: [],
  ...overrides,
});

// ── DynamicExtensionDiscovery ─────────────────────────────────────────────────

describe('DynamicExtensionDiscovery', () => {
  beforeEach(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // Ensure Scalprum is absent (standard Backstage environment)
    // @ts-ignore
    delete (window as any).__scalprum;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders null — produces no DOM output', () => {
    const { container } = render(<DynamicExtensionDiscovery />);
    expect(container).toBeEmptyDOMElement();
  });

  it('logs console.info when a valid manifest is passed', () => {
    render(
      <DynamicExtensionDiscovery
        manifests={[makeManifest()]}
        hostApiVersion="0.1.0"
      />,
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('"test-plugin" validated'),
    );
  });

  it('logs console.error when an invalid manifest is passed', () => {
    const badManifest = makeManifest({ apiVersion: '9.9.9' });
    render(
      <DynamicExtensionDiscovery
        manifests={[badManifest]}
        hostApiVersion="0.1.0"
      />,
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"test-plugin" validation failed'),
      expect.anything(),
    );
  });

  it('validates multiple manifests independently', () => {
    render(
      <DynamicExtensionDiscovery
        manifests={[
          makeManifest({ id: 'plugin-a' }),
          makeManifest({ id: 'plugin-b' }),
        ]}
        hostApiVersion="0.1.0"
      />,
    );
    expect(console.info).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when no manifests are provided (standard Backstage)', () => {
    render(<DynamicExtensionDiscovery />);
    expect(console.info).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('does not throw when Scalprum is absent', () => {
    expect(() => render(<DynamicExtensionDiscovery />)).not.toThrow();
  });
});

// ── useIsDynamicEnvironment ───────────────────────────────────────────────────

describe('useIsDynamicEnvironment', () => {
  afterEach(() => {
    // @ts-ignore
    delete (window as any).__scalprum;
  });

  it('returns false when __scalprum is not present (standard Backstage)', () => {
    // @ts-ignore
    delete (window as any).__scalprum;
    const { result } = renderHook(() => useIsDynamicEnvironment());
    expect(result.current).toBe(false);
  });

  it('returns true when __scalprum global is present (RHDH environment)', () => {
    // @ts-ignore
    (window as any).__scalprum = {};
    const { result } = renderHook(() => useIsDynamicEnvironment());
    expect(result.current).toBe(true);
  });
});
