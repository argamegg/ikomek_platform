import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { apiService, NewsCategory, NewsItem, NewsType } from '../../src/utils/api';
import {
  getNewsCategory,
  getNewsTypeMeta,
  getNewsTypes,
  NEWS_CATEGORY_COLOR,
  NEWS_CATEGORY_OPTIONS,
  NEWS_TYPE_OPTIONS,
} from '../../src/utils/newsMeta';

const ORANGE = '#FB8C00';

type NewsFormState = {
  title: string;
  title_ru: string;
  title_kz: string;
  content: string;
  content_ru: string;
  content_kz: string;
  summary: string;
  category: NewsCategory;
  types: NewsType[];
  location: string;
  start_at: string;
  end_at: string;
};

const initialForm: NewsFormState = {
  title: '',
  title_ru: '',
  title_kz: '',
  content: '',
  content_ru: '',
  content_kz: '',
  summary: '',
  category: 'Дороги',
  types: ['Дорожные ситуации'],
  location: '',
  start_at: new Date().toISOString().slice(0, 16),
  end_at: '',
};

export default function NewsManageScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<NewsFormState>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      const res = await apiService.getNews();
      setNews(res.data);
    } catch (error) {
      console.error('Failed to load news', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const articleCountLabel = useMemo(
    () => t('admin.articlesCount', { count: news.length, defaultValue: `${news.length} новостей` }),
    [news.length, t],
  );

  const updateForm = <K extends keyof NewsFormState>(key: K, value: NewsFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleType = (type: NewsType) => {
    setForm((current) => {
      const exists = current.types.includes(type);
      const nextTypes = exists
        ? current.types.filter((item) => item !== type)
        : [...current.types, type];

      return {
        ...current,
        types: nextTypes.length > 0 ? nextTypes : current.types,
      };
    });
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      Alert.alert(t('common.error'), 'Заполните заголовок и текст новости.');
      return;
    }

    if (form.types.length === 0) {
      Alert.alert(t('common.error'), 'Выберите хотя бы один тип новости.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiService.createNews({
        title: form.title,
        title_ru: form.title_ru || form.title,
        title_kz: form.title_kz || form.title,
        content: form.content,
        content_ru: form.content_ru || form.content,
        content_kz: form.content_kz || form.content,
        summary: form.summary || form.content.slice(0, 180),
        category: form.category,
        types: form.types,
        location: form.location || undefined,
        start_at: form.start_at || undefined,
        end_at: form.end_at || undefined,
      });
      Alert.alert(t('common.success'), 'Новость опубликована.');
      setShowCreate(false);
      setForm(initialForm);
      fetchNews();
    } catch (error) {
      console.error('Failed to create news', error);
      Alert.alert(t('common.error'), 'Не удалось создать новость.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Удалить новость', 'Эту новость нельзя будет восстановить.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteNews(id);
            fetchNews();
          } catch (error) {
            console.error('Failed to delete news', error);
            Alert.alert(t('common.error'), 'Не удалось удалить новость.');
          }
        },
      },
    ]);
  };

  const renderCard = ({ item }: { item: NewsItem }) => {
    const types = getNewsTypes(item);
    const primaryType = types[0];
    const primaryMeta = getNewsTypeMeta(primaryType);
    const category = getNewsCategory(item);

    return (
      <View style={styles.newsCard}>
        <View style={[styles.newsStrip, { backgroundColor: primaryMeta.color }]} />
        <View style={styles.newsBody}>
          <View style={styles.newsTop}>
            <View style={[styles.newsTypePill, { backgroundColor: `${primaryMeta.color}14` }]}>
              <MaterialCommunityIcons name={primaryMeta.icon} size={14} color={primaryMeta.color} />
              <Text style={[styles.newsTypeText, { color: primaryMeta.color }]}>{primaryType}</Text>
            </View>
            <Text style={styles.newsDate}>{format(new Date(item.created_at), 'dd.MM.yy')}</Text>
          </View>

          <View style={styles.newsCategoryChip}>
            <Text style={styles.newsCategoryChipText}>{category}</Text>
          </View>

          <Text style={styles.newsTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.newsContent} numberOfLines={3}>
            {item.content}
          </Text>

          {types.length > 1 ? (
            <View style={styles.extraTypesRow}>
              {types.slice(1).map((type) => {
                const meta = getNewsTypeMeta(type);
                return (
                  <View key={`${item.id}-${type}`} style={styles.extraTypeItem}>
                    <View style={[styles.extraTypeDot, { backgroundColor: meta.color }]} />
                    <Text style={styles.extraTypeText}>{type}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
            <MaterialCommunityIcons name="trash-can-outline" size={16} color="#E53935" />
            <Text style={styles.deleteText}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('admin.manageNews')}</Text>
          <Text style={styles.headerSub}>{articleCountLabel}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={news}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              fetchNews();
            }}
            tintColor={ORANGE}
          />
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { paddingTop: insets.top || 16 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Новая новость</Text>
            <TouchableOpacity onPress={handleCreate} disabled={isSubmitting}>
              <Text style={[styles.saveText, isSubmitting && { opacity: 0.5 }]}>
                {t('common.save')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            <Text style={styles.inputLabel}>Категория</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryOptionsRow}
            >
              {NEWS_CATEGORY_OPTIONS.map((category) => {
                const active = form.category === category;
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryOption, active && styles.categoryOptionActive]}
                    onPress={() => updateForm('category', category)}
                  >
                    <Text
                      style={[styles.categoryOptionText, active && styles.categoryOptionTextActive]}
                    >
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.inputLabel}>Типы</Text>
            <View style={styles.typeOptionsGrid}>
              {NEWS_TYPE_OPTIONS.map((option) => {
                const active = form.types.includes(option.label);
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.typeOption,
                      active && {
                        borderColor: option.color,
                        backgroundColor: `${option.color}10`,
                      },
                    ]}
                    onPress={() => toggleType(option.label)}
                  >
                    <View style={[styles.typeOptionIcon, { backgroundColor: option.color }]}>
                      <MaterialCommunityIcons name={option.icon} size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.typeOptionTextWrap}>
                      <Text style={[styles.typeOptionText, active && { color: option.color }]}>
                        {option.label}
                      </Text>
                      <Text style={styles.typeOptionHint}>{option.defaultCategory}</Text>
                    </View>
                    {active ? (
                      <MaterialCommunityIcons name="check-circle" size={18} color={option.color} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Заголовок</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(value) => updateForm('title', value)}
              placeholder="Введите заголовок"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Заголовок RU</Text>
            <TextInput
              style={styles.input}
              value={form.title_ru}
              onChangeText={(value) => updateForm('title_ru', value)}
              placeholder="Русский заголовок"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Заголовок KZ</Text>
            <TextInput
              style={styles.input}
              value={form.title_kz}
              onChangeText={(value) => updateForm('title_kz', value)}
              placeholder="Қазақша тақырып"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Краткое описание</Text>
            <TextInput
              style={[styles.input, styles.textAreaSmall]}
              value={form.summary}
              onChangeText={(value) => updateForm('summary', value)}
              placeholder="Короткое превью для карточки"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>Текст</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.content}
              onChangeText={(value) => updateForm('content', value)}
              placeholder="Полный текст новости"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>Текст RU</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.content_ru}
              onChangeText={(value) => updateForm('content_ru', value)}
              placeholder="Русский текст"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>Текст KZ</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.content_kz}
              onChangeText={(value) => updateForm('content_kz', value)}
              placeholder="Қазақша мәтін"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>Локация</Text>
            <TextInput
              style={styles.input}
              value={form.location}
              onChangeText={(value) => updateForm('location', value)}
              placeholder="Например: Район Алматы, ул. Абая 40"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Начало периода</Text>
            <TextInput
              style={styles.input}
              value={form.start_at}
              onChangeText={(value) => updateForm('start_at', value)}
              placeholder="2026-05-02T12:00"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.inputLabel}>Окончание периода</Text>
            <TextInput
              style={styles.input}
              value={form.end_at}
              onChangeText={(value) => updateForm('end_at', value)}
              placeholder="2026-05-02T18:00"
              placeholderTextColor="#94A3B8"
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  headerSub: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
    marginTop: 4,
  },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FB8C00',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 5,
  },
  list: {
    paddingHorizontal: 16,
  },
  newsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  newsStrip: {
    width: 5,
  },
  newsBody: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  newsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  newsTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  newsTypeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  newsDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  newsCategoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: NEWS_CATEGORY_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  newsCategoryChipText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  newsTitle: {
    fontSize: 17,
    lineHeight: 22,
    color: '#111827',
    fontWeight: '800',
  },
  newsContent: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    fontWeight: '500',
  },
  extraTypesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  extraTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
  },
  extraTypeDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  extraTypeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  deleteText: {
    fontSize: 13,
    color: '#E53935',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  cancelText: {
    fontSize: 17,
    color: '#64748B',
    fontWeight: '500',
  },
  modalTitle: {
    fontSize: 17,
    color: '#111827',
    fontWeight: '700',
  },
  saveText: {
    fontSize: 17,
    color: ORANGE,
    fontWeight: '700',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 20,
    paddingBottom: 36,
  },
  inputLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
  },
  categoryOptionsRow: {
    gap: 8,
    paddingRight: 8,
  },
  categoryOption: {
    borderWidth: 1.5,
    borderColor: NEWS_CATEGORY_COLOR,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  categoryOptionActive: {
    backgroundColor: NEWS_CATEGORY_COLOR,
  },
  categoryOptionText: {
    fontSize: 13,
    color: NEWS_CATEGORY_COLOR,
    fontWeight: '700',
  },
  categoryOptionTextActive: {
    color: '#FFFFFF',
  },
  typeOptionsGrid: {
    gap: 10,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  typeOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionTextWrap: {
    flex: 1,
    gap: 2,
  },
  typeOptionText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '700',
  },
  typeOptionHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textAreaSmall: {
    minHeight: 88,
  },
  textArea: {
    minHeight: 120,
  },
});
