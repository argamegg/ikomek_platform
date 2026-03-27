import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const ORANGE = '#FF6B00';

const CATEGORIES = [
  { id: 'electricity', name: 'Electricity', icon: 'flash', color: '#FFB300' },
  { id: 'water', name: 'Water Supply', icon: 'water', color: '#2196F3' },
  { id: 'roads', name: 'Roads', icon: 'car', color: '#607D8B' },
  { id: 'public_order', name: 'Public Order', icon: 'shield-checkmark', color: '#4CAF50' },
  { id: 'waste', name: 'Waste', icon: 'trash', color: '#795548' },
  { id: 'heating', name: 'Heating', icon: 'flame', color: '#FF5722' },
  { id: 'street_lighting', name: 'Street Lighting', icon: 'bulb', color: '#FFC107' },
  { id: 'other', name: 'Other', icon: 'ellipsis-horizontal', color: '#9E9E9E' },
];

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleCategorySelect = (categoryId: string) => {
    router.push({
      pathname: '/request/location',
      params: { categoryId }
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Request</Text>
        <Text style={styles.headerSubtitle}>Select the issue category</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.categoriesContainer, { paddingBottom: insets.bottom + 100 }]}
      >
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryCard}
            onPress={() => handleCategorySelect(category.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${category.color}20` }]}>
              <Ionicons name={category.icon as any} size={28} color={category.color} />
            </View>
            <Text style={styles.categoryName}>{category.name}</Text>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7'
  },
  header: {
    padding: 20,
    paddingBottom: 12
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E'
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    marginTop: 4
  },
  scrollView: {
    flex: 1
  },
  categoriesContainer: {
    padding: 16
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  categoryName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E'
  }
});
