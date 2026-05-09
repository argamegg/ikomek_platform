import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { NEWS_CATEGORY_COLOR, NEWS_CATEGORY_OPTIONS, NEWS_TYPE_OPTIONS, typeKeyMap, categoryKeyMap } from '../utils/newsMeta';

const ALL_FILTER = '__all__';
const ORANGE = '#FB8C00';

export type PeriodFilter = 'all' | 'active' | 'finished' | 'no_period';
export type SortFilter = 'date_desc' | 'date_asc';

type NewsFilterSheetProps = {
  visible: boolean;
  selectedCategory: string;
  selectedType: string;
  selectedPeriod: PeriodFilter;
  selectedSort: SortFilter;
  onClose: () => void;
  onApply: (value: {
    category: string;
    type: string;
    period: PeriodFilter;
    sort: SortFilter;
  }) => void;
  onReset: () => void;
  categoryAllLabel: string;
  typeAllLabel: string;
};

export function NewsFilterSheet({
  visible,
  selectedCategory,
  selectedType,
  selectedPeriod,
  selectedSort,
  onClose,
  onApply,
  onReset,
  categoryAllLabel,
  typeAllLabel,
}: NewsFilterSheetProps) {
  const { t } = useTranslation();
  const [draftCategory, setDraftCategory] = useState(selectedCategory);
  const [draftType, setDraftType] = useState(selectedType);
  const [draftPeriod, setDraftPeriod] = useState<PeriodFilter>(selectedPeriod);
  const [draftSort, setDraftSort] = useState<SortFilter>(selectedSort);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setDraftCategory(selectedCategory);
      setDraftType(selectedType);
      setDraftPeriod(selectedPeriod);
      setDraftSort(selectedSort);
      translateY.setValue(0);
    }
  }, [selectedCategory, selectedPeriod, selectedSort, selectedType, translateY, visible]);

  const closeAnimated = useCallback(() => {
    Animated.timing(translateY, {
      toValue: 420,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(0);
      onClose();
    });
  }, [onClose, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 120 || gesture.vy > 1.1) {
            closeAnimated();
            return;
          }

          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        },
      }),
    [closeAnimated, translateY],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={closeAnimated}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closeAnimated} />
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{t('news.filtersTitle')}</Text>
            <TouchableOpacity
              onPress={() => {
                setDraftCategory(ALL_FILTER);
                setDraftType(ALL_FILTER);
                setDraftPeriod('all');
                setDraftSort('date_desc');
                onReset();
              }}
            >
              <Text style={styles.resetText}>{t('news.resetFilters')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.news.categoryLabel')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {[ALL_FILTER, ...NEWS_CATEGORY_OPTIONS].map((category) => {
                  const active = draftCategory === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[styles.categoryPill, active && styles.categoryPillActive]}
                      onPress={() => setDraftCategory(category)}
                    >
                      <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                        {category === ALL_FILTER ? categoryAllLabel : t(categoryKeyMap[category] ?? category)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.separator} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.news.typesLabel')}</Text>
              <View style={styles.typeList}>
                <TouchableOpacity
                  style={[styles.typeRow, draftType === ALL_FILTER && styles.typeRowActive]}
                  onPress={() => setDraftType(ALL_FILTER)}
                >
                  <Text style={styles.typeAllLabel}>{typeAllLabel}</Text>
                  <MaterialCommunityIcons
                    name={draftType === ALL_FILTER ? 'radiobox-marked' : 'radiobox-blank'}
                    size={22}
                    color={draftType === ALL_FILTER ? ORANGE : '#CBD5E1'}
                  />
                </TouchableOpacity>

                {NEWS_TYPE_OPTIONS.map((option) => {
                  const active = draftType === option.label;
                  return (
                    <TouchableOpacity
                      key={option.label}
                      style={[styles.typeRow, active && styles.typeRowActive]}
                      onPress={() => setDraftType(option.label)}
                    >
                      <View style={styles.typeRowLeft}>
                        <View style={[styles.typeIconWrap, { backgroundColor: `${option.color}18` }]}>
                          <MaterialCommunityIcons name={option.icon} size={18} color={option.color} />
                        </View>
                        <Text style={styles.typeLabel}>{t(typeKeyMap[option.label] ?? option.label)}</Text>
                      </View>
                      <MaterialCommunityIcons
                        name={active ? 'radiobox-marked' : 'radiobox-blank'}
                        size={22}
                        color={active ? ORANGE : '#CBD5E1'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('news.period')}</Text>
              <View style={styles.gridButtons}>
                {([
                  { key: 'all', label: t('news.periodAll') },
                  { key: 'active', label: t('news.periodActive') },
                  { key: 'finished', label: t('news.periodFinished') },
                  { key: 'no_period', label: t('news.periodNoPeriod') },
                ] as { key: PeriodFilter; label: string }[]).map((item) => {
                  const active = draftPeriod === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.gridButton, active && styles.gridButtonActive]}
                      onPress={() => setDraftPeriod(item.key)}
                    >
                      <Text style={[styles.gridButtonText, active && styles.gridButtonTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('news.sortLabel')}</Text>
              <View style={styles.sortRow}>
                {([
                  { key: 'date_desc', label: t('news.sortNewest'), icon: 'arrow-down' },
                  { key: 'date_asc', label: t('news.sortOldest'), icon: 'arrow-up' },
                ] as { key: SortFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[]).map((item) => {
                  const active = draftSort === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.sortButton, active && styles.sortButtonActive]}
                      onPress={() => setDraftSort(item.key)}
                    >
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={18}
                        color={active ? '#FFFFFF' : '#475569'}
                      />
                      <Text style={[styles.sortButtonText, active && styles.sortButtonTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => {
              onApply({
                category: draftCategory,
                type: draftType,
                period: draftPeriod,
                sort: draftSort,
              });
              closeAnimated();
            }}
          >
            <Text style={styles.applyButtonText}>{t('news.applyFilters')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '84%',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  resetText: {
    fontSize: 15,
    fontWeight: '700',
    color: ORANGE,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  section: {
    paddingVertical: 16,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  separator: {
    height: 1,
    backgroundColor: '#EEF2F7',
  },
  categoryRow: {
    gap: 10,
    paddingRight: 8,
  },
  categoryPill: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: NEWS_CATEGORY_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  categoryPillActive: {
    backgroundColor: NEWS_CATEGORY_COLOR,
  },
  categoryPillText: {
    fontSize: 13,
    color: NEWS_CATEGORY_COLOR,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  typeList: {
    gap: 10,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  typeRowActive: {
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
  },
  typeRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    paddingRight: 12,
  },
  typeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  typeAllLabel: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
  },
  gridButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridButton: {
    width: '48%',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  gridButtonActive: {
    borderColor: ORANGE,
    backgroundColor: '#FFF7ED',
  },
  gridButtonText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
    textAlign: 'center',
  },
  gridButtonTextActive: {
    color: ORANGE,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sortButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
  },
  sortButtonActive: {
    borderColor: ORANGE,
    backgroundColor: ORANGE,
  },
  sortButtonText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
  applyButton: {
    marginTop: 8,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
