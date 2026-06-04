/**
 * AlertListItem Component
 * Displays individual alert in a list
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../hooks/useTheme';

interface AlertListItemProps {
  id: string;
  monitorId?: string;
  monitorName?: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: number;
  read: boolean;
  dismissed: boolean;
  onPress: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onAcknowledge: (alertId: string) => void;
}

export const AlertListItem: React.FC<AlertListItemProps> = ({
  id,
  monitorName,
  title,
  description,
  severity,
  timestamp,
  read,
  dismissed,
  onPress,
  onDismiss,
  onAcknowledge,
}) => {
  const theme = useTheme();

  const getSeverityColor = () => {
    switch (severity) {
      case 'critical':
        return theme.colors.critical;
      case 'high':
        return theme.colors.error;
      case 'medium':
        return theme.colors.warning;
      case 'low':
        return theme.colors.info;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getSeverityIcon = () => {
    switch (severity) {
      case 'critical':
        return 'alert-circle';
      case 'high':
        return 'alert';
      case 'medium':
        return 'alert-outline';
      case 'low':
        return 'information';
      default:
        return 'bell';
    }
  };

  const getTimeSince = () => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
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
      backgroundColor: read ? theme.colors.surface : theme.colors.background,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: getSeverityColor(),
      opacity: dismissed ? 0.5 : 1,
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
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    monitorName: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    description: {
      fontSize: 13,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    severityBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: getSeverityColor(),
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
    },
    severityText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'capitalize',
      marginLeft: theme.spacing.xs,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: theme.spacing.md,
      paddingTop: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    timestamp: {
      fontSize: 11,
      color: theme.colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.border,
    },
    actionButtonText: {
      fontSize: 11,
      color: theme.colors.text,
      fontWeight: '500',
      marginLeft: theme.spacing.xs,
    },
  });

  if (dismissed) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(id)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleSection}>
          {monitorName && <Text style={styles.monitorName}>{monitorName}</Text>}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        </View>
        <View style={styles.severityBadge}>
          <Icon name={getSeverityIcon()} size={14} color="#FFFFFF" />
          <Text style={styles.severityText}>{severity}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.timestamp}>{getTimeSince()}</Text>
        <View style={styles.actions}>
          {!read && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onAcknowledge(id)}
            >
              <Icon name="check-circle" size={14} color={theme.colors.success} />
              <Text style={styles.actionButtonText}>Acknowledge</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onDismiss(id)}
          >
            <Icon name="close-circle" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.actionButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default AlertListItem;
