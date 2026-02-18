# Private Automation Hub (PAH) Collections API

This document describes the APIs available for syncing Ansible Collections from Private Automation Hub (PAH) into the Backstage catalog.

## Overview

The PAH Collections sync feature allows you to automatically import Ansible Collections from your AAP's Private Automation Hub into Backstage as catalog entities. Collections are fetched from specified PAH repositories and converted into Backstage `Component` entities.

## Configuration

### app-config.yaml

```yaml
ansible:
  rhaap:
    baseUrl: 'https://your-aap-instance.com'  # AAP/PAH base URL
    token: 'your-aap-api-token'                # API token with Galaxy API access
    checkSSL: false                            # SSL verification (set true in production)

catalog:
  providers:
    rhaap:
      development:  # environment name
        orgs: Default
        sync:
          pahCollections:
            enabled: true
            repositories:
              - name: rh-certified        # Red Hat Certified collections
                schedule:
                  frequency: { minutes: 60 }
                  timeout: { minutes: 15 }
              - name: validated           # Validated collections
                schedule:
                  frequency: { minutes: 60 }
                  timeout: { minutes: 15 }
              - name: published           # Community/Published collections
                schedule:
                  frequency: { minutes: 60 }
                  timeout: { minutes: 15 }
```

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `pahCollections.enabled` | boolean | Yes | Enable/disable PAH collections sync |
| `pahCollections.repositories` | array | Yes | List of PAH repositories to sync |
| `pahCollections.repositories[].name` | string | Yes | Repository name (e.g., `rh-certified`, `validated`, `published`) |
| `pahCollections.repositories[].schedule.frequency` | object | Yes | Sync frequency (e.g., `{ minutes: 60 }`) |
| `pahCollections.repositories[].schedule.timeout` | object | Yes | Sync timeout (e.g., `{ minutes: 15 }`) |

---

## REST API Endpoints

Base URL: `http://localhost:7072/api/catalog`

### API Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/aap/sync_orgs_users_teams` | Sync AAP organizations, users, and teams |
| `GET` | `/aap/sync_job_templates` | Sync AAP job templates |
| `GET` | `/aap/sync_status` | Get last sync timestamps |
| `POST` | `/collections/sync/from-pah` | Sync PAH collections |
| `POST` | `/aap/create_user` | Create a single user in catalog |
| `POST` | `/register_ee` | Register an execution environment |

---

### Sync PAH Collections

Triggers a sync of Ansible Collections from PAH repositories.

#### Endpoint

```http
POST /collections/sync/from-pah
```

#### HTTP Method: `POST`

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filters` | array | No | Array of filter objects specifying which repositories to sync. If omitted or empty, syncs all configured repositories. |
| `filters[].repository_name` | string | Yes | Name of the repository to sync. |

#### Examples

**Sync all repositories:**
```bash
curl -X POST http://localhost:7072/api/catalog/collections/sync/from-pah \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{}'
```

**Sync a single repository:**
```bash
curl -X POST http://localhost:7072/api/catalog/collections/sync/from-pah \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"filters": [{"repository_name": "validated"}]}'
```

**Sync multiple specific repositories:**
```bash
curl -X POST http://localhost:7072/api/catalog/collections/sync/from-pah \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"filters": [{"repository_name": "rh-certified"}, {"repository_name": "validated"}]}'
```

#### Response

**Success (200 OK):**
```json
{
  "success": true,
  "providersRun": 3,
  "results": [
    {
      "repositoryName": "rh-certified",
      "providerName": "PAHCollectionProvider:development:rh-certified",
      "success": true,
      "collectionsCount": 156
    },
    {
      "repositoryName": "validated",
      "providerName": "PAHCollectionProvider:development:validated",
      "success": true,
      "collectionsCount": 42
    },
    {
      "repositoryName": "published",
      "providerName": "PAHCollectionProvider:development:published",
      "success": true,
      "collectionsCount": 89
    }
  ]
}
```

**Partial Success (207 Multi-Status):**
```json
{
  "success": false,
  "providersRun": 3,
  "results": [
    {
      "repositoryName": "rh-certified",
      "providerName": "PAHCollectionProvider:development:rh-certified",
      "success": true,
      "collectionsCount": 156
    },
    {
      "repositoryName": "validated",
      "providerName": "PAHCollectionProvider:development:validated",
      "success": false,
      "collectionsCount": 0
    }
  ],
  "failedRepositories": ["validated"]
}
```

**Invalid Repository (400 Bad Request):**
```json
{
  "success": false,
  "error": "No provider found for repository name(s): invalid-repo",
  "notFound": ["invalid-repo"]
}
```

---

## Data Flow

```
┌─────────────────────┐     ┌──────────────────────────────────────┐
│   Backstage API     │     │     AAP / Private Automation Hub     │
│                     │     │                                      │
│  /aap/sync_pah_     │────▶│  GET /api/galaxy/pulp/api/v3/        │
│  collections        │     │      repositories?name={repo}        │
│                     │     │      (Validate repository exists)    │
│                     │     │                                      │
│                     │────▶│  GET /api/galaxy/v3/plugin/ansible/  │
│                     │     │      search/collection-versions/     │
│                     │     │      ?repository_name={repo}         │
│                     │     │      (Fetch collections list)        │
│                     │     │                                      │
│                     │────▶│  GET {pulp_href}                     │
│                     │     │      (Fetch collection details:      │
│                     │     │       README, authors)               │
└─────────────────────┘     └──────────────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  Backstage Catalog  │
│                     │
│  Creates Component  │
│  entities for each  │
│  collection         │
└─────────────────────┘
```

---

## Collection Entity Schema

Each synced collection becomes a Backstage `Component` entity:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ansible-posix                    # {namespace}-{name}
  title: ansible.posix
  description: "Ansible POSIX collection"
  annotations:
    backstage.io/managed-by-location: PAHCollectionProvider:development:validated
    backstage.io/managed-by-origin-location: PAHCollectionProvider:development:validated
  tags:
    - posix
    - linux
  links:
    - url: https://your-aap.com/content/collections/ansible/posix/
      title: View in Automation Hub
spec:
  type: ansible-collection
  lifecycle: production
  owner: guests
  system: ansible-collections
```

