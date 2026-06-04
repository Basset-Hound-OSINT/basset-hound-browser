/**
 * Dashboard Screen
 * Main overview screen with stats and key metrics
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useDashboard } from '../hooks/useDashboard';
import { useTheme } from '../hooks/useTheme';
import { ConnectionStatus } from '../components/ConnectionStatus';
import { StatCard } from '../components/StatCard';

export const DashboardScreen: React.FC = () => {
  const theme = useTheme();
  const {
    monitors,
    alerts,
    timeline,
    metrics,
    loading,
    isOffline,
    connectionStatus,
    refreshData,
  } = useDashboard();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);

  const unreadAlerts = alerts.filter((a: any) => !a.read && !a.dismissed).length;
  const criticalAlerts = alerts.filter((a: any) => a.severity === 'critical' && !a.dismissed).length;

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
    statusContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    content: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    statGridItem: {
      flex: 1,
    },
    metricsContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    metricLabel: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    metricValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.md,
    },
    errorContainer: {
      backgroundColor: theme.colors.error,
      opacity: 0.1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    errorText: {
      fontSize: 12,
      color: theme.colors.error,
    },
  });

  if (loading && !alerts.length) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.loadingContainer]}>
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.statusContainer}>
          <ConnectionStatus status={connectionStatus as any} isOffline={isOffline} />
        </View>
      </View>

      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.content}>
          {/* Key Statistics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statGridItem}>
                <StatCard
                  icon="eye"
                  label="Active Monitors"
                  value={monitors.length}
                  color={theme.colors.primary}
                />
              </View>
              <View style={styles.statGridItem}>
                <StatCard
                  icon="bell"
                  label="Unread Alerts"
                  value={unreadAlerts}
                  color={theme.colors.error}
                  trend={unreadAlerts > 0 ? 'up' : 'neutral'}
                />
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statGridItem}>
                <StatCard
                  icon="alert-circle"
                  label="Critical"
                  value={criticalAlerts}
                  color={theme.colors.critical}
                />
              </View>
              <View style={styles.statGridItem}>
                <StatCard
                  icon="chart-line"
                  label="Changes"
                  value={timeline.length}
                  color={theme.colors.info}
                />
              </View>
            </View>
          </View>

          {/* Metrics Summary */}
          {metrics && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Performance Metrics</Text>
              <View style={styles.metricsContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Change Frequency</Text>
                  <Text style={styles.metricValue}>
                    {(metrics as any).changeFrequency || 'N/A'}
                  </Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Detection Rate</Text>
                  <Text style={styles.metricValue}>
                    {(metrics as any).detectionRate ? `${(metrics as any).detectionRate}%` : 'N/A'}
                  </Text>
                </View>
                <View style={[styles.metricRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.metricLabel}>Avg Response Time</Text>
                  <Text style={styles.metricValue}>
                    {(metrics as any).avgResponseTime ? `${(metrics as any).avgResponseTime}ms` : 'N/A'}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Recent Changes */}
          {timeline.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Changes</Text>
              <View style={styles.metricsContainer}>
                {timeline.slice(0, 5).map((change: any, index: number) => (
                  <View
                    key={index}
                    style={[styles.metricRow, { borderBottomWidth: index < 4 ? 1 : 0 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.metricLabel} numberOfLines={1}>
                        {(change as any).description}
                      </Text>
                    </View>
                    <View style={{ marginLeft: theme.spacing.md }}>
                      <Text style={[styles.metricValue, { fontSize: 11 }]}>
                        {new Date((change as any).timestamp).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default DashboardScreen;
