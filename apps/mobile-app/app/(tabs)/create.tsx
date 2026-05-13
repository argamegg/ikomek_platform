import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { REQUEST_CATEGORIES, localizeCategory } from '../../src/utils/requestLocalization';
import { AIAssistantHeaderButton } from '../../src/components/AIAssistantWidget';

export default function CreateScreen() {
  const { t } = useTranslation();
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
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>{t('request.newRequest')}</Text>
          <Text style={styles.headerSubtitle}>{t('request.selectCategory')}</Text>
        </View>
        <AIAssistantHeaderButton />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.categoriesContainer, { paddingBottom: insets.bottom + 100 }]}
      >
        {REQUEST_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.categoryCard}
            onPress={() => handleCategorySelect(category.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconContainer, { backgroundColor: `${category.color}20` }]}>
              <Ionicons name={category.icon as any} size={28} color={category.color} />
            </View>
            <Text style={styles.categoryName}>{localizeCategory(category.id, t)}</Text>
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
    backgroundColor: 'transparent'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 20,
    paddingBottom: 12
  },
  headerTextBlock: {
    flex: 1
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E'
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
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
