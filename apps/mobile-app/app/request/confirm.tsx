import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiService } from '../../src/utils/api';

const ORANGE = '#FF6B00';

const CATEGORY_CONFIG: Record<string, { name: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  electricity: { name: 'Electricity', icon: 'flash', color: '#FFB300' },
  water: { name: 'Water Supply', icon: 'water', color: '#2196F3' },
  roads: { name: 'Roads', icon: 'car', color: '#607D8B' },
  public_order: { name: 'Public Order', icon: 'shield-checkmark', color: '#4CAF50' },
  waste: { name: 'Waste', icon: 'trash', color: '#795548' },
  heating: { name: 'Heating', icon: 'flame', color: '#FF5722' },
  street_lighting: { name: 'Street Lighting', icon: 'bulb', color: '#FFC107' },
  other: { name: 'Other', icon: 'ellipsis-horizontal', color: '#9E9E9E' }
};

export default function ConfirmScreen() {
  const params = useLocalSearchParams();
  const { categoryId, address, latitude, longitude, placeType, problemType, reason, description } = params;
  
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const category = CATEGORY_CONFIG[categoryId as string] || CATEGORY_CONFIG.other;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotos([...photos, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to use camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhotos([...photos, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await apiService.createRequest({
        category_id: categoryId as string,
        address: address as string,
        latitude: parseFloat(latitude as string),
        longitude: parseFloat(longitude as string),
        place_type: placeType as string,
        problem_type: problemType as string,
        reason: reason as string,
        description: (description as string) || `${problemType} - ${reason}`,
        photos: photos
      });
      
      Alert.alert(
        'Success!',
        'Your request has been submitted successfully. We will process it as soon as possible.',
        [
          {
            text: 'View My Requests',
            onPress: () => router.replace('/(tabs)/requests')
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Review & Submit</Text>
          <Text style={styles.headerSubtitle}>Please verify your request details</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.categoryCard}>
            <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
              <Ionicons name={category.icon} size={24} color={category.color} />
            </View>
            <Text style={styles.categoryName}>{category.name}</Text>
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.infoCard}>
            <Ionicons name="location" size={20} color={ORANGE} />
            <Text style={styles.infoText}>{address}</Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Place Type</Text>
            <Text style={styles.detailValue}>{placeType}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Problem</Text>
            <Text style={styles.detailValue}>{problemType}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reason</Text>
            <Text style={styles.detailValue}>{reason}</Text>
          </View>
          
          {description && (
            <View style={styles.descriptionBox}>
              <Text style={styles.detailLabel}>Additional Details</Text>
              <Text style={styles.descriptionText}>{description}</Text>
            </View>
          )}
        </View>

        {/* Photos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos (Optional)</Text>
          <Text style={styles.sectionSubtitle}>Add photos to help us understand the issue better</Text>
          
          <View style={styles.photosContainer}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={{ uri: photo }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhoto}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
            
            {photos.length < 5 && (
              <View style={styles.addPhotoButtons}>
                <TouchableOpacity style={styles.addPhotoBtn} onPress={takePhoto}>
                  <Ionicons name="camera" size={24} color={ORANGE} />
                  <Text style={styles.addPhotoText}>Camera</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                  <Ionicons name="images" size={24} color={ORANGE} />
                  <Text style={styles.addPhotoText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={24} color="#FFF" />
              <Text style={styles.submitText}>Submit Request</Text>
            </>
          )}
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7'
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E'
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2
  },
  content: {
    flex: 1,
    padding: 16
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: -8,
    marginBottom: 12
  },
  categoryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center'
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  categoryName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1C1C1E',
    marginLeft: 16
  },
  infoCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 22
  },
  detailRow: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93'
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16
  },
  descriptionBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16
  },
  descriptionText: {
    fontSize: 15,
    color: '#1C1C1E',
    lineHeight: 22,
    marginTop: 8
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  photoWrapper: {
    position: 'relative'
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 12
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFF',
    borderRadius: 12
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 12
  },
  addPhotoBtn: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: `${ORANGE}40`,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF'
  },
  addPhotoText: {
    fontSize: 12,
    color: ORANGE,
    marginTop: 4,
    fontWeight: '500'
  },
  bottomPanel: {
    backgroundColor: '#FFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7'
  },
  submitButton: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  buttonDisabled: {
    opacity: 0.7
  },
  submitText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600'
  }
});
