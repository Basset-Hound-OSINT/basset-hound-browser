/**
 * App.tsx
 * Main application entry point
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useDashboardStore } from './state/store';
import { RootNavigator } from './navigation/RootNavigator';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const theme = useTheme();
  const { loadSettings } = useDashboardStore();

  useEffect(() => {
    // Load settings on app start
    loadSettings();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer
        theme={{
          dark: theme.colors.background === '#111827',
          colors: {
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.surface,
            text: theme.colors.text,
            border: theme.colors.border,
            notification: theme.colors.error,
          },
        }}
      >
        <RootNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
