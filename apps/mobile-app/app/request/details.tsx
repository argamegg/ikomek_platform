import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const ORANGE = '#FF6B00';

const PLACE_TYPES = [
  { id: 'apartment', label: 'Apartment', icon: 'business' },
  { id: 'house', label: 'Private House', icon: 'home' },
  { id: 'office', label: 'Office', icon: 'briefcase' },
  { id: 'street', label: 'Street', icon: 'navigate' },
  { id: 'park', label: 'Park/Square', icon: 'leaf' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' }
];

const PROBLEM_TYPES: Record<string, { id: string; label: string }[]> = {
  electricity: [
    { id: 'power_outage', label: 'Power outage' },
    { id: 'voltage_issue', label: 'Voltage fluctuation' },
    { id: 'damaged_cables', label: 'Damaged cables' },
    { id: 'street_light', label: 'Street light not working' },
    { id: 'sparks', label: 'Sparks/Fire hazard' },
    { id: 'other', label: 'Other electrical issue' }
  ],
  water: [
    { id: 'no_water', label: 'No water supply' },
    { id: 'low_pressure', label: 'Low water pressure' },
    { id: 'pipe_leak', label: 'Pipe leak' },
    { id: 'dirty_water', label: 'Dirty/discolored water' },
    { id: 'sewage', label: 'Sewage problem' },
    { id: 'other', label: 'Other water issue' }
  ],
  roads: [
    { id: 'pothole', label: 'Pothole' },
    { id: 'damaged_pavement', label: 'Damaged pavement' },
    { id: 'road_sign', label: 'Missing/damaged road sign' },
    { id: 'traffic_light', label: 'Traffic light issue' },
    { id: 'road_marking', label: 'Road marking needed' },
    { id: 'other', label: 'Other road issue' }
  ],
  public_order: [
    { id: 'noise', label: 'Noise complaint' },
    { id: 'illegal_parking', label: 'Illegal parking' },
    { id: 'vandalism', label: 'Vandalism' },
    { id: 'abandoned_vehicle', label: 'Abandoned vehicle' },
    { id: 'stray_animals', label: 'Stray animals' },
    { id: 'other', label: 'Other public order issue' }
  ],
  waste: [
    { id: 'overflowing', label: 'Overflowing trash bin' },
    { id: 'illegal_dump', label: 'Illegal dump site' },
    { id: 'missed_collection', label: 'Missed garbage collection' },
    { id: 'hazardous', label: 'Hazardous waste' },
    { id: 'bulk_waste', label: 'Bulk waste removal needed' },
    { id: 'other', label: 'Other waste issue' }
  ],
  heating: [
    { id: 'no_heating', label: 'No heating' },
    { id: 'radiator_leak', label: 'Radiator leak' },
    { id: 'cold_apartment', label: 'Cold apartment' },
    { id: 'overheating', label: 'Overheating' },
    { id: 'noise', label: 'Heating system noise' },
    { id: 'other', label: 'Other heating issue' }
  ],
  street_lighting: [
    { id: 'lamp_out', label: 'Lamp not working' },
    { id: 'flickering', label: 'Flickering light' },
    { id: 'damaged_pole', label: 'Damaged pole' },
    { id: 'dark_area', label: 'Dark area needs lighting' },
    { id: 'timer', label: 'Timer malfunction' },
    { id: 'other', label: 'Other lighting issue' }
  ],
  other: [
    { id: 'general', label: 'General complaint' },
    { id: 'suggestion', label: 'Suggestion' },
    { id: 'question', label: 'Question' },
    { id: 'other', label: 'Other' }
  ]
};

const REASONS: Record<string, { id: string; label: string }[]> = {
  electricity: [
    { id: 'infrastructure', label: 'Infrastructure failure' },
    { id: 'weather', label: 'Weather damage' },
    { id: 'overload', label: 'System overload' },
    { id: 'maintenance', label: 'Needs maintenance' },
    { id: 'accident', label: 'Accident/External damage' },
    { id: 'unknown', label: 'Unknown cause' }
  ],
  water: [
    { id: 'pipe_burst', label: 'Pipe burst' },
    { id: 'maintenance', label: 'Scheduled maintenance' },
    { id: 'infrastructure', label: 'Old infrastructure' },
    { id: 'external', label: 'External damage' },
    { id: 'pressure', label: 'Pressure issue' },
    { id: 'unknown', label: 'Unknown cause' }
  ],
  roads: [
    { id: 'weather', label: 'Weather wear' },
    { id: 'traffic', label: 'Heavy traffic damage' },
    { id: 'construction', label: 'Construction damage' },
    { id: 'age', label: 'Age deterioration' },
    { id: 'accident', label: 'Accident damage' },
    { id: 'unknown', label: 'Unknown cause' }
  ],
  public_order: [
    { id: 'resident', label: 'Resident complaint' },
    { id: 'safety', label: 'Public safety concern' },
    { id: 'community', label: 'Community concern' },
    { id: 'legal', label: 'Legal violation' },
    { id: 'recurring', label: 'Recurring issue' },
    { id: 'other', label: 'Other reason' }
  ],
  waste: [
    { id: 'schedule', label: 'Schedule issue' },
    { id: 'container', label: 'Container damage' },
    { id: 'illegal', label: 'Illegal dumping' },
    { id: 'volume', label: 'Volume increase' },
    { id: 'access', label: 'Access problem' },
    { id: 'other', label: 'Other reason' }
  ],
  heating: [
    { id: 'boiler', label: 'Boiler issue' },
    { id: 'pipe', label: 'Pipe problem' },
    { id: 'system', label: 'System failure' },
    { id: 'regulation', label: 'Temperature regulation' },
    { id: 'maintenance', label: 'Needs maintenance' },
    { id: 'unknown', label: 'Unknown cause' }
  ],
  street_lighting: [
    { id: 'bulb', label: 'Bulb failure' },
    { id: 'electrical', label: 'Electrical issue' },
    { id: 'vandalism', label: 'Vandalism' },
    { id: 'timer', label: 'Timer malfunction' },
    { id: 'age', label: 'Age/Wear' },
    { id: 'unknown', label: 'Unknown cause' }
  ],
  other: [
    { id: 'quality', label: 'Quality of service' },
    { id: 'safety', label: 'Safety concern' },
    { id: 'environment', label: 'Environmental issue' },
    { id: 'other', label: 'Other' }
  ]
};

export default function DetailsScreen() {
  const params = useLocalSearchParams();
  const { categoryId, address, latitude, longitude } = params;
  
  const [step, setStep] = useState(1); // 1: place type, 2: problem, 3: reason
  const [placeType, setPlaceType] = useState('');
  const [problemType, setProblemType] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const problems = PROBLEM_TYPES[categoryId as string] || PROBLEM_TYPES.other;
  const reasons = REASONS[categoryId as string] || REASONS.other;

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'Where is the issue?';
      case 2: return 'What is the problem?';
      case 3: return 'What might be the cause?';
      default: return 'Details';
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
                  {type.label}
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
                onPress={() => setProblemType(problem.label)}
              >
                <Text style={[styles.optionText, problemType === problem.label && styles.optionTextSelected]}>
                  {problem.label}
                </Text>
                {problemType === problem.label && (
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
                style={[styles.optionRow, reason === r.label && styles.optionRowSelected]}
                onPress={() => setReason(r.label)}
              >
                <Text style={[styles.optionText, reason === r.label && styles.optionTextSelected]}>
                  {r.label}
                </Text>
                {reason === r.label && (
                  <Ionicons name="checkmark-circle" size={22} color={ORANGE} />
                )}
              </TouchableOpacity>
            ))}
            
            <View style={styles.descriptionSection}>
              <Text style={styles.descriptionLabel}>Additional details (optional)</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Describe the issue in more detail..."
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.stepIndicator}>Step {step} of 3</Text>
          <Text style={styles.headerTitle}>{getStepTitle()}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${(step / 3) * 100}%` }]} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {renderStep()}
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextButton, isNextDisabled() && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={isNextDisabled()}
        >
          <Text style={styles.nextText}>{step === 3 ? 'Review' : 'Continue'}</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
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
