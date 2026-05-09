import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NewsCategory, NewsType } from '../utils/api';
import { NEWS_CATEGORY_COLOR, NEWS_CATEGORY_OPTIONS, NEWS_TYPE_OPTIONS } from '../utils/newsMeta';

const ORANGE = '#FB8C00';

export type NewsFormValues = {
  title: string;
  title_ru: string;
  title_kz: string;
  title_en: string;
  content: string;
  content_ru: string;
  content_kz: string;
  content_en: string;
  summary: string;
  summary_ru: string;
  summary_kz: string;
  summary_en: string;
  category: NewsCategory;
  types: NewsType[];
  location: string;
  start_at: string;
  end_at: string;
  source_lang?: 'ru' | 'kk' | 'en';
  translation_status?: 'translated' | 'failed' | 'skipped' | string;
};

export type NewsFormSubmitOptions = {
  skipTranslation?: boolean;
};

type TranslationPreview = {
  source_lang: 'ru' | 'kk' | 'en';
  translations: {
    ru: { title: string; content: string };
    kk: { title: string; content: string };
    en: { title: string; content: string };
  };
};

type NewsFormProps = {
  initialValue: NewsFormValues;
  submitLabel: string;
  isSubmitting?: boolean;
  isTranslating?: boolean;
  onCancel: () => void;
  onSubmit: (value: NewsFormValues, options: NewsFormSubmitOptions) => Promise<void> | void;
  onTranslate: (value: NewsFormValues) => Promise<TranslationPreview>;
};

const TABS = [
  { key: 'ru', label: 'RU' },
  { key: 'kz', label: 'KZ' },
  { key: 'en', label: 'EN' },
] as const;

export function createInitialNewsFormValue(): NewsFormValues {
  return {
    title: '',
    title_ru: '',
    title_kz: '',
    title_en: '',
    content: '',
    content_ru: '',
    content_kz: '',
    content_en: '',
    summary: '',
    summary_ru: '',
    summary_kz: '',
    summary_en: '',
    category: 'Дороги',
    types: ['Дорожные ситуации'],
    location: '',
    start_at: new Date().toISOString().slice(0, 16),
    end_at: '',
    source_lang: 'ru',
  };
}

function hasTranslatedValues(value: NewsFormValues) {
  return Boolean(
    value.title_ru ||
      value.title_kz ||
      value.title_en ||
      value.content_ru ||
      value.content_kz ||
      value.content_en,
  );
}

function getTabFields(tab: (typeof TABS)[number]['key']) {
  if (tab === 'ru') {
    return { title: 'title_ru', content: 'content_ru' } as const;
  }

  if (tab === 'kz') {
    return { title: 'title_kz', content: 'content_kz' } as const;
  }

  return { title: 'title_en', content: 'content_en' } as const;
}

function getLanguageCode(tab: (typeof TABS)[number]['key']): 'ru' | 'kk' | 'en' {
  if (tab === 'kz') {
    return 'kk';
  }

  return tab;
}

function normalizeForSubmit(value: NewsFormValues, skipTranslation?: boolean): NewsFormValues {
  const summary = value.summary.trim() || value.content.trim().slice(0, 180);

  return {
    ...value,
    title: value.title.trim(),
    content: value.content.trim(),
    summary,
    summary_ru: value.summary_ru.trim(),
    summary_kz: value.summary_kz.trim(),
    summary_en: value.summary_en.trim(),
    location: value.location.trim(),
    end_at: value.end_at.trim(),
    source_lang: value.source_lang || 'ru',
    translation_status: skipTranslation ? 'skipped' : value.translation_status,
  };
}

