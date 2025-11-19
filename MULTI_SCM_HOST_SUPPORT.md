# Multi-Host SCM Support Fix

## Overview
Fixed the Ansible Backstage scaffolder plugin to properly support **multiple SCM hosts** including Enterprise GitHub, self-hosted GitLab, and other custom Git hosting services. The plugin now automatically matches repository URLs to the correct integration configuration using Backstage's `ScmIntegrations` API.

## What Changed

### Problem Identified
The plugin had two critical issues:
1. **Hardcoded URL patterns** - Only matched `github.com` and `gitlab.com`
2. **Single integration limitation** - Only used the first configured integration, ignoring additional SCM hosts

### Solution Implemented
1. **Added ScmIntegrations to AnsibleConfig** - Stored the full `ScmIntegrations` object to access all configured integrations
2. **Automatic URL Matching** - Used `scmIntegrations.github.byUrl()` and `scmIntegrations.gitlab.byUrl()` to find the correct integration for each repository URL
3. **Dynamic Host Patterns** - Generated regex patterns based on the matched integration's host
4. **Multi-host Support** - Now supports unlimited GitHub and GitLab instances simultaneously

## Configuration Examples

### Multiple GitHub Hosts
```yaml
integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}
      apiBaseUrl: https://api.github.com
    - host: github.enterprise.example.com
      token: ${GITHUB_ENTERPRISE_TOKEN}
      apiBaseUrl: https://github.enterprise.example.com/api/v3
    - host: github.corporate.internal
      token: ${GITHUB_CORPORATE_TOKEN}
      apiBaseUrl: https://github.corporate.internal/api/v3
```

### Multiple GitLab Hosts
```yaml
integrations:
  gitlab:
    - host: gitlab.com
      token: ${GITLAB_TOKEN}
      apiBaseUrl: https://gitlab.com/api/v4
    - host: gitlab.internal.example.com
      token: ${GITLAB_INTERNAL_TOKEN}
      apiBaseUrl: https://gitlab.internal.example.com/api/v4
```

## How It Works

When a repository URL is provided (e.g., `https://github.enterprise.example.com/myorg/myrepo`):

1. **URL Matching**: `scmIntegrations.github.byUrl(url)` finds the matching integration
2. **Configuration Extraction**: Gets the host, token, and apiBaseUrl from the matched integration
3. **API Calls**: Uses the correct credentials and endpoints for that specific host
4. **Error Handling**: Provides clear error messages if no matching integration is found

## Benefits

- ✅ **Multi-host Support** - Use multiple GitHub/GitLab instances simultaneously
- ✅ **Automatic Matching** - No manual configuration per repository needed
- ✅ **Enterprise Ready** - Works with Enterprise GitHub and self-hosted GitLab
- ✅ **Backward Compatible** - Existing single-host configurations continue to work
- ✅ **Better Errors** - Clear messages guide users to fix configuration issues
- ✅ **Flexible** - Works with any Git hosting service that follows standard URL patterns

## Files Modified

1. **plugins/backstage-rhaap-common/src/types/types.ts**
   - Added `scmIntegrations?: ScmIntegrations` to `AnsibleConfig` type

2. **plugins/backstage-rhaap-common/src/AAPClient/utils/config.ts**
   - Store full `ScmIntegrations` object instead of just first integration

3. **plugins/scaffolder-backend-module-backstage-rhaap/src/actions/helpers/useCaseMaker.ts**
   - Added `getGitHubIntegrationForUrl()` and `getGitLabIntegrationForUrl()` helper methods
   - Updated `devfilePushToGithub()` to use `scmIntegrations.github.byUrl()`
   - Updated `devfilePushToGitLab()` to use `scmIntegrations.gitlab.byUrl()`
   - Updated `fetchGithubData()` to accept `repositoryUrl` and match integration
   - Updated `fetchGitLabData()` to accept `repositoryUrl` and match integration
   - Updated `getTemplatesLocation()` to accept and use `repositoryUrl`
   - Updated `getGitLabTemplatesLocation()` to accept and use `repositoryUrl`
   - Updated `pushToGithub()` to match showcase location URL to correct integration
   - Updated `pushToGitLab()` to match showcase location URL to correct integration
   - Updated `createRepositoryIfNotExists()` to use URL matching
   - Updated `createGitLabRepoIfNotExists()` to use URL matching
   - Updated all method calls to pass `repositoryUrl` where needed

4. **plugins/scaffolder-backend-module-backstage-rhaap/src/actions/helpers/useCaseMaker.test.ts**
   - Updated tests to match new error messages

5. **plugins/scaffolder-backend-module-backstage-rhaap/README.md**
   - Added comprehensive documentation with multi-host examples

## Methods Fixed

The following methods now support multiple SCM hosts:

### Devfile Operations
- `devfilePushToGithub()` - Creates devfiles in GitHub repositories
- `devfilePushToGitLab()` - Creates devfiles in GitLab repositories

### Use Case Template Fetching
- `fetchGithubData()` - Fetches data from GitHub API
- `fetchGitLabData()` - Fetches data from GitLab API
- `getTemplatesLocation()` - Gets template locations from GitHub repositories
- `getGitLabTemplatesLocation()` - Gets template locations from GitLab repositories

### Showcase Location Operations
- `pushToGithub()` - Pushes showcase templates to GitHub
- `pushToGitLab()` - Pushes showcase templates to GitLab
- `createRepositoryIfNotExists()` - Creates GitHub repositories if needed
- `createGitLabRepoIfNotExists()` - Creates GitLab repositories if needed

All these methods now use URL matching to find the correct integration configuration automatically.

## Testing

To test the changes:
1. Configure multiple SCM hosts in `app-config.yaml`
2. Create use cases that reference repositories from different hosts
3. Configure showcase location with different hosts
4. Create templates that reference repositories from different hosts
5. Verify devfile creation works with each host
6. Check error messages when no matching integration is found

## Notes

- The `githubIntegration` and `gitlabIntegration` fields in `AnsibleConfig` are kept for backward compatibility
- The plugin uses Backstage's standard `ScmIntegrations` API, following best practices
- All Git operations (clone, push, etc.) already supported custom hosts via the `Git` class
- This fix specifically addresses the devfile push functionality that was previously hardcoded

