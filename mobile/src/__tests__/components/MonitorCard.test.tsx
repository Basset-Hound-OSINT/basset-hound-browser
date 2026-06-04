/**
 * MonitorCard Component Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MonitorCard } from '../../components/MonitorCard';

describe('MonitorCard Component', () => {
  const mockProps = {
    id: 'monitor-1',
    name: 'Example Monitor',
    url: 'https://example.com',
    status: 'active' as const,
    lastCheck: Date.now() - 60000,
    changeCount: 5,
    alertCount: 2,
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render monitor card with correct data', () => {
    const { getByText } = render(<MonitorCard {...mockProps} />);

    expect(getByText('Example Monitor')).toBeTruthy();
    expect(getByText('https://example.com')).toBeTruthy();
    expect(getByText('active')).toBeTruthy();
  });

  it('should display change count', () => {
    const { getByText } = render(<MonitorCard {...mockProps} />);

    expect(getByText('5')).toBeTruthy();
    expect(getByText('Changes')).toBeTruthy();
  });

  it('should display alert count', () => {
    const { getByText } = render(<MonitorCard {...mockProps} />);

    expect(getByText('2')).toBeTruthy();
  });

  it('should call onPress when card is pressed', () => {
    const { getByText } = render(<MonitorCard {...mockProps} />);

    fireEvent.press(getByText('Example Monitor'));

    expect(mockProps.onPress).toHaveBeenCalledWith('monitor-1');
  });

  it('should render different status colors', () => {
    const { rerender } = render(<MonitorCard {...mockProps} status="paused" />);

    expect(getByText('paused')).toBeTruthy();

    rerender(<MonitorCard {...mockProps} status="error" />);

    expect(getByText('error')).toBeTruthy();
  });

  it('should format time since last check correctly', () => {
    const { getByText } = render(<MonitorCard {...mockProps} />);

    // Should show approximate time
    expect(getByText(/ago/)).toBeTruthy();
  });

  it('should hide alert badge when alert count is 0', () => {
    const { queryByText } = render(
      <MonitorCard {...mockProps} alertCount={0} />
    );

    // Alert badge should not be visible
    expect(queryByText('0')).not.toBeTruthy();
  });
});