export function NewsForm({
  initialValue,
  submitLabel,
  isSubmitting = false,
  isTranslating = false,
  onCancel,
  onSubmit,
  onTranslate,
}: NewsFormProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState<NewsFormValues>(initialValue);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['key']>('ru');

  useEffect(() => {
    setValue(initialValue);
    setActiveTab(initialValue.title_ru || initialValue.content_ru ? 'ru' : initialValue.title_kz || initialValue.content_kz ? 'kz' : 'en');
  }, [initialValue]);

  const translatedVisible = useMemo(() => hasTranslatedValues(value), [value]);

  const updateValue = <K extends keyof NewsFormValues>(key: K, next: NewsFormValues[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
  };

  const toggleType = (type: NewsType) => {
    setValue((current) => {
      const nextTypes = current.types.includes(type)
        ? current.types.filter((item) => item !== type)
        : [...current.types, type];

      return {
        ...current,
        types: nextTypes.length > 0 ? nextTypes : current.types,
      };
    });
  };

  const handleTranslate = async () => {
    const preview = await onTranslate(value);
    setValue((current) => ({
      ...current,
      source_lang: preview.source_lang,
      title_ru: preview.translations.ru.title,
      title_kz: preview.translations.kk.title,
      title_en: preview.translations.en.title,
      content_ru: preview.translations.ru.content,
      content_kz: preview.translations.kk.content,
      content_en: preview.translations.en.content,
      translation_status: 'translated',
    }));
  };

  const fields = getTabFields(activeTab);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>{t('admin.news.titleLabel')}</Text>
      <TextInput
        style={styles.input}
        value={value.title}
        onChangeText={(text) => updateValue('title', text)}
        placeholder={t('admin.news.titlePlaceholder')}
        placeholderTextColor="#94A3B8"
      />

      <Text style={styles.sectionLabel}>{t('admin.news.contentLabel')}</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={value.content}
        onChangeText={(text) => updateValue('content', text)}
        placeholder={t('admin.news.contentPlaceholder')}
        placeholderTextColor="#94A3B8"
        multiline
        textAlignVertical="top"
      />

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.flexButton]}
          onPress={() => {
            void handleTranslate();
          }}
          disabled={isTranslating || isSubmitting}
        >
          {isTranslating ? <ActivityIndicator size="small" color={ORANGE} /> : null}
          <Text style={styles.secondaryButtonText}>
            {translatedVisible ? t('admin.news.retranslate') : t('admin.news.translate')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ghostButton, styles.flexButton]}
          onPress={() => {
            void onSubmit(normalizeForSubmit(value, true), { skipTranslation: true });
          }}
          disabled={isSubmitting || isTranslating}
        >
          <Text style={styles.ghostButtonText}>{t('admin.news.publishWithoutTranslation')}</Text>
        </TouchableOpacity>
      </View>

      {translatedVisible ? (
        <>
          <View style={styles.tabsRow}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>
            {t('admin.news.localizedTitleLabel', { lang: getLanguageCode(activeTab).toUpperCase() })}
          </Text>
          <TextInput
            style={styles.input}
            value={value[fields.title]}
            onChangeText={(text) => updateValue(fields.title, text)}
            placeholder={t('admin.news.titlePlaceholder')}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.sectionLabel}>
            {t('admin.news.localizedContentLabel', { lang: getLanguageCode(activeTab).toUpperCase() })}
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={value[fields.content]}
            onChangeText={(text) => updateValue(fields.content, text)}
            placeholder={t('admin.news.contentPlaceholder')}
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />
        </>
      ) : null}

      <Text style={styles.sectionLabel}>{t('admin.news.summaryLabel')}</Text>
      <TextInput
        style={[styles.input, styles.summaryArea]}
        value={value.summary}
        onChangeText={(text) => updateValue('summary', text)}
        placeholder={t('admin.news.summaryPlaceholder')}
        placeholderTextColor="#94A3B8"
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.sectionLabel}>{t('admin.news.categoryLabel')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryOptionsRow}
      >
        {NEWS_CATEGORY_OPTIONS.map((category) => {
          const active = value.category === category;
          return (
            <TouchableOpacity
              key={category}
              style={[styles.categoryOption, active && styles.categoryOptionActive]}
              onPress={() => updateValue('category', category)}
            >
              <Text style={[styles.categoryOptionText, active && styles.categoryOptionTextActive]}>
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionLabel}>{t('admin.news.typesLabel')}</Text>
      <View style={styles.typeOptionsGrid}>
        {NEWS_TYPE_OPTIONS.map((option) => {
          const active = value.types.includes(option.label);
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

      <Text style={styles.sectionLabel}>{t('admin.news.locationLabel')}</Text>
      <TextInput
        style={styles.input}
        value={value.location}
        onChangeText={(text) => updateValue('location', text)}
        placeholder={t('admin.news.locationPlaceholder')}
        placeholderTextColor="#94A3B8"
      />

      <Text style={styles.sectionLabel}>{t('admin.news.periodStartLabel')}</Text>
      <TextInput
        style={styles.input}
        value={value.start_at}
        onChangeText={(text) => updateValue('start_at', text)}
        placeholder={t('admin.news.periodStartPlaceholder')}
        placeholderTextColor="#94A3B8"
      />

      <Text style={styles.sectionLabel}>{t('admin.news.periodEndLabel')}</Text>
      <TextInput
        style={styles.input}
        value={value.end_at}
        onChangeText={(text) => updateValue('end_at', text)}
        placeholder={t('admin.news.periodEndPlaceholder')}
        placeholderTextColor="#94A3B8"
      />

      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.footerCancelButton} onPress={onCancel}>
          <Text style={styles.footerCancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerSubmitButton}
          onPress={() => {
            void onSubmit(normalizeForSubmit(value, false), { skipTranslation: false });
          }}
          disabled={isSubmitting || isTranslating}
        >
          {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
          <Text style={styles.footerSubmitText}>{submitLabel}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  sectionLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
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
  textArea: {
    minHeight: 120,
  },
  summaryArea: {
    minHeight: 88,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  flexButton: {
    flex: 1,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: ORANGE,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: ORANGE,
    fontWeight: '700',
    textAlign: 'center',
  },
  ghostButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  ghostButtonText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '700',
    textAlign: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  tabButton: {
    minWidth: 70,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  tabButtonActive: {
    borderColor: ORANGE,
    backgroundColor: ORANGE,
  },
  tabButtonText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '800',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
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
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  footerCancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCancelText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '700',
  },
  footerSubmitButton: {
    flex: 1.3,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  footerSubmitText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
