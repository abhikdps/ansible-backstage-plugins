import { createPermission } from '@backstage/plugin-permission-common';

/** Mutation permission: viewing a repository never implies permission to scan. */
export const apmeQualityScanPermission = createPermission({
  name: 'ansible.apme.quality.scan',
  attributes: { action: 'create' },
});

export const apmeQualityScanOperation = {
  id: 'apme.quality.scan',
  version: '1.0.0',
  permission: apmeQualityScanPermission,
  inputSchema: { type: 'object', additionalProperties: false },
  exposure: { rest: true },
  auditCategory: 'quality-scan',
  idempotent: false,
};
