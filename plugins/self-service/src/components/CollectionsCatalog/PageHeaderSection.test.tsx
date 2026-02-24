import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import { PageHeaderSection } from './PageHeaderSection';

jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: () => ({ allowed: true }),
}));

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe('PageHeaderSection', () => {
  const mockOnSyncClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Collections title and description', () => {
    renderWithTheme(<PageHeaderSection onSyncClick={mockOnSyncClick} />);

    expect(screen.getByText('Collections')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Browse and discover Ansible collections \(modules, roles and plugins\)/,
      ),
    ).toBeInTheDocument();
  });

  it('renders Sync Now button when allowed', () => {
    renderWithTheme(<PageHeaderSection onSyncClick={mockOnSyncClick} />);

    const syncButton = screen.getByRole('button', { name: /Sync Now/i });
    expect(syncButton).toBeInTheDocument();
  });

  it('calls onSyncClick when Sync Now is clicked', () => {
    renderWithTheme(<PageHeaderSection onSyncClick={mockOnSyncClick} />);

    const syncButton = screen.getByRole('button', { name: /Sync Now/i });
    fireEvent.click(syncButton);

    expect(mockOnSyncClick).toHaveBeenCalledTimes(1);
  });

  it('disables Sync Now when syncDisabled is true', () => {
    renderWithTheme(
      <PageHeaderSection onSyncClick={mockOnSyncClick} syncDisabled />,
    );

    const syncButton = screen.getByRole('button', { name: /Sync Now/i });
    expect(syncButton).toBeDisabled();
  });

  it('renders help icon with tooltip', () => {
    renderWithTheme(<PageHeaderSection onSyncClick={mockOnSyncClick} />);

    expect(
      screen.getByTitle(/An Ansible Collection is a package of reusable/),
    ).toBeInTheDocument();
  });

  it('shows syncDisabledReason in tooltip when sync disabled with reason', () => {
    renderWithTheme(
      <PageHeaderSection
        onSyncClick={mockOnSyncClick}
        syncDisabled
        syncDisabledReason="Sync in progress"
      />,
    );

    const syncButton = screen.getByRole('button', { name: /Sync Now/i });
    expect(syncButton).toBeDisabled();
    expect(screen.getByTitle('Sync in progress')).toBeInTheDocument();
  });
});
