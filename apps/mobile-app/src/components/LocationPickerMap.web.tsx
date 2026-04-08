import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export type LocationPickerCoordinate = {
  lat: number;
  lng: number;
};

export type LocationPickerMapRef = {
  centerOnCoordinate: (lng: number, lat: number, zoom?: number) => void;
};

type LocationPickerMapProps = {
  onCoordinateChange: (coordinate: LocationPickerCoordinate) => void;
  onMapReady: () => void;
  onLocateMePress: () => void;
  isLocating: boolean;
};

export const LocationPickerMap = forwardRef<LocationPickerMapRef, LocationPickerMapProps>(
  ({ onMapReady }, ref) => {
    const { t } = useTranslation();

    useImperativeHandle(
      ref,
      () => ({
        centerOnCoordinate: () => {},
      }),
      [],
    );

    useEffect(() => {
      onMapReady();
    }, [onMapReady]);

    return (
      <View style={styles.container}>
        <Text style={styles.text}>{t('map.nativeLocationOnly')}</Text>
      </View>
    );
  },
);

LocationPickerMap.displayName = 'LocationPickerMap';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    padding: 24,
  },
  text: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
