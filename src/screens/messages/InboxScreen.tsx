import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';
import { messagesService } from '../../services/messages';
import { Conversation } from '../../types/messages.types';
import { realtimeService } from '../../services/realtime';
import { formatConversationTimestamp } from '../../utils/dateHelpers';

type InboxTab = 'chats' | 'calls';

export const InboxScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<InboxTab>('chats');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: conversations,
    loading,
    refresh,
  } = useDataFetch<Conversation[]>({
    cacheKey: 'messages:conversations',
    fetchFn: () => messagesService.getConversations(200),
    priority: RequestPriority.HIGH,
    ttl: 60 * 1000,
  });

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      unsubscribe = await realtimeService.subscribeToConversations(() => {
        refresh();
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [refresh]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!searchTerm.trim()) return conversations;

    const query = searchTerm.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const displayName =
        conversation.partner.full_name ||
        conversation.partner.username ||
        'GT-R Member';
      return displayName.toLowerCase().includes(query);
    });
  }, [conversations, searchTerm]);

  const handleConversationPress = (conversation: Conversation) => {
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      partner: conversation.partner,
      conversation,
    });
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const displayName =
      item.partner.full_name || item.partner.username || 'GT-R Member';
    const preview =
      item.last_message_preview || 'Start a conversation with this member.';
    const timestamp = formatConversationTimestamp(item.last_message_at);

    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.8}
      >
        {item.partner.avatar_url ? (
          <ExpoImage
            source={{ uri: item.partner.avatar_url }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={28} color="#808080" />
          </View>
        )}

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.conversationTime}>{timestamp}</Text>
          </View>
          <Text style={styles.conversationPreview} numberOfLines={1}>
            {preview}
          </Text>
        </View>

        {item.unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {item.unreadCount > 99 ? '99+' : item.unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const handleCallsTabPress = () => {
    setActiveTab('calls');
  };

  const handleChatsTabPress = () => {
    setActiveTab('chats');
  };

  const handleSearchToggle = () => {
    setSearchVisible((prev) => !prev);
    setSearchTerm('');
  };

  const handleMorePress = () => {
    Alert.alert('Coming soon', 'More inbox actions will be available soon.');
  };

  const listEmptyComponent = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="chatbubble-ellipses-outline" size={48} color="#808080" />
        <Text style={styles.emptyTitle}>No conversations yet</Text>
        <Text style={styles.emptySubtitle}>
          Messages with other members will show up here.
        </Text>
      </View>
    );
  };

  const renderCallsComingSoon = () => (
    <View style={styles.callsPlaceholder}>
      <View style={styles.callsIconWrapper}>
        <Ionicons name="call-outline" size={36} color="#FFFFFF" />
      </View>
      <Text style={styles.callsTitle}>Calling is coming soon</Text>
      <Text style={styles.callsSubtitle}>
        We're building a premium calling experience right inside GT-R.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inbox</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleSearchToggle}
          >
            <Ionicons name="search" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleMorePress}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {searchVisible && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#808080" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chats"
            placeholderTextColor="#666A7A"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoFocus
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={18} color="#666A7A" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'chats' && styles.tabButtonActive,
          ]}
          onPress={handleChatsTabPress}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'chats' && styles.tabLabelActive,
            ]}
          >
            Chats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'calls' && styles.tabButtonActive,
          ]}
          onPress={handleCallsTabPress}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'calls' && styles.tabLabelActive,
            ]}
          >
            Calls
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !conversations ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
        </View>
      ) : activeTab === 'calls' ? (
        renderCallsComingSoon()
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#DC143C"
            />
          }
          ListEmptyComponent={listEmptyComponent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#12131A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1D24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1D24',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  tabs: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 8,
    marginHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F212B',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 16,
    color: '#666A7A',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1F212B',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 16,
    backgroundColor: '#1F222A',
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 16,
    backgroundColor: '#1F222A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2D3A',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: '#808080',
  },
  conversationPreview: {
    fontSize: 14,
    color: '#808080',
  },
  unreadBadge: {
    backgroundColor: '#DC143C',
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#808080',
  },
  callsPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  callsIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1F222A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  callsSubtitle: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
    lineHeight: 20,
  },
});
