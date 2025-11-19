import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createScaffolderFieldExtension } from '@backstage/plugin-scaffolder-react';
import { SCMIntegrationPickerExtension } from './extensions';
import { SCMIntegrationPicker } from './SCMIntegrationPicker';

jest.mock('@backstage/plugin-scaffolder', () => ({
  scaffolderPlugin: {
    provide: jest.fn(x => x),
  },
}));

jest.mock('@backstage/plugin-scaffolder-react', () => ({
  createScaffolderFieldExtension: jest.fn(x => x),
}));

jest.mock('./SCMIntegrationPicker', () => ({
  SCMIntegrationPicker: () => 'SCMIntegrationPicker',
}));

describe('SCMIntegrationPickerExtension', () => {
  it('should call scaffolderPlugin.provide with the correct extension', () => {
    // Trigger import usage
    void SCMIntegrationPickerExtension;

    // Check that createScaffolderFieldExtension was called with correct args
    expect(createScaffolderFieldExtension).toHaveBeenCalledWith({
      name: 'SCMIntegrationPicker',
      component: SCMIntegrationPicker,
    });

    // Check that scaffolderPlugin.provide was called with the result
    expect(scaffolderPlugin.provide).toHaveBeenCalledWith({
      name: 'SCMIntegrationPicker',
      component: SCMIntegrationPicker,
    });

    // The exported component should match the mocked component
    expect(SCMIntegrationPicker.name).toBe('SCMIntegrationPicker');
  });
});

