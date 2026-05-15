import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  PLACE_TYPES,
  getProblemOptions,
  getReasonOptions,
  localizePlaceType,
  localizeProblemType,
  localizeReason,
} from '../../src/utils/requestLocalization';

const ORANGE = '#FF6B00';

export default function DetailsScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const { categoryId, address, latitude, longitude } = params;
  
  const [step, setStep] = useState(1); // 1: place type, 2: problem, 3: reason
  const [placeType, setPlaceType] = useState('');
  const [problemType, setProblemType] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const category = categoryId as string;
  const problems = getProblemOptions(category);
  const reasons = getReasonOptions(category);

  const getStepTitle = () => {
    switch (step) {
      case 1: return t('request.whereIsIssue');
      case 2: return t('request.whatIsProblem');
      case 3: return t('request.whatMightBeCause');
      default: return t('request.details');
    }
  };

  const handleNext = () => {
    if (step === 1 && placeType) {
      setStep(2);
    } else if (step === 2 && problemType) {
      setStep(3);
    } else if (step === 3 && reason) {
      router.push({
        pathname: '/request/confirm',
        params: {
          categoryId,
          address,
          latitude,
          longitude,
          placeType,
          problemType,
          reason,
          description
        }
      });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.optionsContainer}>
            {PLACE_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[styles.optionCard, placeType === type.id && styles.optionCardSelected]}
                onPress={() => setPlaceType(type.id)}
              >
                <View style={[styles.optionIcon, placeType === type.id && styles.optionIconSelected]}>
                  <Ionicons
                    name={type.icon as any}
                    size={24}
                    color={placeType === type.id ? '#FFF' : ORANGE}
                  />
                </View>
                <Text style={[styles.optionLabel, placeType === type.id && styles.optionLabelSelected]}>
                  {localizePlaceType(type.id, t)}
                </Text>
                {placeType === type.id && (
                  <Ionicons name="checkmark-circle" size={24} color={ORANGE} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        );
        
      case 2:
        return (
          <View style={styles.optionsContainer}>
            {problems.map((problem) => (
              <TouchableOpacity
                key={problem.id}
                style={[styles.optionRow, problemType === problem.id && styles.optionRowSelected]}
                onPress={() => setProblemType(problem.id)}
              >
                <Text style={[styles.optionText, problemType === problem.id && styles.optionTextSelected]}>
                  {localizeProblemType(category, problem.id, t)}
                </Text>
                {problemType === problem.id && (
                  <Ionicons name="checkmark-circle" size={22} color={ORANGE} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        );
        
      case 3:
        return (
          <View style={styles.optionsContainer}>
            {reasons.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.optionRow, reason === r.id && styles.optionRowSelected]}
                onPress={() => setReason(r.id)}
              >
                <Text style={[styles.optionText, reason === r.id && styles.optionTextSelected]}>
                  {localizeReason(category, r.id, t)}
                </Text>
                {reason === r.id && (
                  <Ionicons name="checkmark-circle" size={22} color={ORANGE} />
                )}
              </TouchableOpacity>
            ))}
            
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionLabel}>{t('request.additionalDetailsOptional')}</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder={t('request.descriptionPlaceholder')}
                placeholderTextColor="#C7C7CC"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        );
    }
  };

  const isNextDisabled = () => {
    switch (step) {
      case 1: return !placeType;
      case 2: return !problemType;
      case 3: return !reason;
      default: return true;
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.stepIndicator}>{t('request.step', { step, total: 3 })}</Text>
          <Text style={styles.headerTitle}>{getStepTitle()}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${(step / 3) * 100}%` }]} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {renderStep()}
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextButton, isNextDisabled() && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={isNextDisabled()}
        >
          <Text style={styles.nextText}>{step === 3 ? t('request.review') : t('common.continue')}</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  header: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerContent: {
    flex: 1,
    marginLeft: 8
  },
  stepIndicator: {
    fontSize: 13,
    color: ORANGE,
    fontWeight: '600'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 2
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E5E5EA'
  },
  progressBar: {
    height: '100%',
    backgroundColor: ORANGE
  },
  content: {
    flex: 1,
    padding: 16
  },
  optionsContainer: {
    gap: 12
  },
  optionCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  optionCardSelected: {
    borderColor: ORANGE,
    backgroundColor: `${ORANGE}08`
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: `${ORANGE}15`,
    alignItems: 'center',
    justifyContent: 'center'
  },
  optionIconSelected: {
    backgroundColor: ORANGE
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 16
  },
  optionLabelSelected: {
    color: ORANGE
  },
  optionRow: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  optionRowSelected: {
    backgroundColor: `${ORANGE}10`,
    borderWidth: 1,
    borderColor: ORANGE
  },
  optionText: {
    fontSize: 16,
    color: '#1C1C1E'
  },
  optionTextSelected: {
    fontWeight: '600',
    color: ORANGE
  },
  descriptionSection: {
    marginTop: 16
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8
  },
  descriptionInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1C1C1E',
    minHeight: 120
  },
  bottomPanel: {
    backgroundColor: '#FFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7'
  },
  nextButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  buttonDisabled: {
    opacity: 0.5
  },
  nextText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600'
  }
});
