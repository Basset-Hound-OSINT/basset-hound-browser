import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MonitorList from '../../src/components/MonitorList';
import AlertPanel from '../../src/components/AlertPanel';
import ChangeTimeline from '../../src/components/ChangeTimeline';
import ComparisonView from '../../src/components/ComparisonView';

describe('Component Tests', () => {
  describe('MonitorList', () => {
    const mockMonitors = [
      {
        id: '1',
        name: 'Amazon',
        url: 'https://amazon.com',
        status: 'active',
        changeCount: 5,
        alertCount: 2,
      },
      {
        id: '2',
        name: 'eBay',
        url: 'https://ebay.com',
        status: 'active',
        changeCount: 3,
        alertCount: 1,
      },
    ];

    test('renders monitor list', () => {
      render(<MonitorList monitors={mockMonitors} />);
      expect(screen.getByText('Amazon')).toBeInTheDocument();
      expect(screen.getByText('eBay')).toBeInTheDocument();
    });

    test('displays monitor count', () => {
      render(<MonitorList monitors={mockMonitors} />);
      expect(screen.getByText('2 monitors')).toBeInTheDocument();
    });

    test('filters monitors by search text', async () => {
      const user = userEvent.setup();
      render(<MonitorList monitors={mockMonitors} />);

      const searchInput = screen.getByPlaceholderText('Search monitors...');
      await user.type(searchInput, 'Amazon');

      expect(screen.getByText('Amazon')).toBeInTheDocument();
      expect(screen.queryByText('eBay')).not.toBeInTheDocument();
    });

    test('calls onEdit when edit button is clicked', async () => {
      const user = userEvent.setup();
      const onEdit = jest.fn();
      render(<MonitorList monitors={mockMonitors} onEdit={onEdit} />);

      const editButtons = screen.getAllByText('Edit');
      await user.click(editButtons[0]);

      expect(onEdit).toHaveBeenCalledWith(mockMonitors[0]);
    });

    test('renders empty state when no monitors', () => {
      render(<MonitorList monitors={[]} />);
      expect(screen.getByText('No monitors found')).toBeInTheDocument();
    });
  });

  describe('AlertPanel', () => {
    const mockAlerts = [
      {
        id: '1',
        title: 'Price Change Detected',
        severity: 'high',
        type: 'change_detected',
        read: false,
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        title: 'Site Down',
        severity: 'critical',
        type: 'error',
        read: true,
        timestamp: new Date().toISOString(),
      },
    ];

    test('renders alert list', () => {
      render(<AlertPanel alerts={mockAlerts} />);
      expect(screen.getByText('Price Change Detected')).toBeInTheDocument();
      expect(screen.getByText('Site Down')).toBeInTheDocument();
    });

    test('displays unread count', () => {
      render(<AlertPanel alerts={mockAlerts} />);
      expect(screen.getByText('1 unread')).toBeInTheDocument();
    });

    test('filters alerts by severity', async () => {
      const user = userEvent.setup();
      render(<AlertPanel alerts={mockAlerts} />);

      const severityFilter = screen.getByDisplayValue('All Severities');
      await user.selectOptions(severityFilter, 'critical');

      expect(screen.getByText('Site Down')).toBeInTheDocument();
      expect(screen.queryByText('Price Change Detected')).not.toBeInTheDocument();
    });

    test('calls onMarkRead when read button is clicked', async () => {
      const user = userEvent.setup();
      const onMarkRead = jest.fn();
      render(<AlertPanel alerts={mockAlerts} onMarkRead={onMarkRead} />);

      const readButtons = screen.getAllByTitle('Mark as read');
      await user.click(readButtons[0]);

      expect(onMarkRead).toHaveBeenCalledWith('1');
    });

    test('renders empty state when no alerts', () => {
      render(<AlertPanel alerts={[]} />);
      expect(screen.getByText('No alerts')).toBeInTheDocument();
    });
  });

  describe('ChangeTimeline', () => {
    const mockChanges = [
      {
        id: '1',
        description: 'Price updated',
        severity: 'medium',
        type: 'price_change',
        timestamp: new Date().toISOString(),
        monitorName: 'Amazon',
        category: 'pricing',
      },
      {
        id: '2',
        description: 'Content updated',
        severity: 'low',
        type: 'content_change',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        monitorName: 'Amazon',
        category: 'content',
      },
    ];

    test('renders change timeline', () => {
      render(<ChangeTimeline changes={mockChanges} />);
      expect(screen.getByText('Price updated')).toBeInTheDocument();
      expect(screen.getByText('Content updated')).toBeInTheDocument();
    });

    test('displays change count', () => {
      render(<ChangeTimeline changes={mockChanges} />);
      expect(screen.getByText('2 changes')).toBeInTheDocument();
    });

    test('expands change details on click', async () => {
      const user = userEvent.setup();
      render(<ChangeTimeline changes={mockChanges} />);

      const expandButtons = screen.getAllByRole('button', { name: /▶/i });
      await user.click(expandButtons[0]);

      expect(screen.getByText('Amazon')).toBeInTheDocument();
    });

    test('renders empty state when no changes', () => {
      render(<ChangeTimeline changes={[]} />);
      expect(screen.getByText('No changes found')).toBeInTheDocument();
    });
  });

  describe('ComparisonView', () => {
    const mockMonitors = [
      {
        id: '1',
        name: 'Amazon',
        status: 'active',
        changeCount: 5,
        alertCount: 2,
      },
      {
        id: '2',
        name: 'eBay',
        status: 'active',
        changeCount: 3,
        alertCount: 1,
      },
    ];

    test('renders comparison view', () => {
      render(<ComparisonView monitors={mockMonitors} />);
      expect(screen.getByText('Competitor Comparison')).toBeInTheDocument();
    });

    test('allows selecting monitors', async () => {
      const user = userEvent.setup();
      render(<ComparisonView monitors={mockMonitors} />);

      const amazonCheckbox = screen.getByRole('checkbox', { name: /Amazon/i });
      await user.click(amazonCheckbox);

      expect(amazonCheckbox).toBeChecked();
    });

    test('shows comparison table when monitors are selected', async () => {
      const user = userEvent.setup();
      render(<ComparisonView monitors={mockMonitors} />);

      const amazonCheckbox = screen.getByRole('checkbox', { name: /Amazon/i });
      await user.click(amazonCheckbox);

      expect(screen.getByText('Changes Detected')).toBeInTheDocument();
    });

    test('limits selection to 4 monitors', async () => {
      const user = userEvent.setup();
      const manyMonitors = Array.from({ length: 6 }, (_, i) => ({
        id: String(i + 1),
        name: `Monitor ${i + 1}`,
        status: 'active',
        changeCount: 0,
        alertCount: 0,
      }));

      render(<ComparisonView monitors={manyMonitors} />);

      for (let i = 0; i < 4; i++) {
        const checkbox = screen.getAllByRole('checkbox')[i];
        await user.click(checkbox);
      }

      // Fifth checkbox should be disabled
      const fifthCheckbox = screen.getAllByRole('checkbox')[4];
      expect(fifthCheckbox).toBeDisabled();
    });
  });
});
