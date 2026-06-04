/**
 * MonitorCard Component
 * Displays individual monitor status and summary
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface MonitorCardProps {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'paused' | 'error';
  lastCheck: number;
  changeCount: number;
  alertCount: number;
  onPress: (monitorId: string) => void;
}

export const MonitorCard: React.FC<MonitorCardProps> = ({
  id,
  name,
  url,
  status,
  lastCheck,
  changeCount,
  alertCount,
  onPress,
}) => {
  const theme = useTheme();

  const getStatusColor = () => {
    switch (status) {
      case 'active':
        return theme.colors.success;
      case 'paused':
        return theme.colors.warning;
      case 'error':
        return theme.colors.error;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getTimeSinceCheck = () => {
    const seconds = Math.floor((Date.now() - lastCheck) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: getStatusColor(),
      ...theme.shadow.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing.sm,
    },
    titleSection: {
      flex: 1,
      marginRight: theme.spacing.md,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    url: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    statusBadge: {
      backgroundColor: getStatusColor(),
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
    },
    statusText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    stats: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.colors.primary,
      marginBottom: theme.spacing.xs,
    },
    statLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    footer: {
      marginTop: theme.spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    lastCheck: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    alertBadge: {
      backgroundColor: theme.colors.critical,
      borderRadius: 12,
      minWidth: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    alertCount: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.url} numberOfLines={1}>
            {url}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{changeCount}</Text>
          <Text style={styles.statLabel}>Changes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{alertCount}</Text>
          <Text style={styles.statLabel}>Alerts</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { textAlign: 'center' }]}>
            Last Check
          </Text>
          <Text style={[styles.statValue, { fontSize: 13 }]}>
            {getTimeSinceCheck()}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.lastCheck}>Updated {getTimeSinceCheck()}</Text>
        {alertCount > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertCount}>{alertCount}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default MonitorCard;
