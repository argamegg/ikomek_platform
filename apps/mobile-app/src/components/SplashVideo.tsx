import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ResizeMode, type AVPlaybackStatus, Video } from 'expo-av';

type SplashVideoProps = {
  onFinish: () => void;
};

export function SplashVideo({ onFinish }: SplashVideoProps) {
  const hasFinishedRef = useRef(false);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded || hasFinishedRef.current || !status.didJustFinish) {
      return;
    }

    hasFinishedRef.current = true;
    onFinish();
  };

  return (
    <View style={styles.container}>
      <Video
        source={require('../../assets/logo_anim.mp4')}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        isMuted
        useNativeControls={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
});
