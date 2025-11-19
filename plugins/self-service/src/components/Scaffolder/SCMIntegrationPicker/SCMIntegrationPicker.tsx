import React, { useEffect, useState } from 'react';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { ScaffolderRJSFFieldProps } from '@backstage/plugin-scaffolder-react';
import FormControl from '@material-ui/core/FormControl';
import FormHelperText from '@material-ui/core/FormHelperText';
import {
  Chip,
  InputLabel,
  makeStyles,
  MenuItem,
  Select,
  Typography,
  Box,
} from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 300,
    maxWidth: 600,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 2,
  },
  noLabel: {
    marginTop: theme.spacing(3),
  },
  integrationDetails: {
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
}));

interface SCMIntegration {
  id: string;
  type: 'github' | 'gitlab';
  host: string;
  apiBaseUrl?: string;
  token?: string;
}

/**
 * SCMIntegrationPicker - A custom field extension that displays available SCM integrations
 * from app-config.yaml and allows users to select one.
 *
 * Schema properties:
 * - type: "string" | "array" - Single or multiple selection
 * - scmType: "github" | "gitlab" | "all" - Filter by SCM type (default: "all")
 * - ui:field: "SCMIntegrationPicker"
 * 
 * Example usage in template.yaml:
 * ```yaml
 * parameters:
 *   - title: Choose SCM Integration
 *     properties:
 *       scmIntegration:
 *         title: SCM Integration
 *         type: string
 *         description: Select the SCM integration to use
 *         ui:field: SCMIntegrationPicker
 *         ui:options:
 *           scmType: github  # Optional: filter by 'github', 'gitlab', or 'all'
 * ```
 */
export const SCMIntegrationPicker = (props: ScaffolderRJSFFieldProps) => {
  const {
    rawErrors = [],
    required,
    disabled,
    schema: { description, title, type },
    uiSchema,
    formData,
    onChange,
  } = props;

  const config = useApi(configApiRef);
  const classes = useStyles();
  const multiple = type === 'array';
  const scmTypeFilter = uiSchema?.['ui:options']?.scmType || 'all';

  const [integrations, setIntegrations] = useState<SCMIntegration[]>([]);
  const [selected, setSelected] = useState<string | string[]>(
    multiple ? (formData || []) : (formData || '')
  );
  const [selectedIntegration, setSelectedIntegration] = useState<SCMIntegration | null>(null);

  useEffect(() => {
    const loadIntegrations = () => {
      const availableIntegrations: SCMIntegration[] = [];

      // Load GitHub integrations
      if (scmTypeFilter === 'all' || scmTypeFilter === 'github') {
        try {
          const githubConfig = config.getOptionalConfigArray('integrations.github');
          if (githubConfig) {
            githubConfig.forEach((integration, index) => {
              const host = integration.getString('host');
              availableIntegrations.push({
                id: `github-${host}`,
                type: 'github',
                host,
                apiBaseUrl: integration.getOptionalString('apiBaseUrl'),
                token: integration.has('token') ? '***' : undefined,
              });
            });
          }
        } catch (error) {
          console.warn('Failed to load GitHub integrations:', error);
        }
      }

      // Load GitLab integrations
      if (scmTypeFilter === 'all' || scmTypeFilter === 'gitlab') {
        try {
          const gitlabConfig = config.getOptionalConfigArray('integrations.gitlab');
          if (gitlabConfig) {
            gitlabConfig.forEach((integration, index) => {
              const host = integration.getString('host');
              availableIntegrations.push({
                id: `gitlab-${host}`,
                type: 'gitlab',
                host,
                apiBaseUrl: integration.getOptionalString('apiBaseUrl'),
                token: integration.has('token') ? '***' : undefined,
              });
            });
          }
        } catch (error) {
          console.warn('Failed to load GitLab integrations:', error);
        }
      }

      setIntegrations(availableIntegrations);
    };

    loadIntegrations();
  }, [config, scmTypeFilter]);

  useEffect(() => {
    if (!multiple && selected && typeof selected === 'string') {
      const integration = integrations.find(i => i.id === selected);
      setSelectedIntegration(integration || null);
    } else {
      setSelectedIntegration(null);
    }
  }, [selected, integrations, multiple]);

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as string | string[];
    setSelected(value);

    if (multiple) {
      // For multiple selection, return array of integration details
      const selectedIntegrations = (value as string[]).map(id =>
        integrations.find(i => i.id === id)
      ).filter(Boolean);
      onChange(selectedIntegrations);
    } else {
      // For single selection, return the integration details
      const integration = integrations.find(i => i.id === value);
      onChange(integration || '');
    }
  };

  const renderValue = (value: unknown) => {
    if (multiple && Array.isArray(value)) {
      return (
        <div className={classes.chips}>
          {value.map(id => {
            const integration = integrations.find(i => i.id === id);
            return integration ? (
              <Chip
                key={id}
                label={`${integration.type}: ${integration.host}`}
                className={classes.chip}
                color={integration.type === 'github' ? 'primary' : 'secondary'}
                size="small"
              />
            ) : null;
          })}
        </div>
      );
    }

    if (!multiple && value) {
      const integration = integrations.find(i => i.id === value);
      return integration ? `${integration.type}: ${integration.host}` : '';
    }

    return '';
  };

  return (
    <FormControl
      className={classes.formControl}
      required={required}
      error={rawErrors?.length > 0}
      disabled={disabled}
      fullWidth
    >
      <InputLabel id="scm-integration-picker-label">
        {title || 'SCM Integration'}
      </InputLabel>
      <Select
        labelId="scm-integration-picker-label"
        id="scm-integration-picker"
        multiple={multiple}
        value={selected}
        onChange={handleChange}
        renderValue={renderValue}
      >
        {integrations.length === 0 ? (
          <MenuItem disabled>
            <em>No SCM integrations configured</em>
          </MenuItem>
        ) : (
          integrations.map(integration => (
            <MenuItem key={integration.id} value={integration.id}>
              <Box>
                <Typography variant="body1">
                  <strong>{integration.type.toUpperCase()}</strong>: {integration.host}
                </Typography>
                {integration.apiBaseUrl && (
                  <Typography variant="caption" color="textSecondary">
                    API: {integration.apiBaseUrl}
                  </Typography>
                )}
              </Box>
            </MenuItem>
          ))
        )}
      </Select>
      
      {description && <FormHelperText>{description}</FormHelperText>}
      
      {rawErrors?.length > 0 && (
        <FormHelperText error>{rawErrors[0]}</FormHelperText>
      )}

      {!multiple && selectedIntegration && (
        <Box className={classes.integrationDetails}>
          <Typography variant="caption" color="textSecondary">
            Selected Integration Details:
          </Typography>
          <Typography variant="body2">
            <strong>Type:</strong> {selectedIntegration.type}
          </Typography>
          <Typography variant="body2">
            <strong>Host:</strong> {selectedIntegration.host}
          </Typography>
          {selectedIntegration.apiBaseUrl && (
            <Typography variant="body2">
              <strong>API Base URL:</strong> {selectedIntegration.apiBaseUrl}
            </Typography>
          )}
          {selectedIntegration.token && (
            <Typography variant="body2">
              <strong>Token:</strong> Configured ✓
            </Typography>
          )}
        </Box>
      )}
    </FormControl>
  );
};

