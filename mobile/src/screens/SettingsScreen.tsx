/**
 * Settings Screen
 * User preferences and application settings
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDashboardStore } from '../state/store';
import { useTheme } from '../hooks/useTheme';
import { getDashboardAPI } from '../api/dashboard-api';

export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  const { settings, updateSettings, saveSettings, getSetting } = useDashboardStore();
  const api = getDashboardAPI();
  const [isSaving, setIsSaving] = useState(false);

  const handleThemeChange = async () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    updateSettings({ theme: newTheme });
    await saveSettings();
  };

  const handleNotificationsChange = async (value: boolean) => {
    updateSettings({ notificationsEnabled: value });
    await saveSettings();
  };

  const handleOfflineModeChange = async (value: boolean) => {
    updateSettings({ offlineMode: value });
    await saveSettings();
  };

  const handleAutoRefreshChange = (interval: number) => {
    updateSettings({ autoRefreshInterval: interval });
    saveSettings();
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear all cached data? You can download it again.',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            try {
              setIsSaving(true);
              api.clearCache();
              Alert.alert('Success', 'Cache cleared successfully');
            } finally {
              setIsSaving(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Logout',
          onPress: () => {
            // Navigate to login screen
            console.log('[SettingsScreen] User logged out');
          },
          style: 'destructive',
        },
      ]
    );
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
    },
    content: {
      padding: theme.spacing.lg,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingRowLast: {
      borderBottomWidth: 0,
    },
    settingLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: theme.spacing.xs,
    },
    settingDescription: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    settingControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    optionButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    optionButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    optionButtonText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.text,
    },
    optionButtonTextActive: {
      color: '#FFFFFF',
    },
    actionButton: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.border,
    },
    dangerButton: {
      borderLeftColor: theme.colors.error,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    dangerButtonText: {
      color: theme.colors.error,
    },
    infoBox: {
      backgroundColor: theme.colors.info,
      opacity: 0.1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    infoText: {
      fontSize: 12,
      color: theme.colors.info,
      lineHeight: 18,
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Appearance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Theme</Text>
                <Text style={styles.settingDescription}>
                  {settings.theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </Text>
              </View>
              <Switch
                value={settings.theme === 'dark'}
                onValueChange={handleThemeChange}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>
          </View>

          {/* Notifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive alerts on your device
                </Text>
              </View>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={handleNotificationsChange}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>
          </View>

          {/* Data & Sync */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data & Sync</Text>
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Offline Mode</Text>
                <Text style={styles.settingDescription}>
                  Use cached data when offline
                </Text>
              </View>
              <Switch
                value={settings.offlineMode}
                onValueChange={handleOfflineModeChange}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              />
            </View>

            <View style={[styles.settingRow, styles.settingRowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Auto-Refresh</Text>
                <Text style={styles.settingDescription}>
                  Refresh interval in seconds
                </Text>
              </View>
              <View style={styles.settingControl}>
                {[15000, 30000, 60000].map((interval) => (
                  <TouchableOpacity
                    key={interval}
                    style={[
                      styles.optionButton,
                      settings.autoRefreshInterval === interval &&
                        styles.optionButtonActive,
                    ]}
                    onPress={() => handleAutoRefreshChange(interval)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        settings.autoRefreshInterval === interval &&
                          styles.optionButtonTextActive,
                      ]}
                    >
                      {interval / 1000}s
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Display */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Display</Text>
            <View style={[styles.settingRow, styles.settingRowLast]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Default View</Text>
                <Text style={styles.settingDescription}>
                  {settings.defaultView === 'overview'
                    ? 'Dashboard overview'
                    : 'Monitors list'}
                </Text>
              </View>
              <View style={styles.settingControl}>
                {[
                  { label: 'Overview', value: 'overview' },
                  { label: 'List', value: 'list' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      settings.defaultView === option.value &&
                        styles.optionButtonActive,
                    ]}
                    onPress={() =>
                      updateSettings({
                        defaultView: option.value as 'overview' | 'list',
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        settings.defaultView === option.value &&
                          styles.optionButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Data Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Management</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleClearCache}
              disabled={isSaving}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Icon name="trash-can" size={18} color={theme.colors.text} />
                <Text style={styles.actionButtonText}>Clear Cache</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Clearing cache will remove all locally stored data. You can download it again
                when online.
              </Text>
            </View>
          </View>

          {/* Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={handleLogout}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                <Icon name="logout" size={18} color={theme.colors.error} />
                <Text style={[styles.actionButtonText, styles.dangerButtonText]}>
                  Logout
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>App Version</Text>
              <Text style={styles.settingDescription}>1.0.0</Text>
            </View>
            <View style={[styles.settingRow, styles.settingRowLast]}>
              <Text style={styles.settingLabel}>Build</Text>
              <Text style={styles.settingDescription}>2024.06.01</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
