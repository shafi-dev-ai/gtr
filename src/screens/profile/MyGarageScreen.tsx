import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '../../context/AuthContext';
import { garageService } from '../../services/garage';
import { UserGarage } from '../../types/garage.types';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

interface GarageCardProps {
  item: UserGarage;
  onPress: () => void;
}

const GarageCard: React.FC<GarageCardProps> = ({ item, onPress }) => {
  const imageUrl = item.cover_image_url || 'https://picsum.photos/800/600';
  const displayName = item.nickname || `${item.model}${item.year ? ` ${item.year}` : ''}`;

  return (
    <TouchableOpacity
      style={styles.garageCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <ExpoImage
        source={{ uri: imageUrl }}
        style={styles.garageImage}
        contentFit="cover"
      />
      <View style={styles.garageOverlay}>
        <View style={styles.garageInfo}>
          <Text style={styles.garageName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.garageModel} numberOfLines={1}>
            {item.model}
          </Text>
          {item.year && (
            <Text style={styles.garageYear}>{item.year}</Text>
          )}
          {item.mods && item.mods.length > 0 && (
            <View style={styles.modsContainer}>
              <Ionicons name="construct-outline" size={16} color="#FFFFFF" />
              <Text style={styles.modsText}>{item.mods.length} mods</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const MyGarageScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: garageItems, loading, refresh } = useDataFetch<UserGarage[]>({
    cacheKey: `user:garage:${user?.id || ''}`,
    fetchFn: () => garageService.getUserGarage(user?.id || ''),
    priority: RequestPriority.HIGH,
    enabled: !!user,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleGarageItemPress = (item: UserGarage) => {
    // TODO: Navigate to garage item detail
    console.log('Garage item pressed:', item.id);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Garage</Text>
        <View style={styles.placeholder} />
      </View>

      {loading && !garageItems ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Loading garage...</Text>
        </View>
      ) : garageItems && garageItems.length > 0 ? (
        <FlatList
          data={garageItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GarageCard
              item={item}
              onPress={() => handleGarageItemPress(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#DC143C"
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-sport-outline" size={64} color="#808080" />
          <Text style={styles.emptyText}>No garage items yet</Text>
          <Text style={styles.emptySubtext}>Add your GT-R to your garage to showcase your collection</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#13141C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D3A',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginLeft: -20,
  },
  placeholder: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#808080',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  garageCard: {
    width: CARD_WIDTH,
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#1F222A',
  },
  garageImage: {
    width: '100%',
    height: '100%',
  },
  garageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
  },
  garageInfo: {
    flex: 1,
  },
  garageName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  garageModel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#DC143C',
    marginBottom: 4,
  },
  garageYear: {
    fontSize: 12,
    color: '#808080',
    marginBottom: 8,
  },
  modsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modsText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
  },
});
