# SCMIntegrationPicker Field Extension - Complete Guide

A custom field extension for Backstage Software Templates that automatically discovers and displays all SCM integrations from your `app-config.yaml`.

## 🎯 Overview

The `SCMIntegrationPicker` provides an intuitive dropdown that:
- ✅ Auto-discovers all GitHub and GitLab integrations from configuration
- ✅ Supports single or multiple selection
- ✅ Filters by SCM type (GitHub, GitLab, or both)
- ✅ Shows rich integration details (host, API URL, token status)
- ✅ Returns structured data for easy use in template steps
- ✅ Validates required fields

## 📦 Installation

The field extension is already included in the self-service plugin. It's automatically registered when you use the plugin.

### Verification

To verify it's available, check that your app includes the self-service plugin extensions:

```typescript
// In packages/app/src/App.tsx or similar
import { SCMIntegrationPickerExtension } from '@ansible/plugin-self-service';

// The extension is automatically available in templates
```

## 🚀 Quick Start

### Basic Example

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: my-template
spec:
  parameters:
    - title: SCM Selection
      required:
        - scmIntegration
      properties:
        scmIntegration:
          title: SCM Integration
          type: string
          ui:field: SCMIntegrationPicker
  
  steps:
    - id: log
      name: Log Selection
      action: debug:log
      input:
        message: |
          Selected: ${{ parameters.scmIntegration.type }} at ${{ parameters.scmIntegration.host }}
```

## 📖 Usage Examples

### 1. Single Selection (All SCM Types)

```yaml
parameters:
  - title: Choose SCM
    properties:
      scmIntegration:
        title: SCM Integration
        type: string
        description: Select your SCM platform
        ui:field: SCMIntegrationPicker
```

**Output:**
```json
{
  "id": "github-github.com",
  "type": "github",
  "host": "github.com",
  "apiBaseUrl": "https://api.github.com",
  "token": "***"
}
```

### 2. Filter by GitHub Only

```yaml
parameters:
  - title: GitHub Selection
    properties:
      githubIntegration:
        title: GitHub Integration
        type: string
        ui:field: SCMIntegrationPicker
        ui:options:
          scmType: github  # Only shows GitHub integrations
```

### 3. Filter by GitLab Only

```yaml
parameters:
  - title: GitLab Selection
    properties:
      gitlabIntegration:
        title: GitLab Integration
        type: string
        ui:field: SCMIntegrationPicker
        ui:options:
          scmType: gitlab  # Only shows GitLab integrations
```

### 4. Multiple Selection

```yaml
parameters:
  - title: Multiple SCM Platforms
    properties:
      scmIntegrations:
        title: SCM Integrations
        type: array  # Array enables multiple selection
        ui:field: SCMIntegrationPicker
```

**Output:**
```json
[
  {
    "id": "github-github.com",
    "type": "github",
    "host": "github.com"
  },
  {
    "id": "gitlab-gitlab.com",
    "type": "gitlab",
    "host": "gitlab.com"
  }
]
```

### 5. Required Field with Validation

```yaml
parameters:
  - title: SCM Selection
    required:
      - scmIntegration  # Makes field required
    properties:
      scmIntegration:
        title: SCM Integration  
        type: string
        ui:field: SCMIntegrationPicker
```

## 🔧 Configuration

### App Config Setup

The picker reads from your `app-config.yaml`:

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

## 🎨 UI Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scmType` | string | `"all"` | Filter integrations: `"github"`, `"gitlab"`, or `"all"` |

Example:
```yaml
ui:field: SCMIntegrationPicker
ui:options:
  scmType: github  # Only show GitHub integrations
```

## 📊 Output Format

### Single Selection Object

```json
{
  "id": "github-github.com",
  "type": "github",
  "host": "github.com",
  "apiBaseUrl": "https://api.github.com",
  "token": "***"
}
```

### Properties

- `id`: Unique identifier (format: `{type}-{host}`)
- `type`: SCM type (`"github"` or `"gitlab"`)
- `host`: Hostname of the SCM server
- `apiBaseUrl`: API endpoint URL (optional)
- `token`: Indicates if token is configured (`"***"` if present, `undefined` if not)

## 🔄 Using in Template Steps

### Conditional Logic by SCM Type

