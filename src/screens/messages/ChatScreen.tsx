import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Conversation, ConversationParticipant, Message } from '../../types/messages.types';
import { ListingWithImages } from '../../types/listing.types';
import { useAuth } from '../../context/AuthContext';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';
import { messagesService } from '../../services/messages';
import { realtimeService } from '../../services/realtime';
import { formatDateLabel, formatMessageTime, isSameDay } from '../../utils/dateHelpers';
import { LISTING_REFERENCE_PREFIX } from '../../services/messages';

interface ChatRouteParams {
  conversationId: string;
  partner: ConversationParticipant;
  conversation?: Conversation;
  listingContext?: ListingWithImages;
}

interface ListingReferencePayload {
  id: string;
  title?: string | null;
  price?: number | null;
  location?: string | null;
}

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { conversationId, partner } = (route.params as ChatRouteParams) || {};
  const { user } = useAuth();
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const {
    data: messages,
    loading,
    refresh,
  } = useDataFetch<Message[]>({
    cacheKey: `messages:conversation:${conversationId}`,
    fetchFn: () => messagesService.getMessages(conversationId, 400),
    priority: RequestPriority.HIGH,
    enabled: !!conversationId,
    ttl: 30 * 1000,
  });

  const messageList = useMemo(() => messages || [], [messages]);

  const formatListingReferenceInfo = useCallback((payload: ListingReferencePayload) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    return {
      title: payload.title || 'GT-R Listing',
      price:
        typeof payload.price === 'number' ? formatter.format(payload.price) : null,
      location: payload.location || null,
    };
  }, []);

  const parseListingReference = (content?: string | null) => {
    if (!content || !content.startsWith(LISTING_REFERENCE_PREFIX)) return null;
    const payloadString = content.slice(LISTING_REFERENCE_PREFIX.length);
    try {
      return JSON.parse(payloadString) as ListingReferencePayload;
    } catch (error) {
      console.warn('Failed to parse listing reference content', error);
      return null;
    }
  };

  if (!conversationId || !partner) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={{ color: '#FFFFFF' }}>Conversation not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    if (!conversationId) return;

    messagesService
      .markConversationAsRead(conversationId)
      .catch((error) => console.warn('Failed to mark conversation as read', error));
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !partner?.id || !user?.id || messageList.length === 0) {
      return;
    }

    const latestMessage = messageList[messageList.length - 1];
    if (latestMessage.sender_id !== user.id) {
      messagesService
        .markConversationAsRead(conversationId)
        .catch((error) => console.warn('Failed to auto-mark conversation read:', error));
    }
  }, [conversationId, partner?.id, user?.id, messageList]);

  useEffect(() => {
    if (!conversationId) return;

    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      unsubscribe = await realtimeService.subscribeToConversationMessages(conversationId, () => {
        refresh();
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [conversationId, refresh]);

  useEffect(() => {
    if (messageList.length === 0) return;
    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timeout);
  }, [messageList]);

  const handleSend = useCallback(async () => {
    const text = composerText.trim();
    if (!text || !partner?.id || !conversationId) {
      if (!text) {
        Alert.alert('Message required', 'Please enter a message to send.');
      }
      return;
    }

    try {
      setSending(true);
      await messagesService.sendMessage({
        conversationId,
        recipientId: partner.id,
        content: text,
      });
      setComposerText('');
      await refresh();
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Unable to send', 'Please try again in a moment.');
    } finally {
      setSending(false);
    }
  }, [composerText, partner?.id, conversationId, refresh]);

  const handleCall = () => {
    if (!partner?.phone_number) {
      Alert.alert('Unavailable', 'This member has not shared a phone number yet.');
      return;
    }
    Linking.openURL(`tel:${partner.phone_number}`).catch(() => {
      Alert.alert('Unable to start call', 'Check your phone settings and try again.');
    });
  };

  const handleVideoCall = () => {
    Alert.alert('Coming soon', 'Video calling is almost ready. Stay tuned!');
  };

  const handleAttachmentPress = () => {
    Alert.alert('Coming soon', 'Photo sharing will be available soon.');
  };

  const handleMicPress = () => {
    if (composerText.trim()) {
      handleSend();
      return;
    }
    Alert.alert('Coming soon', 'Voice messages are coming soon.');
  };

  const renderListingContextBubble = (
    info: { title: string | null; price: string | null; location: string | null }
  ) => {
    if (!info) return null;
    return (
      <TouchableOpacity
        style={styles.listingContextCard}
        activeOpacity={0.7}
        onPress={() =>
          Alert.alert('Coming soon', 'Listing details will open here soon.')
        }
      >
        <View style={styles.listingContextIndicator} />
        <View style={styles.listingContextBody}>
          <Text style={styles.listingContextLabel}>Listing reference</Text>
          <Text style={styles.listingContextTitle} numberOfLines={1}>
            {info.title}
          </Text>
          {info.price && (
            <Text style={styles.listingContextPrice}>{info.price}</Text>
          )}
          {info.location && (
            <Text style={styles.listingContextLocation}>{info.location}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#8086A2" />
      </TouchableOpacity>
    );
  };

  const renderMessageBubble = (message: Message, index: number) => {
    const listingPayload = parseListingReference(message.content);
    if (listingPayload) {
      const info = formatListingReferenceInfo(listingPayload);
      return renderListingContextBubble(info);
    }

    const isOwnMessage = message.sender_id === user?.id;
    const previousMessage = messageList[index - 1];
    const showDatePill =
      !previousMessage ||
      !isSameDay(new Date(previousMessage.created_at), new Date(message.created_at));

    return (
      <View>
        {showDatePill && (
          <View style={styles.datePill}>
            <Text style={styles.datePillText}>{formatDateLabel(message.created_at)}</Text>
          </View>
        )}
        <View
          style={[
            styles.messageRow,
            isOwnMessage ? styles.messageRowOutgoing : styles.messageRowIncoming,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.messageBubbleOutgoing : styles.messageBubbleIncoming,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isOwnMessage && styles.messageTextOutgoing,
              ]}
            >
              {message.content}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isOwnMessage && styles.messageTimeOutgoing,
              ]}
            >
              {formatMessageTime(message.created_at)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) =>
    renderMessageBubble(item, index);

  const keyExtractor = (item: Message) => item.id;

  const headerDisplayName =
    partner?.full_name || partner?.username || 'GT-R Member';

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
        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerDisplayName}
          </Text>
          {partner?.phone_verified && (
            <Ionicons name="checkmark-circle" size={18} color="#4DA3FF" />
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconButton} onPress={handleCall}>
            <Ionicons name="call-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={handleVideoCall}
          >
            <Ionicons name="videocam-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 70 : 0}
      >
        {loading && messageList.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#DC143C" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messageList}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.messagesList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.composerContainer}>
          <View style={styles.composerInputWrapper}>
            <TouchableOpacity
              style={styles.attachmentButton}
              onPress={handleAttachmentPress}
            >
              <Ionicons name="image-outline" size={20} color="#808080" />
            </TouchableOpacity>
            <TextInput
              style={styles.composerInput}
              placeholder="Message..."
              placeholderTextColor="#808080"
              value={composerText}
              onChangeText={setComposerText}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!composerText.trim() || sending) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!composerText.trim() || sending}
            >
              <Ionicons
                name="send"
                size={18}
                color={
                  !composerText.trim() || sending
                    ? '#666A7A'
                    : '#0F1016'
                }
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.micButton, sending && styles.micButtonDisabled]}
            onPress={handleMicPress}
            disabled={sending}
          >
            <Ionicons name="mic-outline" size={18} color="#000000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F1016',
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
  headerTitleWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatBody: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1C1D24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  listingContextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#161721',
    marginBottom: 12,
  },
  listingContextIndicator: {
    width: 6,
    height: 40,
    borderRadius: 3,
    backgroundColor: '#DC143C',
    marginRight: 12,
  },
  listingContextBody: {
    flex: 1,
  },
  listingContextLabel: {
    fontSize: 12,
    color: '#8086A2',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  listingContextTitle: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listingContextPrice: {
    fontSize: 13,
    color: '#B0B5CC',
    marginTop: 2,
  },
  listingContextLocation: {
    fontSize: 12,
    color: '#8086A2',
    marginTop: 2,
  },
  datePill: {
    alignSelf: 'center',
    backgroundColor: '#1C1D24',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginVertical: 12,
  },
  datePillText: {
    color: '#A0A4B8',
    fontSize: 12,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  messageRowIncoming: {
    justifyContent: 'flex-start',
  },
  messageRowOutgoing: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  messageBubbleIncoming: {
    backgroundColor: '#1F222A',
    borderBottomLeftRadius: 4,
  },
  messageBubbleOutgoing: {
    backgroundColor: '#FFFFFF',
    borderBottomRightRadius: 4,
  },
  messageText: {
    color: '#F5F5F5',
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextOutgoing: {
    color: '#111216',
  },
  messageTime: {
    fontSize: 11,
    color: '#A0A4B8',
    marginTop: 4,
    textAlign: 'right',
  },
  messageTimeOutgoing: {
    color: '#666A7A',
  },
  composerWrapper: {
    width: '100%',
  },
  composerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    gap: 12,
    backgroundColor: '#0F1016',
  },
  composerInputWrapper: {
    flex: 1,
    backgroundColor: '#1C1D24',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attachmentButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
});
