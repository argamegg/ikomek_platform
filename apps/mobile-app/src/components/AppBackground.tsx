import React, { PropsWithChildren, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';

const backgroundMobile = require('../../assets/images/background-mobile.webp');
const backgroundTablet = require('../../assets/images/background-tablet.webp');
const backgroundLaptop = require('../../assets/images/background-laptop.webp');
const backgroundFhd = require('../../assets/images/background-fhd.webp');
const background2k = require('../../assets/images/background-2k.webp');
const backgroundUltrawide = require('../../assets/images/background-ultrawide.webp');
const background4k = require('../../assets/images/background-4k.webp');

type BackgroundPreset = {
  source: number;
  contentPosition: 'top' | 'center';
};

function getResponsiveBackground(width: number, height: number): BackgroundPreset {
  const longestSide = Math.max(width, height);
  const isPortrait = height >= width;
  const aspectRatio = longestSide / Math.max(Math.min(width, height), 1);

  if (isPortrait && width <= 430) {
    return { source: backgroundMobile, contentPosition: 'top' };
  }

  if (isPortrait && width <= 1024) {
    return { source: backgroundTablet, contentPosition: 'top' };
  }

  if (aspectRatio >= 2.1 && longestSide >= 2560) {
    return { source: backgroundUltrawide, contentPosition: 'center' };
  }

  if (longestSide >= 3441) {
    return { source: background4k, contentPosition: 'center' };
  }

  if (longestSide >= 1921) {
    return { source: background2k, contentPosition: 'center' };
  }

  if (longestSide >= 1441) {
    return { source: backgroundFhd, contentPosition: 'center' };
  }

  return { source: backgroundLaptop, contentPosition: isPortrait ? 'top' : 'center' };
}

export function AppBackground({ children }: PropsWithChildren) {
  const { width, height } = useWindowDimensions();
  const background = useMemo(() => getResponsiveBackground(width, height), [height, width]);

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={styles.base} />
        <Image
          source={background.source}
          contentFit="cover"
          contentPosition={background.contentPosition}
          style={styles.image}
        />
        <View style={styles.overlay} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.94,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  content: {
    flex: 1,
  },
});
