// @ts-nocheck

// ── Backstage field extension registrations (public API) ─────────────────────
export {
  EntityNamePickerFieldExtension,
  EntityPickerFieldExtension,
  EntityTagsPickerFieldExtension,
  MultiEntityPickerFieldExtension,
  MyGroupsPickerFieldExtension,
  OwnedEntityPickerFieldExtension,
  OwnerPickerFieldExtension,
  RepoBranchPickerFieldExtension,
  RepoUrlPickerFieldExtension,
} from '@backstage/plugin-scaffolder';

// ── Picker components in the public API ──────────────────────────────────────
export {
  EntityPicker,
  EntityTagsPicker,
  MyGroupsPicker,
  MyGroupsPickerSchema,
  OwnedEntityPicker,
  OwnerPicker,
  RepoUrlPicker,
  repoPickerValidation,
} from '@backstage/plugin-scaffolder';

// ── Picker components/schemas not in the public API ───────────────────────────
// These are accessed via dist internals. Paths use the .esm.js extension
// required by the current Backstage build output (changed from bare .esm).

export { EntityPickerSchema } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/EntityPicker/schema.esm.js';

export { EntityNamePicker } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/EntityNamePicker/EntityNamePicker.esm.js';
export { EntityNamePickerSchema } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/EntityNamePicker/schema.esm.js';
export { entityNamePickerValidation } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/EntityNamePicker/validation.esm.js';

export { EntityTagsPickerSchema } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/EntityTagsPicker/schema.esm.js';

export { RepoUrlPickerSchema } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/RepoUrlPicker/schema.esm.js';

export { OwnerPickerSchema } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/OwnerPicker/schema.esm.js';

export { OwnedEntityPickerSchema } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/OwnedEntityPicker/schema.esm.js';

export { SecretInput } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/SecretInput/SecretInput.esm.js';

export { MultiEntityPicker, validateMultiEntityPickerValidation } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/MultiEntityPicker/MultiEntityPicker.esm.js';
export { MultiEntityPickerSchema } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/MultiEntityPicker/schema.esm.js';

export { RepoBranchPicker } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/RepoBranchPicker/RepoBranchPicker.esm.js';
export { RepoBranchPickerSchema } from '../../../../../node_modules/@backstage/plugin-scaffolder/dist/components/fields/RepoBranchPicker/schema.esm.js';
