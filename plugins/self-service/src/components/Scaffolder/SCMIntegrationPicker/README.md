# SCMIntegrationPicker Field Extension

A custom field extension for Backstage Software Templates that displays all SCM (Source Control Management) integrations configured in `app-config.yaml` and allows users to select one or more integrations.

## Features

- 🔍 **Auto-discovery**: Automatically discovers all GitHub and GitLab integrations from app-config.yaml
- 🎯 **Filtering**: Filter by SCM type (github, gitlab, or all)
- 📦 **Multiple Selection**: Support for single or multiple integration selection
- 📋 **Rich Details**: Shows host, API base URL, and token status
- 🎨 **Visual Feedback**: Color-coded chips for different SCM types
- ✅ **Validation**: Built-in required field validation

## Usage in Templates

### Basic Usage (Single Selection)

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: example-template
  title: Example Template with SCM Picker
spec:
  parameters:
    - title: Choose SCM Integration
      properties:
        scmIntegration:
          title: SCM Integration
          type: string
          description: Select the SCM integration to use for this repository
          ui:field: SCMIntegrationPicker
```

### Filter by SCM Type

```yaml
parameters:
  - title: Choose GitHub Integration
    properties:
      githubIntegration:
        title: GitHub Integration
        type: string
        description: Select the GitHub integration
        ui:field: SCMIntegrationPicker
        ui:options:
          scmType: github  # Only show GitHub integrations
```

```yaml
parameters:
  - title: Choose GitLab Integration
    properties:
      gitlabIntegration:
        title: GitLab Integration
        type: string
        description: Select the GitLab integration
        ui:field: SCMIntegrationPicker
        ui:options:
          scmType: gitlab  # Only show GitLab integrations
```

### Multiple Selection

```yaml
parameters:
  - title: Choose Multiple SCM Integrations
    properties:
      scmIntegrations:
        title: SCM Integrations
        type: array
        description: Select one or more SCM integrations
        ui:field: SCMIntegrationPicker
```

### Required Field

```yaml
parameters:
  - title: Required SCM Integration
    required:
      - scmIntegration
    properties:
      scmIntegration:
        title: SCM Integration
        type: string
        description: You must select an SCM integration
        ui:field: SCMIntegrationPicker
```

## Configuration

The picker automatically reads from your `app-config.yaml`:

```yaml
integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}
      apiBaseUrl: https://api.github.com
    - host: github.enterprise.example.com
      token: ${GITHUB_ENTERPRISE_TOKEN}
      apiBaseUrl: https://github.enterprise.example.com/api/v3
  gitlab:
    - host: gitlab.com
      token: ${GITLAB_TOKEN}
      apiBaseUrl: https://gitlab.com/api/v4
    - host: gitlab.internal.example.com
      token: ${GITLAB_INTERNAL_TOKEN}
      apiBaseUrl: https://gitlab.internal.example.com/api/v4
```

## Output Format

### Single Selection

When a user selects an integration, the field returns an object with the integration details:

```json
{
  "id": "github-github.com",
  "type": "github",
  "host": "github.com",
  "apiBaseUrl": "https://api.github.com",
  "token": "***"
}
```

### Multiple Selection

For array type, it returns an array of integration objects:

```json
[
  {
    "id": "github-github.com",
    "type": "github",
    "host": "github.com",
    "apiBaseUrl": "https://api.github.com",
    "token": "***"
  },
  {
    "id": "gitlab-gitlab.com",
    "type": "gitlab",
    "host": "gitlab.com",
    "apiBaseUrl": "https://gitlab.com/api/v4",
    "token": "***"
  }
]
```

## Using Selected Integration in Template Steps

You can use the selected integration in your template steps:

```yaml
steps:
  - id: publish
    name: Publish to Repository
    action: publish:github
    input:
      repoUrl: ${{ parameters.scmIntegration.host }}?owner=${{ parameters.owner }}&repo=${{ parameters.repo }}
      token: ${{ secrets[parameters.scmIntegration.id] }}

  - id: log
    name: Log Selected Integration
    action: debug:log
    input:
      message: |
        Selected SCM Integration:
        Type: ${{ parameters.scmIntegration.type }}
        Host: ${{ parameters.scmIntegration.host }}
        API Base URL: ${{ parameters.scmIntegration.apiBaseUrl }}
```

## Schema Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | string/array | string | Use "string" for single selection, "array" for multiple |
| `ui:options.scmType` | string | "all" | Filter integrations by type: "github", "gitlab", or "all" |

## Installation

This field extension is already included in the self-service plugin. No additional installation steps required.

## Example Complete Template

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: create-repo-with-scm-picker
  title: Create Repository with SCM Selection
  description: Create a new repository on your selected SCM platform
spec:
  owner: platform-team
  type: service
  
  parameters:
    - title: Repository Information
      required:
        - name
        - owner
        - scmIntegration
      properties:
        name:
          title: Repository Name
          type: string
          description: Name of the repository
        owner:
          title: Owner
          type: string
          description: Owner/Organization name
        scmIntegration:
          title: SCM Platform
          type: string
          description: Select where to create the repository
          ui:field: SCMIntegrationPicker

  steps:
    - id: log-selection
      name: Log Selected Integration
      action: debug:log
      input:
        message: |
          Creating repository on ${{ parameters.scmIntegration.type }}
          Host: ${{ parameters.scmIntegration.host }}
          
    - id: create-repo
      name: Create Repository
      action: publish:github  # or publish:gitlab based on selection
      input:
        repoUrl: ${{ parameters.scmIntegration.host }}?owner=${{ parameters.owner }}&repo=${{ parameters.name }}
        description: Created via Backstage template
```

## Benefits

1. **User-Friendly**: No need to manually type SCM hosts or URLs
2. **Error Prevention**: Only shows configured integrations, preventing typos
3. **Flexibility**: Works with multiple GitHub/GitLab instances
4. **Enterprise Ready**: Perfect for organizations with multiple SCM platforms
5. **Self-Documenting**: Shows users exactly what integrations are available

## Troubleshooting

### No Integrations Showing

- Verify your `app-config.yaml` has integrations configured under `integrations.github` or `integrations.gitlab`
- Check console for errors during config loading
- Ensure the config API is properly injected

### Token Shows as "undefined"

- This is expected if no token is configured in app-config.yaml
- The picker only shows if a token exists, not the actual token value

### Selection Not Working

- Ensure you're using the correct `type` in your schema (`string` vs `array`)
- Check that the field name matches what you're using in template steps

