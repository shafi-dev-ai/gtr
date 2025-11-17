import { Alert } from 'react-native';
import { messagesService } from '../services/messages';
import { ListingWithImages } from '../types/listing.types';

interface OpenChatOptions {
  partnerId: string;
  navigation: any;
  fallbackName?: string | null;
}

export const openChatWithUser = async ({
  partnerId,
  navigation,
  fallbackName,
}: OpenChatOptions) => {
  try {
    const conversation = await messagesService.ensureConversationWithUser(partnerId);
    navigation.navigate('Chat', {
      conversationId: conversation.id,
      partner: conversation.partner,
      conversation,
    });
  } catch (error: any) {
    const message =
      error?.message ||
      `We couldn't start a conversation with ${
        fallbackName || 'this member'
      }. Please try again.`;
    Alert.alert('Unable to open chat', message);
    console.error('openChatWithUser error:', error);
  }
};
