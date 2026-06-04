/**
 * ConnectionStatus Component
 * Displays real-time connection status indicator
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'connecting';
  isOffline: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  isOffline,
}) => {
  const theme = useTheme();

  const getStatusColor = () => {
    if (isOffline) return theme.colors.warning;
    switch (status) {
      case 'connected':
        return theme.colors.success;
      case 'disconnected':
        return theme.colors.error;
      case 'connecting':
        return theme.colors.info;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusText = () => {
    if (isOffline) return 'Offline Mode';
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Unknown';
    }
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
    },
    indicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: getStatusColor(),
    },
    pulsingIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: getStatusColor(),
    },
    text: {
      fontSize: 12,
      fontWeight: '500',
      color: getStatusColor(),
    },
  });

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.indicator,
          status === 'connecting' && styles.pulsingIndicator,
        ]}
      />
      <Text style={styles.text}>{getStatusText()}</Text>
    </View>
  );
};

export default ConnectionStatus;