```yaml
steps:
  - id: publish-github
    name: Publish to GitHub
    if: ${{ parameters.scmIntegration.type === 'github' }}
    action: publish:github
    input:
      repoUrl: ${{ parameters.scmIntegration.host }}?owner=${{ parameters.owner }}&repo=${{ parameters.repo }}

  - id: publish-gitlab
    name: Publish to GitLab
    if: ${{ parameters.scmIntegration.type === 'gitlab' }}
    action: publish:gitlab
    input:
      repoUrl: ${{ parameters.scmIntegration.host }}?owner=${{ parameters.owner }}&repo=${{ parameters.repo }}
```

### Dynamic Repository URL

```yaml
steps:
  - id: log-url
    name: Log Repository URL
    action: debug:log
    input:
      message: |
        Repository: https://${{ parameters.scmIntegration.host }}/${{ parameters.owner }}/${{ parameters.repo }}
        API: ${{ parameters.scmIntegration.apiBaseUrl }}
```

### Using with Multiple Integrations

```yaml
steps:
  - id: process-integrations
    name: Process Each Integration
    action: debug:log
    input:
      listWorkflows: true
      logLevel: info
      extra:
        integrations: ${{ parameters.scmIntegrations }}
```

## 🎯 Real-World Example

Complete template for creating a repository with SCM selection:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: create-repository
  title: Create Repository on Selected SCM
  description: Create a new repository on your choice of GitHub or GitLab
spec:
  owner: platform-team
  type: service
  
  parameters:
    - title: SCM Selection
      required:
        - scmIntegration
      properties:
        scmIntegration:
          title: SCM Platform
          type: string
          description: Choose where to create the repository
          ui:field: SCMIntegrationPicker

    - title: Repository Information
      required:
        - name
        - owner
      properties:
        name:
          title: Repository Name
          type: string
          description: Name for the new repository
        owner:
          title: Owner/Organization
          type: string
          description: Owner or organization name
        description:
          title: Description
          type: string
          description: Repository description

  steps:
    - id: validate
      name: Validate Selection
      action: debug:log
      input:
        message: |
          Creating repository on ${{ parameters.scmIntegration.type }}
          Host: ${{ parameters.scmIntegration.host }}

    - id: create-github
      if: ${{ parameters.scmIntegration.type === 'github' }}
      name: Create GitHub Repository
      action: publish:github
      input:
        repoUrl: ${{ parameters.scmIntegration.host }}?owner=${{ parameters.owner }}&repo=${{ parameters.name }}
        description: ${{ parameters.description }}
        defaultBranch: main

    - id: create-gitlab
      if: ${{ parameters.scmIntegration.type === 'gitlab' }}
      name: Create GitLab Repository
      action: publish:gitlab
      input:
        repoUrl: ${{ parameters.scmIntegration.host }}?owner=${{ parameters.owner }}&repo=${{ parameters.name }}
        description: ${{ parameters.description }}
        defaultBranch: main

  output:
    links:
      - title: Repository
        url: https://${{ parameters.scmIntegration.host }}/${{ parameters.owner }}/${{ parameters.name }}
```

## 🐛 Troubleshooting

### Issue: No Integrations Showing

**Solution:**
1. Verify `app-config.yaml` has integrations configured:
   ```yaml
   integrations:
     github:
       - host: github.com
         token: ${GITHUB_TOKEN}
   ```
2. Check browser console for errors
3. Ensure the config API is properly injected

### Issue: Selected Value Not Available in Steps

**Solution:**
- Access properties using dot notation: `${{ parameters.scmIntegration.host }}`
- Verify the parameter name matches your schema

### Issue: Filter Not Working

**Solution:**
- Ensure `ui:options` is properly indented:
  ```yaml
  ui:field: SCMIntegrationPicker
  ui:options:
    scmType: github
  ```

## 🎓 Best Practices

1. **Always add descriptions** to help users understand what they're selecting
2. **Use required fields** for critical selections
3. **Filter by type** when you know you need a specific SCM
4. **Validate in steps** before using the integration
5. **Handle both GitHub and GitLab** with conditional steps

## 📚 Additional Resources

- [Example Template](../../examples/scm-integration-picker-template.yaml)
- [Backstage Template Documentation](https://backstage.io/docs/features/software-templates/)
- [Custom Field Extensions Guide](https://backstage.io/docs/features/software-templates/writing-custom-field-extensions)

## 🤝 Contributing

Found a bug or have a feature request? Please open an issue in the repository.

