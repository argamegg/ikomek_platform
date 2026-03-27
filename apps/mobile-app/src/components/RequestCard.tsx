import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StatusBadge } from './StatusBadge';
import { Request } from '../utils/api';

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

interface RequestCardProps {
  request: Request;
  onPress: () => void;
}

export const RequestCard = ({ request, onPress }: RequestCardProps) => {
  const categoryColor = CATEGORY_COLORS[request.category_id] || '#9E9E9E';
  const categoryIcon = CATEGORY_ICONS[request.category_id] || 'ellipsis-horizontal';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${categoryColor}20` }]}>
          <Ionicons name={categoryIcon} size={20} color={categoryColor} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.problemType} numberOfLines={1}>{request.problem_type}</Text>
          <Text style={styles.category}>{request.category_name}</Text>
        </View>
        <StatusBadge status={request.status} size="small" />
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
        <Text style={styles.description} numberOfLines={2}>{request.description}</Text>
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
    flex: 1
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
