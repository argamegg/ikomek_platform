import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ORANGE = '#FF6B00';
const GRAY = '#8E8E93';
const TAB_BAR_BG = 'rgba(255, 255, 255, 0.96)';
const CENTER_SLOT_WIDTH = 94;
const CREATE_BUTTON_AURA_SIZE = 74;

interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export const CustomTabBar = ({ state, descriptors, navigation }: TabBarProps) => {
  const insets = useSafeAreaInsets();
  const createRouteIndex = state.routes.findIndex((route: any) => route.name === 'create');
  const createRoute = createRouteIndex >= 0 ? state.routes[createRouteIndex] : null;
  const leftRoutes = createRouteIndex >= 0 ? state.routes.slice(0, createRouteIndex) : state.routes;
  const rightRoutes = createRouteIndex >= 0 ? state.routes.slice(createRouteIndex + 1) : [];

  const getIconName = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (routeName) {
      case 'index':
        return focused ? 'megaphone' : 'megaphone-outline';
      case 'map':
        return focused ? 'map' : 'map-outline';
      case 'create':
        return 'add';
      case 'requests':
        return focused ? 'checkbox' : 'checkbox-outline';
      case 'profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const onTabPress = (route: any, isFocused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const renderTab = (route: any) => {
    const options = descriptors[route.key]?.options ?? {};
    const isFocused = state.routes[state.index]?.key === route.key;

    return (
      <TouchableOpacity
        key={route.key}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel}
        testID={options.tabBarButtonTestID}
        onPress={() => onTabPress(route, isFocused)}
        style={styles.tab}
        activeOpacity={0.7}
      >
        <Ionicons
          name={getIconName(route.name, isFocused)}
          size={24}
          color={isFocused ? ORANGE : GRAY}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.shell}>
        <View style={styles.barBackground} />

        <View style={styles.tabRow}>
          <View style={styles.tabGroup}>{leftRoutes.map(renderTab)}</View>
          <View style={styles.centerSlot} />
          <View style={styles.tabGroup}>{rightRoutes.map(renderTab)}</View>
        </View>

        {createRoute ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={state.index === createRouteIndex ? { selected: true } : {}}
            accessibilityLabel={descriptors[createRoute.key]?.options?.tabBarAccessibilityLabel}
            testID={descriptors[createRoute.key]?.options?.tabBarButtonTestID}
            onPress={() => onTabPress(createRoute, state.index === createRouteIndex)}
            style={styles.createButtonContainer}
            activeOpacity={0.85}
          >
            <View style={styles.createButtonAura}>
              <View style={styles.createButton}>
                <Ionicons name="add" size={34} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  shell: {
    position: 'relative',
    height: 96,
    justifyContent: 'flex-end',
  },
  barBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    borderRadius: 36,
    backgroundColor: TAB_BAR_BG,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 12,
  },
  tabRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  tabGroup: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerSlot: {
    width: CENTER_SLOT_WIDTH,
    height: '100%',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  createButtonContainer: {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: [{ translateX: -CREATE_BUTTON_AURA_SIZE / 2 }],
    zIndex: 4,
  },
  createButtonAura: {
    width: CREATE_BUTTON_AURA_SIZE,
    height: CREATE_BUTTON_AURA_SIZE,
    borderRadius: CREATE_BUTTON_AURA_SIZE / 2,
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
