import { useState, useCallback, useEffect, useRef } from 'react';
import { Page, Content, HeaderTabs } from '@backstage/core-components';
import { Box, makeStyles } from '@material-ui/core';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import CategoryOutlinedIcon from '@material-ui/icons/CategoryOutlined';
import TimelineIcon from '@material-ui/icons/Timeline';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { gitRepositoriesViewPermission } from '@ansible/backstage-rhaap-common/permissions';

import {
  useApi,
  useRouteRef,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import {
  useExtensionTabs,
  EXTENSION_POINTS,
  CONTENT_TYPES,
} from '@ansible/backstage-rhaap-extension-api';
import { useSyncStatusPolling } from '../../hooks';
import { SyncDialog } from '../common';
import type { SyncStatusMap, StartedSyncInfo } from '../common';
import {
  NotificationProvider,
  NotificationStack,
  useNotifications,
} from '../notifications';
import { ExtensionTabContent } from '../../extensions/ExtensionRenderer';

import { rootRouteRef } from '../../routes';
import { RepositoriesPageHeaderSection } from './RepositoriesPageHeaderSection';
import { RepositoriesTable } from './RepositoriesTable';
import { RepositoriesCIActivityTab } from './RepositoriesCIActivityTab';
import { RepositoryDetailsPage } from './RepositoryDetailsPage';
import { gitReposCache } from './gitReposCache';

const useStyles = makeStyles(theme => ({
  tabsSection: {
    width: '100%',
    '& .MuiTabs-root': {
      overflow: 'visible',
    },
    '& .MuiTabs-indicator': {
      width: '100vw',
      left: '50% !important',
      marginLeft: '-50vw',
    },
    '& .MuiTab-root': {
      minWidth: 260,
      padding: theme.spacing(2, 5),
      fontSize: 16,
    },
  },
  tabWithIcon: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  tabContent: {
    paddingTop: theme.spacing(3),
  },
}));

const tabs = [
  { id: 0, label: 'Catalog', icon: <CategoryOutlinedIcon />, path: 'catalog' },
  { id: 1, label: 'CI Activity', icon: <TimelineIcon />, path: 'ci-activity' },
];

/** Number of hardcoded built-in tabs. Extension tabs occupy indices ≥ this. */
const GIT_REPO_BUILT_IN_TABS = tabs.length;

const getTabIndexFromPath = (pathname: string): number => {
  if (pathname.includes('/repositories/ci-activity')) return 1;
  return 0;
};

export const GitRepositoriesPage = () => {
  const classes = useStyles();
  const location = useLocation();
  const navigate = useNavigate();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const rootLink = useRouteRef(rootRouteRef);
  const { isSyncInProgress, syncProgress, startTracking } =
    useSyncStatusPolling();

  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const { showNotification } = useNotifications();
  const [hasConfiguredSources, setHasConfiguredSources] = useState<
    boolean | null
  >(null);
  const [syncStatusMap, setSyncStatusMap] = useState<SyncStatusMap>({});
  const prevSyncInProgressRef = useRef(false);

  const selectedTab = getTabIndexFromPath(location.pathname);

  // Extension tabs for the list view. Community plugins register contributions
  // at EXTENSION_POINTS.GIT_REPO_LIST_TABS; they appear after the built-in tabs.
  const extensionTabs = useExtensionTabs(
    EXTENSION_POINTS.GIT_REPO_LIST_TABS,
    undefined,
    CONTENT_TYPES.PLAYBOOK_REPOSITORY,
  );

  // Tracks which extension tab (0-based into extensionTabs) is active.
  // null = a built-in tab is active (URL-driven); number = extension tab active.
  const [activeExtTabIndex, setActiveExtTabIndex] = useState<number | null>(
    null,
  );

  // Reset extension tab selection whenever the URL-driven built-in tab changes
  // (e.g. browser back/forward, sidebar navigation).
  useEffect(() => {
    setActiveExtTabIndex(null);
  }, [location.pathname]);

  const fetchSyncStatus = useCallback(async () => {
    try {
      const baseUrl = await discoveryApi.getBaseUrl('catalog');
      const response = await fetchApi.fetch(
        `${baseUrl}/ansible/sync/status?ansible_contents=true`,
      );
      if (!response.ok) {
        setHasConfiguredSources(false);
        return;
      }
      const data = await response.json();
      const statusMap: SyncStatusMap = {};
      const providers = data.content?.providers || [];
      providers.forEach(
        (provider: {
          sourceId: string;
          lastSyncTime: string | null;
          lastFailedSyncTime: string | null;
        }) => {
          statusMap[provider.sourceId] = {
            lastSyncTime: provider.lastSyncTime,
            lastFailedSyncTime: provider.lastFailedSyncTime,
          };
        },
      );
      setSyncStatusMap(statusMap);
      setHasConfiguredSources(providers.length > 0);
    } catch {
      setHasConfiguredSources(false);
    }
  }, [discoveryApi, fetchApi]);

  useEffect(() => {
    fetchSyncStatus();
  }, [fetchSyncStatus]);

  useEffect(() => {
    if (prevSyncInProgressRef.current && !isSyncInProgress) {
      fetchSyncStatus();
    }
    prevSyncInProgressRef.current = isSyncInProgress;
  }, [isSyncInProgress, fetchSyncStatus]);

  const handleSyncClick = () => setSyncDialogOpen(true);
  const handleSourcesStatusChange = useCallback((status: boolean | null) => {
    setHasConfiguredSources(prev => status ?? prev);
  }, []);
  const handleSyncsStarted = useCallback(
    (syncs: StartedSyncInfo[]) => {
      startTracking(syncs);
    },
    [startTracking],
  );

  const syncDisabled = hasConfiguredSources === false || isSyncInProgress;
  let syncDisabledReason: string | undefined;
  if (hasConfiguredSources === false) {
    syncDisabledReason = 'No content sources configured';
  } else if (isSyncInProgress) {
    syncDisabledReason = 'Sync in progress';
  }

  const onTabSelect = useCallback(
    (index: number) => {
      if (index < GIT_REPO_BUILT_IN_TABS) {
        // Built-in tab: reset extension selection and navigate to the URL route.
        setActiveExtTabIndex(null);
        const tab = tabs[index];
        if (tab) {
          navigate(`${rootLink()}/repositories/${tab.path}`);
        }
      } else {
        // Extension tab: no URL change, just update local state.
        setActiveExtTabIndex(index - GIT_REPO_BUILT_IN_TABS);
      }
    },
    [navigate, rootLink],
  );

  let content: React.ReactNode;
  if (activeExtTabIndex !== null) {
    // Extension tab is active — render its component.
    const extContribution = extensionTabs[activeExtTabIndex];
    content = extContribution ? (
      <ExtensionTabContent
        key={extContribution.id}
        contribution={extContribution}
      />
    ) : null;
  } else if (selectedTab === 1) {
    content = (
      <RepositoriesCIActivityTab
        key="ci-activity"
        cachedEntities={gitReposCache.getState()?.entities}
      />
    );
  } else {
    content = (
      <RepositoriesTable
        key="catalog"
        syncStatusMap={syncStatusMap}
        onSourcesStatusChange={handleSourcesStatusChange}
      />
    );
  }

  // Overall tab index for HeaderTabs: extension tabs sit after built-ins.
  const activeTabIndex =
    activeExtTabIndex !== null
      ? GIT_REPO_BUILT_IN_TABS + activeExtTabIndex
      : selectedTab;

  return (
    <Page themeId="app">
      <Content>
        <RepositoriesPageHeaderSection
          onSyncClick={handleSyncClick}
          syncDisabled={syncDisabled}
          syncDisabledReason={syncDisabledReason}
          syncInProgress={isSyncInProgress}
          syncProgress={syncProgress}
        />
        <Box className={classes.tabsSection}>
          <HeaderTabs
            selectedIndex={activeTabIndex}
            onChange={onTabSelect}
            tabs={
              [
                ...tabs.map(({ label, icon }) => ({
                  id: label.toLowerCase().replaceAll(/\s+/g, '-'),
                  label: (
                    <Box className={classes.tabWithIcon}>
                      {icon}
                      {label}
                    </Box>
                  ),
                })),
                ...extensionTabs.map(et => {
                  const Icon = et.icon;
                  return {
                    id: et.id,
                    label: (
                      <Box className={classes.tabWithIcon}>
                        {Icon && <Icon fontSize="small" />}
                        {et.label}
                      </Box>
                    ),
                  };
                }),
              ] as any
            }
          />
        </Box>
        <Box className={classes.tabContent}>{content}</Box>
      </Content>
      <SyncDialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        onSyncsStarted={handleSyncsStarted}
        showNotification={showNotification}
      />
    </Page>
  );
};

// Inner content component that uses the notification context
const GitRepositoriesRoutesContent = () => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <>
      <Routes>
        <Route index element={<Navigate to="catalog" replace />} />
        <Route path="catalog" element={<GitRepositoriesPage />} />
        <Route path="ci-activity" element={<GitRepositoriesPage />} />
        <Route path=":repositoryName" element={<RepositoryDetailsPage />} />
        <Route path="*" element={<Navigate to="catalog" replace />} />
      </Routes>
      <NotificationStack
        notifications={notifications}
        onClose={removeNotification}
      />
    </>
  );
};

// Standalone route wrapper used by the dynamic plugin mount at /self-service/repositories
// so detail URLs like /self-service/repositories/:repositoryName resolve correctly.
export const GitRepositoriesRoutesPage = () => {
  return (
    <RequirePermission permission={gitRepositoriesViewPermission}>
      <NotificationProvider>
        <GitRepositoriesRoutesContent />
      </NotificationProvider>
    </RequirePermission>
  );
};
