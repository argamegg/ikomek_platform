import React, { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

const backgroundImage = require('../../assets/images/app-background.png');

export function AppBackground({ children }: PropsWithChildren) {
  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.backgroundLayer}>
        <View style={styles.base} />
        <Image source={backgroundImage} contentFit="cover" style={styles.image} />
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
    opacity: 0.2,
  },
  content: {
    flex: 1,
  },
});
