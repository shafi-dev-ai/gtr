import { Alert } from 'react-native';
import { messagesService } from '../services/messages';
import { ListingWithImages } from '../types/listing.types';

interface OpenChatOptions {
  partnerId: string;
  navigation: any;
  fallbackName?: string | null;
  listing?: ListingWithImages;
}

export const openChatWithUser = async ({
  partnerId,
  navigation,
  fallbackName,
  listing,
}: OpenChatOptions) => {
  try {
    const conversation = await messagesService.ensureConversationWithUser(partnerId);

    if (listing) {
      try {
        await messagesService.sendListingReferenceMessage(
          conversation.id,
          partnerId,
          listing
        );
      } catch (error) {
        console.warn('Failed to send listing reference message:', error);
      }
    }

    navigation.navigate('Chat', {
      conversationId: conversation.id,
      partner: conversation.partner,
      conversation,
      listingContext: listing,
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

export const formatListingCardInfo = (listing?: ListingWithImages | null) => {
  if (!listing) return null;
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const title =
    listing.title || `${listing.year || ''} ${listing.model || ''}`.trim();
  const price = listing.price ? formatter.format(listing.price) : null;
  const location =
    listing.location ||
    [listing.city, listing.state].filter(Boolean).join(', ') ||
    null;

  return { title, price, location };
};
