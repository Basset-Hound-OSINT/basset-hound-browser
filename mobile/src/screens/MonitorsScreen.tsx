/**
 * Monitors Screen
 * Display all monitors with search and filter capabilities
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDashboard } from '../hooks/useDashboard';
import { useTheme } from '../hooks/useTheme';
import { MonitorCard } from '../components/MonitorCard';

export const MonitorsScreen: React.FC = () => {
  const theme = useTheme();
  const { monitors, loading, refreshData } = useDashboard();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'error'>(
    'all'
  );
  const [refreshing, setRefreshing] = useState(false);

  const filteredMonitors = useMemo(() => {
    return monitors.filter((monitor: any) => {
      const matchesSearch =
        monitor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        monitor.url.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || monitor.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [monitors, searchQuery, statusFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleMonitorPress = (monitorId: string) => {
    console.log('[MonitorsScreen] Monitor pressed:', monitorId);
    // Navigate to monitor detail screen
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
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    searchIcon: {
      marginRight: theme.spacing.sm,
    },
    searchInput: {
      flex: 1,
      height: 40,
      color: theme.colors.text,
      fontSize: 14,
    },
    filterContainer: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
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
      fontSize: 12,
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
    countText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Monitors</Text>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Icon
            name="magnify"
            size={20}
            color={theme.colors.textSecondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search monitors..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon
                name="close-circle"
                size={18}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <View style={styles.filterContainer}>
          {(['all', 'active', 'paused', 'error'] as const).map((status) => (
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

      {filteredMonitors.length === 0 ? (
        <View style={[styles.container, styles.emptyContainer]}>
          <Icon
            name="magnify"
            size={48}
            color={theme.colors.textSecondary}
            style={{ opacity: 0.5 }}
          />
          <Text style={styles.emptyText}>
            {searchQuery || statusFilter !== 'all'
              ? 'No monitors found'
              : 'No monitors available'}
          </Text>
          {(searchQuery || statusFilter !== 'all') && (
            <Text style={styles.countText}>Try adjusting your search or filters</Text>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.content}>
            <Text style={styles.countText}>
              Showing {filteredMonitors.length} of {monitors.length} monitors
            </Text>
            {filteredMonitors.map((monitor: any) => (
              <MonitorCard
                key={monitor.id}
                id={monitor.id}
                name={monitor.name}
                url={monitor.url}
                status={monitor.status}
                lastCheck={monitor.lastCheck}
                changeCount={monitor.changeCount}
                alertCount={monitor.alertCount}
                onPress={handleMonitorPress}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default MonitorsScreen;
