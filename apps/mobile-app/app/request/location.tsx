import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

const ORANGE = '#FF6B00';

const LOCATION_PICKER_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Select Location</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol@v8.2.0/ol.css">
    <script src="https://cdn.jsdelivr.net/npm/ol@v8.2.0/dist/ol.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; }
        #map { width: 100%; height: 100%; }
        .center-marker {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -100%);
            font-size: 48px;
            z-index: 1000;
            pointer-events: none;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .controls {
            position: absolute;
            bottom: 100px;
            right: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 100;
        }
        .control-btn {
            width: 48px;
            height: 48px;
            border-radius: 24px;
            background: white;
            border: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            font-size: 20px;
            cursor: pointer;
        }
        .control-btn:active { background: #F2F2F7; }
    </style>
</head>
<body>
    <div id="map"></div>
    <div class="center-marker">📍</div>
    <div class="controls">
        <button class="control-btn" id="zoomIn">+</button>
        <button class="control-btn" id="zoomOut">−</button>
        <button class="control-btn" id="locateMe">🎯</button>
    </div>
    <script>
        const ASTANA_CENTER = [71.4306, 51.1282];
        
        const map = new ol.Map({
            target: 'map',
            layers: [new ol.layer.Tile({ source: new ol.source.OSM() })],
            view: new ol.View({
                center: ol.proj.fromLonLat(ASTANA_CENTER),
                zoom: 14,
                minZoom: 10,
                maxZoom: 19
            }),
            controls: []
        });
        
        function getCenter() {
            const center = ol.proj.toLonLat(map.getView().getCenter());
            return { lng: center[0], lat: center[1] };
        }
        
        function centerMap(lng, lat, zoom) {
            map.getView().animate({
                center: ol.proj.fromLonLat([lng, lat]),
                zoom: zoom || 16,
                duration: 500
            });
        }
        
        map.on('moveend', () => {
            const center = getCenter();
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'locationChanged',
                    lat: center.lat,
                    lng: center.lng
                }));
            }
        });
        
        document.getElementById('zoomIn').addEventListener('click', () => {
            map.getView().animate({ zoom: map.getView().getZoom() + 1, duration: 250 });
        });
        
        document.getElementById('zoomOut').addEventListener('click', () => {
            map.getView().animate({ zoom: map.getView().getZoom() - 1, duration: 250 });
        });
        
        document.getElementById('locateMe').addEventListener('click', () => {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'requestLocation' }));
            }
        });
        
        window.mapFunctions = { getCenter, centerMap };
        
        if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
        }
    </script>
</body>
</html>
`;

export default function LocationScreen() {
  const params = useLocalSearchParams();
  const categoryId = params.categoryId as string;
  
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: 51.1282, lng: 71.4306 });
  const [isLoading, setIsLoading] = useState(true);
  const [isLocating, setIsLocating] = useState(false);
  
  const webViewRef = useRef<WebView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Try to get user's current location on mount
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        
        setCoordinates({ lat: latitude, lng: longitude });
        
        // Center map on user location
        webViewRef.current?.injectJavaScript(`
          window.mapFunctions.centerMap(${longitude}, ${latitude}, 16);
          true;
        `);
        
        // Reverse geocode
        await reverseGeocode(latitude, longitude);
      }
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setIsLocating(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const loc = results[0];
        const parts = [
          loc.street,
          loc.streetNumber,
          loc.district,
          loc.city
        ].filter(Boolean);
        setAddress(parts.join(', ') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (error) {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'mapReady':
          setIsLoading(false);
          break;
          
        case 'locationChanged':
          setCoordinates({ lat: data.lat, lng: data.lng });
          await reverseGeocode(data.lat, data.lng);
          break;
          
        case 'requestLocation':
          await getCurrentLocation();
          break;
      }
    } catch (error) {
      console.error('WebView message error:', error);
    }
  };

  const handleContinue = () => {
    if (!address) {
      Alert.alert('Error', 'Please select a location on the map');
      return;
    }
    
    router.push({
      pathname: '/request/details',
      params: {
        categoryId,
        address,
        latitude: coordinates.lat.toString(),
        longitude: coordinates.lng.toString()
      }
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Select Location</Text>
          <Text style={styles.headerSubtitle}>Drag the map to set the location</Text>
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: LOCATION_PICKER_HTML }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
        
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={ORANGE} />
          </View>
        )}
        
        {isLocating && (
          <View style={styles.locatingBadge}>
            <ActivityIndicator size="small" color="#FFF" />
            <Text style={styles.locatingText}>Getting location...</Text>
          </View>
        )}
      </View>

      {/* Bottom Panel */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.addressContainer}>
          <Ionicons name="location" size={24} color={ORANGE} />
          <View style={styles.addressContent}>
            <Text style={styles.addressLabel}>Selected Address</Text>
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Address will appear here..."
              placeholderTextColor="#C7C7CC"
              multiline
            />
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.continueButton, !address && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!address}
        >
          <Text style={styles.continueText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF'
  },
  header: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    zIndex: 100
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
  mapContainer: {
    flex: 1
  },
  webview: {
    flex: 1
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  locatingBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  locatingText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500'
  },
  bottomPanel: {
    backgroundColor: '#FFF',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  addressContent: {
    flex: 1,
    marginLeft: 12
  },
  addressLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4
  },
  addressInput: {
    fontSize: 16,
    color: '#1C1C1E',
    lineHeight: 22
  },
  continueButton: {
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
  continueText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600'
  }
});
