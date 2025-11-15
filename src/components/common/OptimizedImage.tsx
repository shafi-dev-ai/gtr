import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image, ImageProps } from 'expo-image';
import { ImageCache } from 'expo-image';

interface OptimizedImageProps extends Omit<ImageProps, 'source'> {
  source: string | { uri: string };
  placeholder?: string;
  fallback?: string;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Optimized image component with lazy loading, caching, and error handling
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  placeholder,
  fallback = 'https://picsum.photos/800/600',
  priority = 'normal',
  style,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imageUri, setImageUri] = useState<string>('');

  useEffect(() => {
    const uri = typeof source === 'string' ? source : source.uri;
    setImageUri(uri);
    setIsLoading(true);
    setHasError(false);

    // Preload image if high priority
    if (priority === 'high' && uri) {
      ImageCache.prefetch(uri).catch(() => {
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
    if (imageUri !== fallback) {
      setImageUri(fallback);
    }
  };

  const displayUri = hasError ? fallback : imageUri;
  const showPlaceholder = isLoading && placeholder;

  return (
    <View style={[styles.container, style]}>
      {showPlaceholder && (
        <Image
          source={{ uri: placeholder }}
          style={[StyleSheet.absoluteFill, styles.placeholder]}
          contentFit="cover"
        />
      )}
      <Image
        {...props}
        source={{ uri: displayUri }}
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