### Entity Fields Mapping

| Collection Field | Entity Field |
|-----------------|--------------|
| `namespace` | `metadata.name` prefix |
| `name` | `metadata.name` suffix |
| `description` | `metadata.description` |
| `tags` | `metadata.tags` |
| `version` | `metadata.annotations` |
| `authors` | `metadata.annotations` |
| `repository_name` | Location key |
| `collection_readme_html` | Stored for display |

---

## Common PAH Repository Names

| Repository | Description |
|------------|-------------|
| `rh-certified` | Red Hat Certified Ansible Content Collections |
| `validated` | Ansible validated content |
| `published` | Community/published collections |
| `community` | Community collections (if configured) |

> **Note:** Repository names must match exactly with what's configured in your PAH instance.

---

## Troubleshooting

### Verify PAH is Accessible

```bash
# Check if Galaxy API is available
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-aap.com/api/galaxy/pulp/api/v3/repositories/"

# List available repositories
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-aap.com/api/galaxy/pulp/api/v3/repositories/" | jq '.results[].name'

# Test fetching collections from a repository
curl -k -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-aap.com/api/galaxy/v3/plugin/ansible/search/collection-versions/?repository_name=validated&limit=5"
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `Repository 'X' is not a valid PAH repository` | Repository doesn't exist in PAH | Verify repository name in PAH UI |
| `No provider found for repository name(s)` | Repository not configured in app-config | Add repository to `pahCollections.repositories` |
| `401 Unauthorized` | Invalid or expired token | Update `ansible.rhaap.token` |
| `SSL certificate error` | Self-signed certificate | Set `ansible.rhaap.checkSSL: false` |

---

## All Available API Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok"
}
```

---

### Sync Organizations, Users & Teams

```http
GET /aap/sync_orgs_users_teams
```

Triggers a sync of AAP organizations, users, and teams into the Backstage catalog.

**Response:**
```json
true
```

---

### Sync Job Templates

```http
GET /aap/sync_job_templates
```

Triggers a sync of AAP job templates into the Backstage catalog.

**Response:**
```json
true
```

---

### Get Sync Status

```http
GET /aap/sync_status?aap_entities=true
```

Returns the sync status for all sync providers, including last sync timestamps and whether a sync is currently in progress.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `aap_entities` | boolean | Yes | Must be `true` to get sync status |

**Response:**
```json
{
  "aap": {
    "orgsUsersTeams": { "lastSync": "2025-02-05T10:30:00.000Z" },
    "jobTemplates": { "lastSync": "2025-02-05T10:30:00.000Z" }
  },
  "content": {
    "contentSyncInProgress": true,
    "sources": {
      "pah:validated": {
        "lastSync": "2025-02-05T10:35:00.000Z",
        "isSyncing": false,
        "type": "pah"
      },
      "pah:rh-certified": {
        "lastSync": null,
        "isSyncing": true,
        "type": "pah"
      }
    }
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `aap.orgsUsersTeams.lastSync` | string \| null | ISO timestamp of last successful orgs/users/teams sync |
| `aap.jobTemplates.lastSync` | string \| null | ISO timestamp of last successful job templates sync |
| `content.contentSyncInProgress` | boolean | `true` if any content provider is currently syncing |
| `content.sources` | object | Map of source ID to sync status for each content provider |
| `content.sources[key].lastSync` | string \| null | ISO timestamp of last successful sync for this source |
| `content.sources[key].isSyncing` | boolean | `true` if this source is currently syncing |
| `content.sources[key].type` | string | Source type: `"pah"` for PAH collections, `"scm"` for SCM (future) |

**Note:** Source keys follow the format `{type}:{name}` (e.g., `pah:validated`, `pah:rh-certified`). Use `contentSyncInProgress` for a quick check, or inspect individual sources for detailed status.

---

### Create User

```http
POST /aap/create_user
Content-Type: application/json
```

Creates a single user in the Backstage catalog.

**Request Body:**
```json
{
  "username": "john.doe",
  "userID": 123
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": "john.doe",
  "created": true
}
```

**Response (Error - 400):**
```json
{
  "error": "Missing username and user id in request body."
}
```

---

### Register Execution Environment

```http
POST /register_ee
Content-Type: application/json
```

Registers an execution environment entity in the Backstage catalog.

**Request Body:**
```json
{
  "entity": {
    "apiVersion": "backstage.io/v1alpha1",
    "kind": "Component",
    "metadata": {
      "name": "my-execution-environment",
      "description": "Custom EE for automation"
    },
    "spec": {
      "type": "execution-environment",
      "lifecycle": "production",
      "owner": "team-a"
    }
  }
}
```

**Response (Success):**
```json
{
  "success": true
}
```

**Response (Error - 400):**
```json
{
  "error": "Missing entity in request body."
}
```
