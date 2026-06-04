/**
 * StatCard Component
 * Displays a single statistic with icon and value
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../hooks/useTheme';

interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  unit,
  color,
  trend,
}) => {
  const theme = useTheme();

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return theme.colors.success;
      case 'down':
        return theme.colors.error;
      case 'neutral':
        return theme.colors.info;
      default:
        return theme.colors.primary;
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return null;
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      ...theme.shadow.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: color ? `${color}20` : `${theme.colors.primary}20`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    label: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    valueContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.xs,
    },
    value: {
      fontSize: 24,
      fontWeight: '700',
      color: color || theme.colors.primary,
    },
    unit: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    trend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.sm,
    },
    trendText: {
      fontSize: 11,
      color: getTrendColor(),
      fontWeight: '500',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View
          style={[styles.iconContainer, { backgroundColor: color ? `${color}20` : undefined }]}
        >
          <Icon
            name={icon}
            size={24}
            color={color || theme.colors.primary}
          />
        </View>
      </View>

      <View style={styles.valueContainer}>
        <Text style={styles.value}>{value}</Text>
        {unit && <Text style={styles.unit}>{unit}</Text>}
      </View>

      {trend && getTrendIcon() && (
        <View style={styles.trend}>
          <Icon
            name={getTrendIcon()!}
            size={14}
            color={getTrendColor()}
          />
          <Text style={styles.trendText}>
            {trend === 'up' ? 'Increasing' : 'Decreasing'}
          </Text>
        </View>
      )}
    </View>
  );
};

export default StatCard;
