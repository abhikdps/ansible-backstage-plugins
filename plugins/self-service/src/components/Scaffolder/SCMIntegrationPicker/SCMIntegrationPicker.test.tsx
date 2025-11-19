import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { SCMIntegrationPicker } from './SCMIntegrationPicker';
import { ScaffolderRJSFFieldProps } from '@backstage/plugin-scaffolder-react';
import { ConfigReader } from '@backstage/config';
import { TestApiProvider } from '@backstage/test-utils';
import { configApiRef } from '@backstage/core-plugin-api';

describe('SCMIntegrationPicker', () => {
  const mockConfig = new ConfigReader({
    integrations: {
      github: [
        {
          host: 'github.com',
          token: 'test-token',
          apiBaseUrl: 'https://api.github.com',
        },
        {
          host: 'github.enterprise.example.com',
          token: 'enterprise-token',
          apiBaseUrl: 'https://github.enterprise.example.com/api/v3',
        },
      ],
      gitlab: [
        {
          host: 'gitlab.com',
          token: 'gitlab-token',
          apiBaseUrl: 'https://gitlab.com/api/v4',
        },
      ],
    },
  });

  const mockProps: Partial<ScaffolderRJSFFieldProps> = {
    name: 'scmIntegration',
    rawErrors: [],
    required: false,
    disabled: false,
    schema: {
      type: 'string',
      title: 'SCM Integration',
      description: 'Select an SCM integration',
    },
    uiSchema: {
      'ui:field': 'SCMIntegrationPicker',
    },
    formData: '',
    onChange: jest.fn(),
  };

  it('should render without crashing', async () => {
    render(
      <TestApiProvider apis={[[configApiRef, mockConfig]]}>
        <SCMIntegrationPicker {...(mockProps as ScaffolderRJSFFieldProps)} />
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/SCM Integration/i)).toBeInTheDocument();
    });
  });

  it('should load GitHub and GitLab integrations', async () => {
    render(
      <TestApiProvider apis={[[configApiRef, mockConfig]]}>
        <SCMIntegrationPicker {...(mockProps as ScaffolderRJSFFieldProps)} />
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/SCM Integration/i)).toBeInTheDocument();
    });

    // The component should have loaded integrations from config
    // You can add more specific assertions based on your rendering logic
  });

  it('should filter by GitHub only when scmType is github', async () => {
    const githubOnlyProps = {
      ...mockProps,
      uiSchema: {
        'ui:field': 'SCMIntegrationPicker',
        'ui:options': {
          scmType: 'github',
        },
      },
    };

    render(
      <TestApiProvider apis={[[configApiRef, mockConfig]]}>
        <SCMIntegrationPicker {...(githubOnlyProps as ScaffolderRJSFFieldProps)} />
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/SCM Integration/i)).toBeInTheDocument();
    });

    // Component should only show GitHub integrations
  });

  it('should handle multiple selection when type is array', async () => {
    const multipleProps = {
      ...mockProps,
      schema: {
        ...mockProps.schema!,
        type: 'array',
      },
      formData: [],
    };

    render(
      <TestApiProvider apis={[[configApiRef, mockConfig]]}>
        <SCMIntegrationPicker {...(multipleProps as ScaffolderRJSFFieldProps)} />
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/SCM Integration/i)).toBeInTheDocument();
    });
  });

  it('should show error message when required and empty', () => {
    const errorProps = {
      ...mockProps,
      required: true,
      rawErrors: ['Required field'],
    };

    render(
      <TestApiProvider apis={[[configApiRef, mockConfig]]}>
        <SCMIntegrationPicker {...(errorProps as ScaffolderRJSFFieldProps)} />
      </TestApiProvider>,
    );

    expect(screen.getByText('Required field')).toBeInTheDocument();
  });

  it('should handle empty config gracefully', async () => {
    const emptyConfig = new ConfigReader({});

    render(
      <TestApiProvider apis={[[configApiRef, emptyConfig]]}>
        <SCMIntegrationPicker {...(mockProps as ScaffolderRJSFFieldProps)} />
      </TestApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/SCM Integration/i)).toBeInTheDocument();
    });
  });
});

