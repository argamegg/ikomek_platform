import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getStatusTranslationKey } from '../utils/requestLocalization';

interface StatusBadgeProps {
  status: 'pending' | 'in_progress' | 'closed';
  size?: 'small' | 'medium' | 'large';
}

const STATUS_CONFIG = {
  pending: {
    color: '#FF9500',
    bgColor: 'rgba(255, 149, 0, 0.1)'
  },
  in_progress: {
    color: '#007AFF',
    bgColor: 'rgba(0, 122, 255, 0.1)'
  },
  closed: {
    color: '#34C759',
    bgColor: 'rgba(52, 199, 89, 0.1)'
  }
};

export const StatusBadge = ({ status, size = 'medium' }: StatusBadgeProps) => {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  
  const sizeStyles = {
    small: { paddingHorizontal: 6, paddingVertical: 2, fontSize: 10 },
    medium: { paddingHorizontal: 10, paddingVertical: 4, fontSize: 12 },
    large: { paddingHorizontal: 14, paddingVertical: 6, fontSize: 14 }
  };

  return (
    <View style={[
      styles.badge,
      { backgroundColor: config.bgColor },
      { paddingHorizontal: sizeStyles[size].paddingHorizontal, paddingVertical: sizeStyles[size].paddingVertical }
    ]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color, fontSize: sizeStyles[size].fontSize }]}>
        {t(getStatusTranslationKey(status))}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    gap: 6
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  text: {
    fontWeight: '600'
  }
});
