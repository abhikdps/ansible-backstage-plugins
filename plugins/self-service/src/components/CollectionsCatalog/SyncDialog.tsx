import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import SyncIcon from '@material-ui/icons/Sync';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import FolderIcon from '@material-ui/icons/Folder';
import LanguageIcon from '@material-ui/icons/Language';
import GitHubIcon from '@material-ui/icons/GitHub';
import CloseIcon from '@material-ui/icons/Close';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import {
  SyncDialogProps,
  SyncFilter,
  SourcesTree,
  StartedSyncInfo,
} from './types';
import { useCollectionsStyles } from './styles';
import { GitLabIcon, RedHatIcon } from './icons';
import { useNotifications } from '../notifications';

interface ProviderInfo {
  sourceId: string;
  repository?: string;
  scmProvider?: string;
  hostName?: string;
  organization?: string;
  lastSyncTime: string | null;
}

const SYNC_STARTED_CATEGORY = 'sync-started';

export const SyncDialog = ({
  open,
  onClose,
  onSyncsStarted,
}: SyncDialogProps) => {
  const classes = useCollectionsStyles();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const { showNotification } = useNotifications();

  const [sourcesTree, setSourcesTree] = useState<SourcesTree>({});
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(),
  );
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const buildSourcesTreeFromProviders = (
    rawProviders: Array<{
      repository?: string;
      scmProvider?: string;
      hostName?: string;
      organization?: string;
    }>,
  ): SourcesTree => {
    const tree: SourcesTree = {};

    rawProviders.forEach(provider => {
      if (provider.repository) {
        if (!tree.pah) {
          tree.pah = {};
        }
        tree.pah[provider.repository] = [];
      } else if (provider.scmProvider && provider.hostName) {
        if (!tree[provider.scmProvider]) {
          tree[provider.scmProvider] = {};
        }
        if (!tree[provider.scmProvider][provider.hostName]) {
          tree[provider.scmProvider][provider.hostName] = [];
        }
        if (
          provider.organization &&
          !tree[provider.scmProvider][provider.hostName].includes(
            provider.organization,
          )
        ) {
          tree[provider.scmProvider][provider.hostName].push(
            provider.organization,
          );
        }
      }
    });

    return tree;
  };

  useEffect(() => {
    if (!open) return;

    const fetchSources = async () => {
      setLoading(true);
      setError(null);
      try {
        const baseUrl = await discoveryApi.getBaseUrl('catalog');
        const response = await fetchApi.fetch(
          `${baseUrl}/ansible/sync/status?ansible_contents=true`,
        );
        if (!response.ok) {
          throw new Error('Failed to fetch sources');
        }
        const data = await response.json();
        const rawProviders = data.content?.providers || [];

        setProviders(rawProviders);

        const builtTree = buildSourcesTreeFromProviders(rawProviders);
        setSourcesTree(builtTree);

        const providerKeys = Object.keys(builtTree);
        setExpandedProviders(new Set(providerKeys));
        const hosts = new Set<string>();
        providerKeys.forEach(provider => {
          Object.keys(builtTree[provider] || {}).forEach(host => {
            hosts.add(`${provider}:${host}`);
          });
        });
        setExpandedHosts(hosts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sources');
      } finally {
        setLoading(false);
      }
    };

    fetchSources();
  }, [open, discoveryApi, fetchApi]);

  const toggleProvider = (provider: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  };

  const toggleHost = (provider: string, host: string) => {
    const key = `${provider}:${host}`;
    setExpandedHosts(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isSelected = (key: string) => selectedItems.has(key);

  const toggleSelection = (key: string, level: 'provider' | 'host' | 'org') => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      const parts = key.split(':');

      if (next.has(key)) {
        next.delete(key);
        if (level === 'provider') {
          const provider = parts[0];
          Object.keys(sourcesTree[provider] || {}).forEach(host => {
            next.delete(`${provider}:${host}`);
            (sourcesTree[provider][host] || []).forEach(org => {
              next.delete(`${provider}:${host}:${org}`);
            });
          });
        } else if (level === 'host') {
          const [provider, host] = parts;
          (sourcesTree[provider]?.[host] || []).forEach(org => {
            next.delete(`${provider}:${host}:${org}`);
          });
        }
      } else {
        next.add(key);
        if (level === 'provider') {
          const provider = parts[0];
          Object.keys(sourcesTree[provider] || {}).forEach(host => {
            next.add(`${provider}:${host}`);
            (sourcesTree[provider][host] || []).forEach(org => {
              next.add(`${provider}:${host}:${org}`);
            });
          });
        } else if (level === 'host') {
          const [provider, host] = parts;
          (sourcesTree[provider]?.[host] || []).forEach(org => {
            next.add(`${provider}:${host}:${org}`);
          });
        }
      }

      return next;
    });
  };

  const getSelectionCounts = (
    key: string,
    level: 'provider' | 'host',
  ): { childrenSelected: number; totalChildren: number } => {
    const parts = key.split(':');
    let childrenSelected = 0;
    let totalChildren = 0;

    if (level === 'provider') {
      const provider = parts[0];
      Object.keys(sourcesTree[provider] || {}).forEach(host => {
        const orgs = sourcesTree[provider][host] || [];
        if (orgs.length === 0) {
          totalChildren++;
          if (selectedItems.has(`${provider}:${host}`)) {
            childrenSelected++;
          }
        } else {
          orgs.forEach(org => {
            totalChildren++;
            if (selectedItems.has(`${provider}:${host}:${org}`)) {
              childrenSelected++;
            }
          });
        }
      });
    } else {
      const [provider, host] = parts;
      const orgs = sourcesTree[provider]?.[host] || [];
      if (orgs.length === 0) {
        totalChildren = 1;
        childrenSelected = selectedItems.has(key) ? 1 : 0;
      } else {
        orgs.forEach(org => {
          totalChildren++;
          if (selectedItems.has(`${provider}:${host}:${org}`)) {
            childrenSelected++;
          }
        });
      }
    }

    return { childrenSelected, totalChildren };
  };

  const getIndeterminate = (
    key: string,
    level: 'provider' | 'host',
  ): boolean => {
    const { childrenSelected, totalChildren } = getSelectionCounts(key, level);
    return childrenSelected > 0 && childrenSelected < totalChildren;
  };

  const areAllChildrenSelected = (
    key: string,
    level: 'provider' | 'host',
  ): boolean => {
    const { childrenSelected, totalChildren } = getSelectionCounts(key, level);
    return totalChildren > 0 && childrenSelected === totalChildren;
  };

  const selectAll = () => {
    const all = new Set<string>();
    Object.keys(sourcesTree).forEach(provider => {
      all.add(provider);
      Object.keys(sourcesTree[provider]).forEach(host => {
        all.add(`${provider}:${host}`);
        const orgs = sourcesTree[provider][host];
        if (orgs.length > 0) {
          orgs.forEach(org => {
            all.add(`${provider}:${host}:${org}`);
          });
        }
      });
    });
    setSelectedItems(all);
  };

  const deselectAll = () => {
    setSelectedItems(new Set());
  };

  const buildFilters = (): SyncFilter[] => {
    const filters: SyncFilter[] = [];
    const processedProviders = new Set<string>();
    const processedHosts = new Set<string>();

    Object.keys(sourcesTree).forEach(provider => {
      if (selectedItems.has(provider)) {
        const allHostsSelected = Object.keys(sourcesTree[provider]).every(
          host => {
            const orgs = sourcesTree[provider][host];
            if (orgs.length === 0) {
              return selectedItems.has(`${provider}:${host}`);
            }
            return orgs.every(org =>
              selectedItems.has(`${provider}:${host}:${org}`),
            );
          },
        );
        if (allHostsSelected) {
          filters.push({ scmProvider: provider });
          processedProviders.add(provider);
        }
      }
    });

    Object.keys(sourcesTree).forEach(provider => {
      if (processedProviders.has(provider)) return;
      Object.keys(sourcesTree[provider]).forEach(host => {
        const hostKey = `${provider}:${host}`;
        const orgs = sourcesTree[provider][host];

        if (orgs.length === 0) {
          if (selectedItems.has(hostKey)) {
            filters.push({
              scmProvider: provider,
              hostName: host,
              organization: host,
            });
            processedHosts.add(hostKey);
          }
          return;
        }

        if (selectedItems.has(hostKey)) {
          const allOrgsSelected = orgs.every(org =>
            selectedItems.has(`${provider}:${host}:${org}`),
          );
          if (allOrgsSelected) {
            filters.push({ scmProvider: provider, hostName: host });
            processedHosts.add(hostKey);
          }
        }
      });
    });

    Object.keys(sourcesTree).forEach(provider => {
      if (processedProviders.has(provider)) return;
      Object.keys(sourcesTree[provider]).forEach(host => {
        const hostKey = `${provider}:${host}`;
        if (processedHosts.has(hostKey)) return;
        const orgs = sourcesTree[provider][host];
        orgs.forEach(org => {
          const orgKey = `${provider}:${host}:${org}`;
          if (selectedItems.has(orgKey)) {
            filters.push({
              scmProvider: provider,
              hostName: host,
              organization: org,
            });
          }
        });
      });
    });

    return filters;
  };

  const handleClose = () => {
    setSelectedItems(new Set());
    setError(null);
    onClose();
  };

  const getSelectedSourceNames = (): string[] => {
    const sourceNames: string[] = [];

    Object.keys(sourcesTree).forEach(provider => {
      Object.keys(sourcesTree[provider]).forEach(host => {
        const orgs = sourcesTree[provider][host];

        if (orgs.length === 0) {
          const hostKey = `${provider}:${host}`;
          if (selectedItems.has(hostKey)) {
            sourceNames.push(provider === 'pah' ? `PAH/${host}` : host);
          }
          return;
        }

        orgs.forEach(org => {
          const orgKey = `${provider}:${host}:${org}`;
          if (selectedItems.has(orgKey)) {
            sourceNames.push(`${host}/${org}`);
          }
        });
      });
    });

    return sourceNames;
  };

  const syncScmSource = async (
    baseUrl: string,
    filter: SyncFilter,
  ): Promise<void> => {
    await fetchApi.fetch(`${baseUrl}/ansible/sync/from-scm/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: [filter] }),
    });
  };

  const syncPahSource = async (
    baseUrl: string,
    repositoryName: string,
  ): Promise<void> => {
    await fetchApi.fetch(`${baseUrl}/ansible/sync/from-aap/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: [{ repository_name: repositoryName }],
      }),
    });
  };

  const findProviderForSelection = (
    scmProvider: string,
    hostName: string,
    organization?: string,
  ): ProviderInfo | undefined => {
    if (scmProvider === 'pah') {
      return providers.find(p => p.repository === hostName);
    }

    return providers.find(
      p =>
        p.scmProvider === scmProvider &&
        p.hostName === hostName &&
        (!organization || p.organization === organization),
    );
  };

  const getFilterDisplayName = (filter: SyncFilter): string => {
    if (filter.organization && filter.hostName) {
      return `${filter.hostName}/${filter.organization}`;
    }
    if (filter.hostName) {
      return filter.hostName;
    }
    if (filter.scmProvider) {
      return filter.scmProvider;
    }
    return 'Unknown source';
  };

  const handleSync = async () => {
    const filters = buildFilters();
    if (filters.length === 0) {
      setError('Please select at least one source to sync');
      return;
    }

    const sourceNames = getSelectedSourceNames();

    showNotification({
      title: 'Sync started',
      description: `Syncing content from ${sourceNames.length} source${sourceNames.length > 1 ? 's' : ''}`,
      items: sourceNames,
      severity: 'info',
      collapsible: true,
      category: SYNC_STARTED_CATEGORY,
      autoHideDuration: 30000,
    });

    const startedSyncs: StartedSyncInfo[] = [];
    const pahFilters = filters.filter(f => f.scmProvider === 'pah');
    const scmFilters = filters.filter(f => f.scmProvider !== 'pah');

    pahFilters.forEach(filter => {
      if (filter.organization) {
        const provider = findProviderForSelection('pah', filter.organization);
        if (provider) {
          startedSyncs.push({
            sourceId: provider.sourceId,
            displayName: `PAH/${filter.organization}`,
            lastSyncTime: provider.lastSyncTime,
          });
        }
      }
    });

    scmFilters.forEach(filter => {
      if (filter.scmProvider && filter.hostName) {
        const provider = findProviderForSelection(
          filter.scmProvider,
          filter.hostName,
          filter.organization,
        );
        if (provider) {
          startedSyncs.push({
            sourceId: provider.sourceId,
            displayName: getFilterDisplayName(filter),
            lastSyncTime: provider.lastSyncTime,
          });
        }
      }
    });

    if (onSyncsStarted && startedSyncs.length > 0) {
      onSyncsStarted(startedSyncs);
    }

    handleClose();
    const baseUrl = await discoveryApi.getBaseUrl('catalog');
    const syncPromises: Promise<void>[] = [];

    pahFilters.forEach(filter => {
      if (filter.organization) {
        syncPromises.push(syncPahSource(baseUrl, filter.organization));
      }
    });

    scmFilters.forEach(filter => {
      syncPromises.push(syncScmSource(baseUrl, filter));
    });

    await Promise.allSettled(syncPromises);
  };

  const hasSelections = selectedItems.size > 0;
  const allSelected =
    Object.keys(sourcesTree).length > 0 &&
    Object.keys(sourcesTree).every(provider =>
      Object.keys(sourcesTree[provider]).every(host =>
        sourcesTree[provider][host].every(org =>
          selectedItems.has(`${provider}:${host}:${org}`),
        ),
      ),
    );

  const renderOrg = (provider: string, host: string, org: string) => {
    const orgKey = `${provider}:${host}:${org}`;

    return (
      <ListItem
        key={orgKey}
        button
        className={classes.orgItem}
        onClick={() => toggleSelection(orgKey, 'org')}
      >
        <ListItemIcon className={classes.checkboxIcon}>
          <Checkbox
            edge="start"
            checked={isSelected(orgKey)}
            color="primary"
            size="small"
          />
        </ListItemIcon>
        <ListItemIcon className={classes.providerIcon}>
          <FolderIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={org} className={classes.treeItemText} />
      </ListItem>
    );
  };

  const renderHost = (provider: string, host: string) => {
    const hostKey = `${provider}:${host}`;
    const orgs = sourcesTree[provider][host] || [];
    const isLeaf = orgs.length === 0;
    const sortedOrgs = [...orgs].sort((a, b) => a.localeCompare(b));

    if (isLeaf) {
      return (
        <ListItem
          key={hostKey}
          button
          className={classes.hostItem}
          onClick={() => toggleSelection(hostKey, 'host')}
        >
          <ListItemIcon className={classes.expandIcon}>
            <Box width={24} />
          </ListItemIcon>
          <ListItemIcon className={classes.checkboxIcon}>
            <Checkbox
              edge="start"
              checked={selectedItems.has(hostKey)}
              onClick={e => {
                e.stopPropagation();
                toggleSelection(hostKey, 'host');
              }}
              color="primary"
              size="small"
            />
          </ListItemIcon>
          <ListItemIcon className={classes.providerIcon}>
            <FolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={host} className={classes.treeItemText} />
        </ListItem>
      );
    }

    return (
      <div key={hostKey}>
        <ListItem
          button
          className={classes.hostItem}
          onClick={() => toggleHost(provider, host)}
        >
          <ListItemIcon className={classes.expandIcon}>
            {expandedHosts.has(hostKey) ? <ExpandLess /> : <ExpandMore />}
          </ListItemIcon>
          <ListItemIcon className={classes.checkboxIcon}>
            <Checkbox
              edge="start"
              checked={areAllChildrenSelected(hostKey, 'host')}
              indeterminate={getIndeterminate(hostKey, 'host')}
              onClick={e => {
                e.stopPropagation();
                toggleSelection(hostKey, 'host');
              }}
              color="primary"
              size="small"
            />
          </ListItemIcon>
          <ListItemIcon className={classes.providerIcon}>
            <LanguageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={host} className={classes.treeItemText} />
        </ListItem>
        <Collapse in={expandedHosts.has(hostKey)} timeout="auto" unmountOnExit>
          <List
            component="div"
            disablePadding
            className={classes.nestedListLevel2}
          >
            {sortedOrgs.map(org => renderOrg(provider, host, org))}
          </List>
        </Collapse>
      </div>
    );
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'github':
        return <GitHubIcon fontSize="small" />;
      case 'gitlab':
        return <GitLabIcon fontSize="small" style={{ color: '#FC6D26' }} />;
      case 'pah':
        return <RedHatIcon fontSize="small" />;
      default:
        return <LanguageIcon fontSize="small" />;
    }
  };

  const getProviderDisplayName = (provider: string): string => {
    switch (provider.toLowerCase()) {
      case 'pah':
        return 'Private Automation Hub';
      case 'github':
        return 'GitHub';
      case 'gitlab':
        return 'GitLab';
      default:
        return provider.toUpperCase();
    }
  };

  const renderProvider = (provider: string) => {
    const sortedHosts = Object.keys(sourcesTree[provider]).sort((a, b) =>
      a.localeCompare(b),
    );

    return (
      <div key={provider}>
        <ListItem
          button
          className={classes.scmProviderItem}
          onClick={() => toggleProvider(provider)}
        >
          <ListItemIcon className={classes.expandIcon}>
            {expandedProviders.has(provider) ? <ExpandLess /> : <ExpandMore />}
          </ListItemIcon>
          <ListItemIcon className={classes.checkboxIcon}>
            <Checkbox
              edge="start"
              checked={areAllChildrenSelected(provider, 'provider')}
              indeterminate={getIndeterminate(provider, 'provider')}
              onClick={e => {
                e.stopPropagation();
                toggleSelection(provider, 'provider');
              }}
              color="primary"
              size="small"
            />
          </ListItemIcon>
          <ListItemIcon className={classes.providerIcon}>
            {getProviderIcon(provider)}
          </ListItemIcon>
          <ListItemText
            primary={getProviderDisplayName(provider)}
            className={classes.treeItemText}
          />
        </ListItem>
        <Collapse
          in={expandedProviders.has(provider)}
          timeout="auto"
          unmountOnExit
        >
          <List
            component="div"
            disablePadding
            className={classes.nestedListLevel1}
          >
            {sortedHosts.map(host => renderHost(provider, host))}
          </List>
        </Collapse>
      </div>
    );
  };

  const renderSourcesTree = (sortedProviders: string[]) => (
    <List className={classes.treeList}>
      {sortedProviders.map(provider => renderProvider(provider))}
    </List>
  );

  const renderDialogContent = () => {
    if (loading) {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight={150}
        >
          <CircularProgress />
        </Box>
      );
    }

    if (Object.keys(sourcesTree).length === 0) {
      return (
        <Alert severity="info">
          No sources configured. Add sources in your app-config to enable sync.
        </Alert>
      );
    }

    const sortedProviders = Object.keys(sourcesTree).sort((a, b) =>
      a.localeCompare(b),
    );

    return (
      <>
        {error && (
          <Alert severity="error" style={{ marginBottom: 16 }}>
            {error}
          </Alert>
        )}
        {renderSourcesTree(sortedProviders)}
      </>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      className={classes.syncDialog}
    >
      <Box className={classes.dialogTitleContainer}>
        <Box>
          <Typography className={classes.dialogTitleText}>
            Sync sources
          </Typography>
          <Typography className={classes.dialogDescription}>
            Select the repositories or automation hubs you want to refresh.
            <br /> This will run a background task to import new content.
          </Typography>
        </Box>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          className={classes.closeButton}
        >
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent className={classes.dialogContent}>
        {renderDialogContent()}
      </DialogContent>
      <DialogActions className={classes.syncDialogActions}>
        <Button
          size="small"
          onClick={allSelected ? deselectAll : selectAll}
          className={classes.selectAllButton}
          disabled={loading || Object.keys(sourcesTree).length === 0}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
        <Button onClick={handleClose} color="default">
          Cancel
        </Button>
        <Button
          onClick={handleSync}
          color="primary"
          variant="contained"
          disabled={!hasSelections || loading}
          startIcon={<SyncIcon />}
        >
          Sync Selected
        </Button>
      </DialogActions>
    </Dialog>
  );
};
