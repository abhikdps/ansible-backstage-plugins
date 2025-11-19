import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import {
  createScaffolderFieldExtension,
  FieldExtensionComponent,
} from '@backstage/plugin-scaffolder-react';

import { RJSFSchema, UIOptionsType } from '@rjsf/utils';

import { SCMIntegrationPicker } from './SCMIntegrationPicker';

export const SCMIntegrationPickerExtension: FieldExtensionComponent<
  any,
  UIOptionsType<any, RJSFSchema, any>
> = scaffolderPlugin.provide(
  createScaffolderFieldExtension({
    name: 'SCMIntegrationPicker',
    component: SCMIntegrationPicker,
  }),
);

