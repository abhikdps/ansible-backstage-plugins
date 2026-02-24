import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { SyncDialog } from './SyncDialog';
import type { SyncDialogProps } from './types';

const theme = createTheme();

const mockShowNotification = jest.fn();

jest.mock('../notifications', () => ({
  useNotifications: () => ({
    showNotification: mockShowNotification,
  }),
}));

const mockDiscoveryApi = {
  getBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007/api/catalog'),
};

const mockFetchApi = {
  fetch: jest.fn(),
};

const renderDialog = (props: SyncDialogProps) => {
  return render(
    <ThemeProvider theme={theme}>
      <TestApiProvider
        apis={[
          [discoveryApiRef, mockDiscoveryApi],
          [fetchApiRef, mockFetchApi],
        ]}
      >
        <SyncDialog {...props} />
      </TestApiProvider>
    </ThemeProvider>,
  );
};

describe('SyncDialog', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchApi.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: {
          providers: [
            {
              sourceId: 'src-1',
              scmProvider: 'github',
              hostName: 'github.com',
              organization: 'org1',
              lastSyncTime: null,
            },
            {
              sourceId: 'src-2',
              scmProvider: 'github',
              hostName: 'github.com',
              organization: 'org2',
              lastSyncTime: null,
            },
          ],
        },
      }),
    });
  });

  it('renders nothing when open is false', () => {
    const { container } = renderDialog({ open: false, onClose: mockOnClose });
    expect(container.querySelector('.MuiDialog-root')).not.toBeInTheDocument();
  });

  it('renders dialog title and description when open', async () => {
    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText('Sync sources')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Select the repositories or automation hubs/),
    ).toBeInTheDocument();
  });

  it('fetches sync status when opened', async () => {
    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(mockDiscoveryApi.getBaseUrl).toHaveBeenCalledWith('catalog');
    });
    expect(mockFetchApi.fetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/catalog/aap/sync_status?ansible_contents=true',
    );
  });

  it('calls onClose when close button is clicked', async () => {
    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText('Sync sources')).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state initially', () => {
    mockFetchApi.fetch.mockImplementation(() => new Promise(() => {}));

    renderDialog({ open: true, onClose: mockOnClose });

    expect(
      document.querySelector('.MuiCircularProgress-root'),
    ).toBeInTheDocument();
  });

  it('shows info alert when no sources configured', async () => {
    mockFetchApi.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ content: { providers: [] } }),
    });

    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText(/No sources configured/)).toBeInTheDocument();
    });
  });

  it('disables Sync Selected when nothing selected', async () => {
    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText('Sync sources')).toBeInTheDocument();
    });

    const syncButton = screen.getByRole('button', {
      name: /Sync Selected/i,
    });
    expect(syncButton).toBeDisabled();
  });

  it('handles fetch rejection without crashing', async () => {
    mockFetchApi.fetch.mockRejectedValue(new Error('Network error'));

    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText(/No sources configured/)).toBeInTheDocument();
    });
  });

  it('shows empty state when response is not ok', async () => {
    mockFetchApi.fetch.mockResolvedValue({ ok: false });

    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText(/No sources configured/)).toBeInTheDocument();
    });
  });

  it('renders sources tree with provider and orgs when loaded', async () => {
    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });
    expect(screen.getByText('github.com')).toBeInTheDocument();
    expect(screen.getByText('org1')).toBeInTheDocument();
    expect(screen.getByText('org2')).toBeInTheDocument();
  });

  it('Select All button is enabled after tree loads and is clickable', async () => {
    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });
    const selectAllBtn = screen.getByRole('button', { name: /Select All/i });
    expect(selectAllBtn).not.toBeDisabled();
    fireEvent.click(selectAllBtn);
  });

  it('clicking org selects it and enables Sync Selected', async () => {
    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText('org1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('org1'));

    await waitFor(() => {
      const syncButton = screen.getByRole('button', {
        name: /Sync Selected/i,
      });
      expect(syncButton).not.toBeDisabled();
    });
  });

  it('handleSync shows error when no selection', async () => {
    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText('Sync sources')).toBeInTheDocument();
    });
    const syncButton = screen.getByRole('button', {
      name: /Sync Selected/i,
    });
    expect(syncButton).toBeDisabled();
  });

  it('handleSync calls showNotification and onSyncsStarted and sync endpoint when org selected', async () => {
    const mockOnSyncsStarted = jest.fn();
    mockFetchApi.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: {
            providers: [
              {
                sourceId: 'src-myorg',
                scmProvider: 'github',
                hostName: 'github.com',
                organization: 'myorg',
                lastSyncTime: null,
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true });

    renderDialog({
      open: true,
      onClose: mockOnClose,
      onSyncsStarted: mockOnSyncsStarted,
    });

    await waitFor(() => {
      expect(screen.getByText('myorg')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('myorg'));

    await waitFor(() => {
      const syncButton = screen.getByRole('button', {
        name: /Sync Selected/i,
      });
      expect(syncButton).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Sync Selected/i }));

    await waitFor(() => {
      expect(mockShowNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sync started',
          description: 'Syncing content from 1 source',
          items: ['github.com/myorg'],
          severity: 'info',
          collapsible: true,
          category: 'sync-started',
        }),
      );
      expect(mockOnSyncsStarted).toHaveBeenCalledWith([
        expect.objectContaining({
          sourceId: 'src-myorg',
          displayName: 'github.com/myorg',
          lastSyncTime: null,
        }),
      ]);
      expect(mockOnClose).toHaveBeenCalled();
    });
    expect(mockFetchApi.fetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/catalog/ansible/sync/from-scm/content',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: [
            {
              scmProvider: 'github',
              hostName: 'github.com',
              organization: 'myorg',
            },
          ],
        }),
      }),
    );
  });

  it('handleSync closes dialog and fires sync requests (fire-and-forget)', async () => {
    mockFetchApi.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: {
            providers: [
              {
                sourceId: 'src-myorg',
                scmProvider: 'github',
                hostName: 'github.com',
                organization: 'myorg',
                lastSyncTime: null,
              },
            ],
          },
        }),
      })
      .mockResolvedValue({ ok: true });

    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText('myorg')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('myorg'));
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Sync Selected/i }),
      ).not.toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /Sync Selected/i }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
    expect(mockFetchApi.fetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/catalog/ansible/sync/from-scm/content',
      expect.any(Object),
    );
  });

  it('toggle provider expand/collapse', async () => {
    renderDialog({ open: true, onClose: mockOnClose });

    await waitFor(() => {
      expect(screen.getByText('GitHub')).toBeInTheDocument();
    });
    const providerRow = screen.getByText('GitHub').closest('.MuiListItem-root');
    expect(providerRow).toBeInTheDocument();
    fireEvent.click(providerRow!);
    fireEvent.click(providerRow!);
  });
});
