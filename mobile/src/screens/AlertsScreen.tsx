/**
 * Alerts Screen
 * Display all alerts with actions for acknowledgment and dismissal
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDashboard } from '../hooks/useDashboard';
import { useTheme } from '../hooks/useTheme';
import { AlertListItem } from '../components/AlertListItem';

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type StatusFilter = 'all' | 'unread' | 'read';

export const AlertsScreen: React.FC = () => {
  const theme = useTheme();
  const {
    alerts,
    loading,
    refreshData,
    markAlertRead,
    dismissAlert,
    acknowledgeAlert,
  } = useDashboard();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert: any) => {
      const matchesSeverity =
        severityFilter === 'all' || alert.severity === severityFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'unread' && !alert.read) ||
        (statusFilter === 'read' && alert.read);
      return matchesSeverity && matchesStatus && !alert.dismissed;
    });
  }, [alerts, severityFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: alerts.filter((a: any) => !a.dismissed).length,
      critical: alerts.filter(
        (a: any) => a.severity === 'critical' && !a.dismissed
      ).length,
      unread: alerts.filter((a: any) => !a.read && !a.dismissed).length,
    };
  }, [alerts]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadAlertIds = alerts
      .filter((a: any) => !a.read && !a.dismissed)
      .map((a: any) => a.id);

    for (const alertId of unreadAlertIds) {
      await markAlertRead(alertId);
    }
  };

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    statItem: {
      flex: 1,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.primary,
      marginBottom: theme.spacing.xs,
    },
    statLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    filterContainer: {
      marginTop: theme.spacing.md,
    },
    filterLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    filterRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      flexWrap: 'wrap',
    },
    filterButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterButtonText: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.colors.text,
    },
    filterButtonTextActive: {
      color: '#FFFFFF',
    },
    content: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    actionBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
    },
    actionButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.primary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.md,
    },
    alertCount: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.critical }]}>
              {stats.critical}
            </Text>
            <Text style={styles.statLabel}>Critical</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.colors.warning }]}>
              {stats.unread}
            </Text>
            <Text style={styles.statLabel}>Unread</Text>
          </View>
        </View>

        {/* Severity Filter */}
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Severity</Text>
          <View style={styles.filterRow}>
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map(
              (severity) => (
                <TouchableOpacity
                  key={severity}
                  style={[
                    styles.filterButton,
                    severityFilter === severity && styles.filterButtonActive,
                  ]}
                  onPress={() => setSeverityFilter(severity)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      severityFilter === severity &&
                        styles.filterButtonTextActive,
                    ]}
                  >
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>

        {/* Status Filter */}
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.filterRow}>
            {(['all', 'unread', 'read'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterButton,
                  statusFilter === status && styles.filterButtonActive,
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    statusFilter === status && styles.filterButtonTextActive,
                  ]}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {filteredAlerts.length === 0 ? (
        <View style={[styles.container, styles.emptyContainer]}>
          <Icon
            name="bell-off"
            size={48}
            color={theme.colors.textSecondary}
            style={{ opacity: 0.5 }}
          />
          <Text style={styles.emptyText}>
            {alerts.length === 0
              ? 'No alerts yet'
              : 'No alerts match your filters'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.content}>
            <View style={styles.actionBar}>
              <Text style={styles.alertCount}>
                Showing {filteredAlerts.length} alerts
              </Text>
              {stats.unread > 0 && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleMarkAllAsRead}
                >
                  <Icon name="check-all" size={16} color={theme.colors.primary} />
                  <Text style={styles.actionButtonText}>Mark All Read</Text>
                </TouchableOpacity>
              )}
            </View>

            {filteredAlerts.map((alert: any) => (
              <AlertListItem
                key={alert.id}
                id={alert.id}
                monitorId={alert.monitorId}
                monitorName={alert.monitorName}
                title={alert.title}
                description={alert.description}
                severity={alert.severity}
                timestamp={alert.timestamp}
                read={alert.read}
                dismissed={alert.dismissed}
                onPress={(id) => {
                  // Navigate to alert detail
                }}
                onDismiss={dismissAlert}
                onAcknowledge={acknowledgeAlert}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default AlertsScreen;
