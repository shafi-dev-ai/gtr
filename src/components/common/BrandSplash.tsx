import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Image as RNImage,
  Dimensions,
} from 'react-native';
import { SvgUri } from 'react-native-svg';

interface BrandSplashProps {
  message?: string;
}

const SPINNER_RADIUS = 18;
const DOT_COUNT = 8;
const DOTS = Array.from({ length: DOT_COUNT }, (_, index) => {
  const angle = (360 / DOT_COUNT) * index;
  const size = 5 + ((index % 3) + 1);
  const opacity = 0.3 + (0.7 * (DOT_COUNT - index)) / DOT_COUNT;
  return { angle, size, opacity };
});

const LOGO_SOURCE = RNImage.resolveAssetSource(require('../../../assets/images/logo.svg'));

export const BrandSplash: React.FC<BrandSplashProps> = ({ message }) => {
  const spinnerRotation = useRef(new Animated.Value(0)).current;
  const logoDimensions = useMemo(() => {
    const { width, height } = LOGO_SOURCE;
    if (!width || !height) {
      return { width: 220, height: 110 };
    }
    const maxWidth = Dimensions.get('window').width * 0.6;
    const scale = Math.min(maxWidth / width, 1);
    return { width: width * scale, height: height * scale };
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinnerRotation, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => animation.stop();
  }, [spinnerRotation]);

  const rotate = spinnerRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <SvgUri uri={LOGO_SOURCE.uri} width={logoDimensions.width} height={logoDimensions.height} />
      </View>

      <View style={styles.bottomCluster}>
        <Animated.View style={[styles.spinnerOrbit, { transform: [{ rotate }] }]}>
          {DOTS.map((dot, index) => (
            <View
              key={`${dot.angle}-${index}`}
              style={[
                styles.spinnerDot,
                {
                  width: dot.size,
                  height: dot.size,
                  borderRadius: dot.size / 2,
                  opacity: dot.opacity,
                  transform: [
                    { rotate: `${dot.angle}deg` },
                    { translateY: -SPINNER_RADIUS },
                  ],
                },
              ]}
            />
          ))}
        </Animated.View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1018',
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bottomCluster: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  spinnerOrbit: {
    width: SPINNER_RADIUS * 2 + 14,
    height: SPINNER_RADIUS * 2 + 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerDot: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
  message: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

