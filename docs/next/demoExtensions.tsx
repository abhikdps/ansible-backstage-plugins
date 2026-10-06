/**
 * Demo extension registrations for the ANSTRAT-2497 presentation.
 *
 * This file simulates what an external plugin would do at module load time.
 * Delete after the demo or keep as a documented example.
 *
 * To activate: import './demoExtensions' in App.tsx (one line, already done
 * if you followed the demo guide).
 */
import {
  registerGitRepoListTab,
  registerGitRepoDetailTab,
  CONTENT_TYPES,
} from '@ansible/portal-extension-api';

// ── Tab on the Git Repositories list page ─────────────────────────────────────
//
// This appears as a new tab alongside the built-in "Catalog" and "CI Activity"
// tabs on the /self-service/git-repositories page.

registerGitRepoListTab({
  id: 'demo-plugin.security-scan',
  label: 'Security Scan',
  component: () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ marginTop: 0 }}>Security Scan Results</h3>
      <p style={{ color: '#666' }}>
        This tab was registered by an external plugin at module load time.
        No changes were made to GitRepositoriesPage.tsx.
      </p>
      <ul>
        <li>✅ 12 repositories scanned</li>
        <li>⚠️ 3 repositories with outdated dependencies</li>
        <li>❌ 1 repository with a known CVE</li>
      </ul>
    </div>
  ),
  priority: 99, // built-in tabs use 0–20; this appears after them
});

// ── Tab on a single Git Repository detail page ────────────────────────────────
//
// This appears as an extra tab when you open any individual repository.

registerGitRepoDetailTab({
  id: 'demo-plugin.compliance',
  label: 'Compliance',
  component: () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ marginTop: 0 }}>Compliance Status</h3>
      <p style={{ color: '#666' }}>
        Registered by the demo plugin. Content type:{' '}
        <code>{CONTENT_TYPES.PLAYBOOK_REPOSITORY}</code>
      </p>
    </div>
  ),
  appliesToContentTypes: [CONTENT_TYPES.PLAYBOOK_REPOSITORY],
  priority: 99,
});
