/**
 * AlertListItem Component Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AlertListItem } from '../../components/AlertListItem';

describe('AlertListItem Component', () => {
  const mockProps = {
    id: 'alert-1',
    monitorId: 'monitor-1',
    monitorName: 'Example Monitor',
    title: 'Price Change Detected',
    description: 'The product price has changed from $99 to $89',
    severity: 'high' as const,
    timestamp: Date.now() - 300000,
    read: false,
    dismissed: false,
    onPress: jest.fn(),
    onDismiss: jest.fn(),
    onAcknowledge: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render alert item with correct data', () => {
    const { getByText } = render(<AlertListItem {...mockProps} />);

    expect(getByText('Price Change Detected')).toBeTruthy();
    expect(getByText('Example Monitor')).toBeTruthy();
  });

  it('should display severity badge', () => {
    const { getByText } = render(<AlertListItem {...mockProps} />);

    expect(getByText('high')).toBeTruthy();
  });

  it('should format timestamp correctly', () => {
    const { getByText } = render(<AlertListItem {...mockProps} />);

    // Should show approximate time
    expect(getByText(/ago/)).toBeTruthy();
  });

  it('should show acknowledge button when not read', () => {
    const { getByText } = render(<AlertListItem {...mockProps} read={false} />);

    expect(getByText('Acknowledge')).toBeTruthy();
  });

  it('should call onAcknowledge when acknowledge button is pressed', () => {
    const { getByText } = render(<AlertListItem {...mockProps} />);

    fireEvent.press(getByText('Acknowledge'));

    expect(mockProps.onAcknowledge).toHaveBeenCalledWith('alert-1');
  });

  it('should call onDismiss when dismiss button is pressed', () => {
    const { getByText } = render(<AlertListItem {...mockProps} />);

    fireEvent.press(getByText('Dismiss'));

    expect(mockProps.onDismiss).toHaveBeenCalledWith('alert-1');
  });

  it('should not render if dismissed', () => {
    const { queryByText } = render(<AlertListItem {...mockProps} dismissed={true} />);

    expect(queryByText('Price Change Detected')).not.toBeTruthy();
  });

  it('should render different severity colors', () => {
    const { rerender } = render(<AlertListItem {...mockProps} severity="critical" />);

    expect(getByText('critical')).toBeTruthy();

    rerender(<AlertListItem {...mockProps} severity="low" />);

    expect(getByText('low')).toBeTruthy();
  });
});
