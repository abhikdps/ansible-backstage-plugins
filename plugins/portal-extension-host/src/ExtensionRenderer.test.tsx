import { render, screen, fireEvent } from '@testing-library/react';
import {
  ExtensionTabContent,
  ExtensionCardContent,
  ExtensionActionMenuItem,
  useActionActivation,
} from './ExtensionRenderer';
import type {
  TabContribution,
  CardContribution,
  ActionContribution,
} from '@ansible/portal-extension-api';
import { renderHook } from '@testing-library/react';

// ── Mock Backstage hooks ──────────────────────────────────────────────────────

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: unknown[]) => mockUsePermission(...args),
}));

const mockGetApi = jest.fn();
jest.mock('@backstage/core-plugin-api', () => ({
  useApiHolder: () => ({ get: mockGetApi }),
}));

// ── Test fixtures ─────────────────────────────────────────────────────────────

const TabComp = () => <div>tab content</div>;
const CardComp = () => <div>card content</div>;

const mockPermission = { type: 'basic', name: 'test.permission' } as any;
const entity = { kind: 'Component', metadata: { name: 'my-entity' } } as any;

const makeTab = (
  overrides: Partial<TabContribution> = {},
): TabContribution => ({
  id: 'test-tab',
  label: 'Test Tab',
  component: TabComp,
  ...overrides,
});

const makeCard = (
  overrides: Partial<CardContribution> = {},
): CardContribution => ({
  id: 'test-card',
  slot: 'overview-left',
  component: CardComp,
  ...overrides,
});

const makeAction = (
  overrides: Partial<ActionContribution> = {},
): ActionContribution => ({
  id: 'test-action',
  label: 'Run Action',
  onActivate: jest.fn(),
  ...overrides,
});

// ── ExtensionTabContent ───────────────────────────────────────────────────────

describe('ExtensionTabContent', () => {
  beforeEach(() => {
    mockUsePermission.mockReturnValue({ loading: false, allowed: true });
  });

  it('renders the tab component when no permission is required', () => {
    render(<ExtensionTabContent contribution={makeTab()} />);
    expect(screen.getByText('tab content')).toBeInTheDocument();
  });

  it('renders the tab component when permission is granted', () => {
    mockUsePermission.mockReturnValue({ loading: false, allowed: true });
    render(
      <ExtensionTabContent
        contribution={makeTab({ permission: mockPermission })}
      />,
    );
    expect(screen.getByText('tab content')).toBeInTheDocument();
  });

  it('returns null when permission is denied', () => {
    mockUsePermission.mockReturnValue({ loading: false, allowed: false });
    const { container } = render(
      <ExtensionTabContent
        contribution={makeTab({ permission: mockPermission })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('passes the entity prop to the tab component', () => {
    const EntityTab = ({ entity: e }: { entity?: typeof entity }) => (
      <div>entity: {e?.metadata.name}</div>
    );
    render(
      <ExtensionTabContent
        contribution={makeTab({ component: EntityTab as any })}
        entity={entity}
      />,
    );
    expect(screen.getByText('entity: my-entity')).toBeInTheDocument();
  });
});

// ── ExtensionCardContent ──────────────────────────────────────────────────────

describe('ExtensionCardContent', () => {
  beforeEach(() => {
    mockUsePermission.mockReturnValue({ loading: false, allowed: true });
  });

  it('renders the card component when no permission is required', () => {
    render(<ExtensionCardContent contribution={makeCard()} />);
    expect(screen.getByText('card content')).toBeInTheDocument();
  });

  it('returns null when permission is denied', () => {
    mockUsePermission.mockReturnValue({ loading: false, allowed: false });
    const { container } = render(
      <ExtensionCardContent
        contribution={makeCard({ permission: mockPermission })}
        entity={entity}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ── useActionActivation ───────────────────────────────────────────────────────

describe('useActionActivation', () => {
  beforeEach(() => {
    mockUsePermission.mockReturnValue({ loading: false, allowed: true });
    mockGetApi.mockReturnValue({ someApi: true });
  });

  it('returns a function when permission is granted', () => {
    const { result } = renderHook(() =>
      useActionActivation(makeAction(), entity),
    );
    expect(typeof result.current).toBe('function');
  });

  it('returns null when permission is denied', () => {
    mockUsePermission.mockReturnValue({ loading: false, allowed: false });
    const { result } = renderHook(() =>
      useActionActivation(makeAction({ permission: mockPermission }), entity),
    );
    expect(result.current).toBeNull();
  });

  it('calls onActivate with entity and getApi when invoked', () => {
    const onActivate = jest.fn();
    const { result } = renderHook(() =>
      useActionActivation(makeAction({ onActivate }), entity),
    );
    result.current?.();
    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({ entity }),
    );
  });
});

// ── ExtensionActionMenuItem ───────────────────────────────────────────────────

describe('ExtensionActionMenuItem', () => {
  const onMenuClose = jest.fn();

  beforeEach(() => {
    mockUsePermission.mockReturnValue({ loading: false, allowed: true });
    onMenuClose.mockClear();
  });

  it('renders the menu item label', () => {
    render(
      <ExtensionActionMenuItem
        contribution={makeAction()}
        entity={entity}
        onMenuClose={onMenuClose}
      />,
    );
    expect(screen.getByText('Run Action')).toBeInTheDocument();
  });

  it('returns null when permission is denied', () => {
    mockUsePermission.mockReturnValue({ loading: false, allowed: false });
    const { container } = render(
      <ExtensionActionMenuItem
        contribution={makeAction({ permission: mockPermission })}
        entity={entity}
        onMenuClose={onMenuClose}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onActivate and onMenuClose when clicked', () => {
    const onActivate = jest.fn();
    render(
      <ExtensionActionMenuItem
        contribution={makeAction({ onActivate })}
        entity={entity}
        onMenuClose={onMenuClose}
      />,
    );
    fireEvent.click(screen.getByText('Run Action'));
    expect(onMenuClose).toHaveBeenCalled();
  });
});
