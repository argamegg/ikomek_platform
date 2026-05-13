import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';

type SplashVideoProps = {
  onFinish: () => void;
};

export function SplashVideo({ onFinish }: SplashVideoProps) {
  const hasFinishedRef = useRef(false);
  const source = useMemo(() => require('../../assets/logo_anim.mp4'), []);
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    instance.muted = true;
    instance.play();
  });

  useEventListener(player, 'playToEnd', () => {
    if (hasFinishedRef.current) {
      return;
    }

    hasFinishedRef.current = true;
    onFinish();
  });

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '70%',
    aspectRatio: 1,
  },
});
