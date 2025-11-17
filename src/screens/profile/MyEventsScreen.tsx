import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { eventsService } from '../../services/events';
import { EventWithCreator } from '../../types/event.types';
import { EventCard } from '../../components/shared/EventCard';
import { useDataFetch } from '../../hooks/useDataFetch';
import dataManager, { RequestPriority } from '../../services/dataManager';

export const MyEventsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [deleteProcessingId, setDeleteProcessingId] = useState<string | null>(null);

  const { data: events, loading, refresh } = useDataFetch<EventWithCreator[]>({
    cacheKey: `user:events:${user?.id || ''}`,
    fetchFn: () => eventsService.getUserEvents(user?.id || ''),
    priority: RequestPriority.HIGH,
    enabled: !!user,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleEventPress = (event: EventWithCreator) => {
    // TODO: Navigate to event detail
    console.log('Event pressed:', event.id);
  };

  const handleFavorite = () => {
    // Refresh events after favorite
    refresh();
  };

  const invalidateEventCaches = useCallback(() => {
    dataManager.invalidateCache(new RegExp(`^user:events:${user?.id || ''}`));
    dataManager.invalidateCache(/^home:events/);
  }, [user?.id]);

  const handleDeleteEvent = useCallback(
    (event: EventWithCreator) => {
      Alert.alert(
        'Delete Event',
        'Are you sure you want to delete this event? This action cannot be undone and all RSVPs will be removed.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeleteProcessingId(event.id);
              try {
                await eventsService.deleteEvent(event.id);
                invalidateEventCaches();
                await refresh();
              } catch (error) {
                console.error('Error deleting event:', error);
                Alert.alert('Delete failed', 'Could not delete the event. Please try again.');
              } finally {
                setDeleteProcessingId(null);
              }
            },
          },
        ]
      );
    },
    [invalidateEventCaches, refresh]
  );

  const handleEditEvent = (event: EventWithCreator) => {
    Alert.alert(
      'Edit Event',
      'Editing events will be available soon. For now, please contact support to make changes.'
    );
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
        <Text style={styles.headerTitle}>My Events</Text>
        <View style={styles.placeholder} />
      </View>

      {loading && !events ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      ) : events && events.length > 0 ? (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => handleEventPress(item)}
              onFavorite={handleFavorite}
              mode="owner"
              onDelete={() => handleDeleteEvent(item)}
              deleteLoading={deleteProcessingId === item.id}
            />
          )}
          contentContainerStyle={styles.listContent}
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
          <Ionicons name="calendar-outline" size={64} color="#808080" />
          <Text style={styles.emptyText}>No events yet</Text>
          <Text style={styles.emptySubtext}>Create an event to bring the GT-R community together</Text>
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

