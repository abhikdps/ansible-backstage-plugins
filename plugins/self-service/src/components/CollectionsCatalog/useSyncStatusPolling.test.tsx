import { render, screen, waitFor, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import { TestApiProvider } from '@backstage/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { NotificationProvider } from '../notifications';
import { useSyncStatusPolling } from './useSyncStatusPolling';

const theme = createTheme();

const mockDiscoveryApi = {
  getBaseUrl: jest.fn().mockResolvedValue('http://localhost:7007/api/catalog'),
};

const mockFetchApi = {
  fetch: jest.fn(),
};

function TestConsumer() {
  const { isSyncInProgress, startTracking } = useSyncStatusPolling();
  return (
    <div>
      <span data-testid="sync-in-progress">{String(isSyncInProgress)}</span>
      <button
        type="button"
        onClick={() =>
          startTracking([
            {
              sourceId: 'src-1',
              displayName: 'github.com/org1',
              lastSyncTime: null,
            },
          ])
        }
      >
        Start tracking
      </button>
    </div>
  );
}

function renderHook() {
  return render(
    <ThemeProvider theme={theme}>
      <TestApiProvider
        apis={[
          [discoveryApiRef, mockDiscoveryApi],
          [fetchApiRef, mockFetchApi],
        ]}
      >
        <NotificationProvider>
          <TestConsumer />
        </NotificationProvider>
      </TestApiProvider>
    </ThemeProvider>,
  );
}

describe('useSyncStatusPolling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchApi.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: {
          providers: [],
        },
      }),
    });
  });

  it('returns isSyncInProgress false initially', async () => {
    renderHook();

    await waitFor(() => {
      expect(screen.getByTestId('sync-in-progress')).toHaveTextContent('false');
    });
  });

  it('fetches sync status on mount', async () => {
    renderHook();

    await waitFor(() => {
      expect(mockDiscoveryApi.getBaseUrl).toHaveBeenCalledWith('catalog');
    });
    expect(mockFetchApi.fetch).toHaveBeenCalledWith(
      'http://localhost:7007/api/catalog/aap/sync_status?ansible_contents=true',
    );
  });

  it('sets isSyncInProgress true when any provider has syncInProgress', async () => {
    mockFetchApi.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: {
          providers: [
            {
              sourceId: 'src-1',
              syncInProgress: true,
              lastSyncTime: null,
              lastSyncStatus: null,
              collectionsFound: 0,
              collectionsDelta: 0,
            },
          ],
        },
      }),
    });

    renderHook();

    await waitFor(() => {
      expect(screen.getByTestId('sync-in-progress')).toHaveTextContent('true');
    });
  });

  it('startTracking triggers fetch and schedules polling', async () => {
    const { getByText } = renderHook();

    await waitFor(() => {
      expect(mockFetchApi.fetch).toHaveBeenCalled();
    });

    await act(async () => {
      getByText('Start tracking').click();
    });

    await waitFor(() => {
      expect(mockFetchApi.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('returns empty providers when response is not ok', async () => {
    mockFetchApi.fetch.mockResolvedValue({ ok: false });

    renderHook();

    await waitFor(() => {
      expect(screen.getByTestId('sync-in-progress')).toHaveTextContent('false');
    });
  });

  it('returns empty providers when fetch throws', async () => {
    mockFetchApi.fetch.mockRejectedValue(new Error('Network error'));

    renderHook();

    await waitFor(() => {
      expect(screen.getByTestId('sync-in-progress')).toHaveTextContent('false');
    });
  });
});
