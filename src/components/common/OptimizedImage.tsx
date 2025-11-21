import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image, ImageProps, ImageSource } from 'expo-image';
import { FALLBACK_CARD } from '../../utils/imageFallbacks';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  source: string | { uri: string } | ImageSource;
  placeholder?: ImageSource | string;
  fallback?: ImageSource | string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Optimized image component with lazy loading, caching, and error handling
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  placeholder,
  fallback = FALLBACK_CARD,
  priority = 'normal',
  style,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageUri, setImageUri] = useState<string | ImageSource>('');

  useEffect(() => {
    let uri: string | ImageSource | undefined;
    if (typeof source === 'string') {
      uri = source;
    } else if (source && typeof source === 'object' && 'uri' in source) {
      uri = (source as any).uri;
    } else {
      uri = source;
    }
    setImageUri(uri as any);
    setIsLoading(true);
    setHasError(false);

    if (priority === 'high' && typeof uri === 'string' && uri) {
      Image.prefetch(uri).catch(() => {
        // Silently fail prefetch
      });
    }
  }, [source, priority]);

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    setImageUri(fallback as any);
  };

  const displaySource = hasError ? fallback : imageUri;
  const showPlaceholder = isLoading && placeholder;

  return (
    <View style={[styles.container, style]}>
      {showPlaceholder && (
        <Image
          source={placeholder as any}
          style={[StyleSheet.absoluteFill, styles.placeholder]}
          contentFit="cover"
        />
      )}
      <Image
        {...props}
        source={displaySource as any}
        style={[StyleSheet.absoluteFill, style]}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        cachePolicy="memory-disk"
        transition={200}
        priority={priority}
      />
      {isLoading && !showPlaceholder && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#808080" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  placeholder: {
    opacity: 0.5,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333333',
  },
});
