import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal, TextInput, ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { apiService, NewsItem } from '../../src/utils/api';

const ORANGE = '#FF6B00';
const NEWS_CATEGORIES = ['critical', 'warning', 'info'];
const CAT_COLORS: Record<string, string> = { critical: '#FF3B30', warning: '#FF9500', info: '#007AFF' };

export default function NewsManageScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', title_ru: '', title_kz: '', content: '', content_ru: '', content_kz: '', category: 'info' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      const res = await apiService.getNews();
      setNews(res.data);
    } catch {} finally { setIsLoading(false); setIsRefreshing(false); }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) { Alert.alert('Error', 'Title and content are required'); return; }
    setIsSubmitting(true);
    try {
      await apiService.createNews({
        ...form,
        title_ru: form.title_ru || form.title,
        title_kz: form.title_kz || form.title,
        content_ru: form.content_ru || form.content,
        content_kz: form.content_kz || form.content
      });
      Alert.alert('Success', 'News created');
      setShowCreate(false);
      setForm({ title: '', title_ru: '', title_kz: '', content: '', content_ru: '', content_kz: '', category: 'info' });
      fetchNews();
    } catch { Alert.alert('Error', 'Failed to create news'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete News', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await apiService.deleteNews(id); fetchNews(); } catch { Alert.alert('Error', 'Failed to delete'); }
      }}
    ]);
  };

  const renderCard = ({ item }: { item: NewsItem }) => {
    const catColor = CAT_COLORS[item.category] || '#007AFF';
    return (
      <View style={styles.newsCard}>
        <View style={[styles.newsStrip, { backgroundColor: catColor }]} />
        <View style={styles.newsBody}>
          <View style={styles.newsTop}>
            <View style={[styles.catBadge, { backgroundColor: `${catColor}15` }]}>
              <Text style={[styles.catText, { color: catColor }]}>{item.category}</Text>
            </View>
            <Text style={styles.newsDate}>{format(new Date(item.created_at), 'dd.MM.yy')}</Text>
          </View>
          <Text style={styles.newsTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.newsContent} numberOfLines={2}>{item.content}</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) return <View style={[styles.container, styles.centered]}><ActivityIndicator size="large" color={ORANGE} /></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle} data-testid="admin-news-title">{t('admin.manageNews')}</Text>
          <Text style={styles.headerSub}>{news.length} articles</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)} data-testid="create-news-btn">
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <FlatList data={news} keyExtractor={i => i.id} renderItem={renderCard}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); fetchNews(); }} tintColor={ORANGE} />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
      />

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { paddingTop: insets.top || 16 }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Create News</Text>
            <TouchableOpacity onPress={handleCreate} disabled={isSubmitting}>
              <Text style={[styles.saveText, isSubmitting && { opacity: 0.5 }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.catPicker}>
              {NEWS_CATEGORIES.map(c => (
                <TouchableOpacity key={c} style={[styles.catOption, form.category === c && { backgroundColor: `${CAT_COLORS[c]}20`, borderColor: CAT_COLORS[c] }]} onPress={() => setForm({ ...form, category: c })}>
                  <Text style={[styles.catOptionText, form.category === c && { color: CAT_COLORS[c], fontWeight: '600' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.inputLabel}>Title (English)</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={v => setForm({ ...form, title: v })} placeholder="News title" placeholderTextColor="#C7C7CC" />
            <Text style={styles.inputLabel}>Title (Russian)</Text>
            <TextInput style={styles.input} value={form.title_ru} onChangeText={v => setForm({ ...form, title_ru: v })} placeholder="Заголовок" placeholderTextColor="#C7C7CC" />
            <Text style={styles.inputLabel}>Title (Kazakh)</Text>
            <TextInput style={styles.input} value={form.title_kz} onChangeText={v => setForm({ ...form, title_kz: v })} placeholder="Тақырып" placeholderTextColor="#C7C7CC" />
            <Text style={styles.inputLabel}>Content (English)</Text>
            <TextInput style={[styles.input, styles.textArea]} value={form.content} onChangeText={v => setForm({ ...form, content: v })} placeholder="News content" placeholderTextColor="#C7C7CC" multiline numberOfLines={4} textAlignVertical="top" />
            <Text style={styles.inputLabel}>Content (Russian)</Text>
            <TextInput style={[styles.input, styles.textArea]} value={form.content_ru} onChangeText={v => setForm({ ...form, content_ru: v })} placeholder="Содержание" placeholderTextColor="#C7C7CC" multiline numberOfLines={4} textAlignVertical="top" />
            <Text style={styles.inputLabel}>Content (Kazakh)</Text>
            <TextInput style={[styles.input, styles.textArea]} value={form.content_kz} onChangeText={v => setForm({ ...form, content_kz: v })} placeholder="Мазмұны" placeholderTextColor="#C7C7CC" multiline numberOfLines={4} textAlignVertical="top" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E' },
  headerSub: { fontSize: 15, color: '#8E8E93', marginTop: 4 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16 },
  newsCard: { backgroundColor: '#FFF', borderRadius: 14, marginBottom: 10, flexDirection: 'row', overflow: 'hidden' },
  newsStrip: { width: 4 },
  newsBody: { flex: 1, padding: 14 },
  newsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  newsDate: { fontSize: 12, color: '#8E8E93' },
  newsTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  newsContent: { fontSize: 13, color: '#8E8E93', lineHeight: 18, marginBottom: 8 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  deleteText: { fontSize: 13, color: '#FF3B30', fontWeight: '500' },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  cancelText: { fontSize: 17, color: '#8E8E93' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1C1C1E' },
  saveText: { fontSize: 17, color: ORANGE, fontWeight: '600' },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#8E8E93', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F2F2F7', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1C1C1E' },
  textArea: { minHeight: 80 },
  catPicker: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  catOption: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E5EA', alignItems: 'center' },
  catOptionText: { fontSize: 13, color: '#8E8E93' }
});
