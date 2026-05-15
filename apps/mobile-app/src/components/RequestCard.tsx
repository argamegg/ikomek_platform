import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from './StatusBadge';
import type { Request } from '../utils/api';
import {
  localizeCategory,
  localizeProblemType,
  localizeRequestDescription,
} from '../utils/requestLocalization';
import { localizeRequestPriority } from '../utils/requestMeta';

const CATEGORY_COLORS: Record<string, string> = {
  electricity: '#FFB300',
  water: '#2196F3',
  roads: '#607D8B',
  public_order: '#4CAF50',
  waste: '#795548',
  heating: '#FF5722',
  street_lighting: '#FFC107',
  other: '#9E9E9E'
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  electricity: 'flash',
  water: 'water',
  roads: 'car',
  public_order: 'shield-checkmark',
  waste: 'trash',
  heating: 'flame',
  street_lighting: 'bulb',
  other: 'ellipsis-horizontal'
};

const PRIORITY_COLORS = {
  low: { background: '#F3F4F6', text: '#6B7280', border: '#D1D5DB' },
  medium: { background: '#FEF9C3', text: '#CA8A04', border: '#FDE047' },
  high: { background: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' },
} as const;

interface RequestCardProps {
  request: Request;
  onPress: () => void;
}

export const RequestCard = ({ request, onPress }: RequestCardProps) => {
  const { t } = useTranslation();
  const categoryColor = CATEGORY_COLORS[request.category_id] || '#9E9E9E';
  const categoryIcon = CATEGORY_ICONS[request.category_id] || 'ellipsis-horizontal';
  const problem = localizeProblemType(request.category_id, request.problem_type, t);
  const category = localizeCategory(request.category_id || request.category_name, t);
  const description = localizeRequestDescription(
    request.description,
    request.category_id,
    request.problem_type,
    request.reason,
    t,
  );
  const priority = request.priority ?? 'medium';
  const priorityStyle = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${categoryColor}20` }]}>
          <Ionicons name={categoryIcon} size={20} color={categoryColor} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.problemType} numberOfLines={1}>{problem}</Text>
          <Text style={styles.category}>{category}</Text>
        </View>
        <View style={styles.badges}>
          <StatusBadge status={request.status} size="small" />
          <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.background, borderColor: priorityStyle.border }]}>
            <Text style={[styles.priorityText, { color: priorityStyle.text }]}>
              {localizeRequestPriority(priority, t)}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.content}>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={14} color="#8E8E93" />
          <Text style={styles.address} numberOfLines={1}>{request.address}</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="time-outline" size={14} color="#8E8E93" />
          <Text style={styles.date}>
            {format(new Date(request.created_at), 'dd.MM.yyyy HH:mm')}
          </Text>
        </View>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  badges: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700'
  },
  problemType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E'
  },
  category: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2
  },
  content: {
    gap: 6,
    marginBottom: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  address: {
    fontSize: 13,
    color: '#3C3C43',
    flex: 1
  },
  date: {
    fontSize: 13,
    color: '#8E8E93'
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingTop: 12
  },
  description: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18
  }
});
