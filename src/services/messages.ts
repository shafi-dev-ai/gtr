import { supabase } from './supabase';
import dataManager from './dataManager';
import {
  Conversation,
  ConversationParticipant,
  Message,
  SendMessagePayload,
} from '../types/messages.types';
import { ListingWithImages } from '../types/listing.types';

type RawConversation = {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_unread_count: number;
  user2_unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const LISTING_REFERENCE_PREFIX = '__listing_ref__:';

type ListingReferencePayload = {
  id: string;
  title?: string | null;
  price?: number | null;
  location?: string | null;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  phone_verified?: boolean;
};

const invalidateConversationCaches = (conversationId?: string) => {
  dataManager.invalidateCache(/^messages:conversations/);
  dataManager.invalidateCache('messages:unread_count');
  if (conversationId) {
    dataManager.invalidateCache(new RegExp(`^messages:conversation:${conversationId}`));
  }
};

const buildProfilesMap = (profiles: ProfileRecord[]): Record<string, ConversationParticipant> => {
  const map: Record<string, ConversationParticipant> = {};
  profiles.forEach((profile) => {
    map[profile.id] = {
      id: profile.id,
      full_name: profile.full_name,
      username: profile.username,
      avatar_url: profile.avatar_url,
      phone_number: profile.phone_number,
      phone_verified: profile.phone_verified,
    };
  });
  return map;
};

const formatConversationPreview = (preview?: string | null): string | null => {
  if (!preview) return preview ?? null;
  if (!preview.startsWith(LISTING_REFERENCE_PREFIX)) {
    return preview;
  }

  try {
    const payload = JSON.parse(
      preview.slice(LISTING_REFERENCE_PREFIX.length)
    ) as ListingReferencePayload;
    const listingName = payload.title || 'GT-R Listing';
    return `Listing reference • ${listingName}`;
  } catch (error) {
    console.warn('Failed to parse listing preview payload:', error);
    return 'Listing reference shared';
  }
};

const mapConversationRecord = (
  record: RawConversation,
  currentUserId: string,
  profilesMap: Record<string, ConversationParticipant>
): Conversation => {
  const partnerId =
    record.user1_id === currentUserId ? record.user2_id : record.user1_id;

  const partnerProfile = profilesMap[partnerId];

  const partnerInfo: ConversationParticipant = {
    id: partnerId,
    full_name: partnerProfile?.full_name || null,
    username: partnerProfile?.username || null,
    avatar_url: partnerProfile?.avatar_url || null,
    phone_number: partnerProfile?.phone_number || null,
    phone_verified: partnerProfile?.phone_verified,
  };

  const unreadCount =
    record.user1_id === currentUserId
      ? record.user1_unread_count || 0
      : record.user2_unread_count || 0;

  const lastMessagePreview = formatConversationPreview(record.last_message_preview);

  return {
    ...record,
    last_message_preview: lastMessagePreview,
    partner: partnerInfo,
    unreadCount,
  };
};

const fetchProfilesMap = async (
  userIds: string[]
): Promise<Record<string, ConversationParticipant>> => {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, phone_number, phone_verified')
    .in('id', uniqueIds);

  if (error) throw error;
  return buildProfilesMap((data || []) as ProfileRecord[]);
};

export const messagesService = {
  /**
   * Fetch conversations for the current user
   */
  async getConversations(limit: number = 50): Promise<Conversation[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('conversations')
      .select(
        `
        id,
        user1_id,
        user2_id,
        user1_unread_count,
        user2_unread_count,
        last_message_at,
        last_message_preview,
        created_at,
        updated_at
      `
      )
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const records = (data || []) as RawConversation[];
    const partnerIds = records.map((record) =>
      record.user1_id === user.id ? record.user2_id : record.user1_id
    );
    const profilesMap = await fetchProfilesMap(partnerIds);
    return records.map((record) => mapConversationRecord(record, user.id, profilesMap));
  },

  /**
   * Fetch a single conversation
   */
  async getConversationById(conversationId: string): Promise<Conversation | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('conversations')
      .select(
        `
        id,
        user1_id,
        user2_id,
        user1_unread_count,
        user2_unread_count,
        last_message_at,
        last_message_preview,
        created_at,
        updated_at
      `
      )
      .eq('id', conversationId)
      .single();

    if (error) throw error;
    if (!data) return null;
    const record = data as RawConversation;
    const partnerId =
      record.user1_id === user.id ? record.user2_id : record.user1_id;
    const profilesMap = await fetchProfilesMap([partnerId]);
    return mapConversationRecord(record, user.id, profilesMap);
  },

  /**
   * Ensure a conversation exists between current user and partner
   */
  async ensureConversationWithUser(partnerId: string): Promise<Conversation> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    if (partnerId === user.id) {
      throw new Error('You cannot start a conversation with yourself.');
    }

    const [user1, user2] = [user.id, partnerId].sort();

    const { data, error } = await supabase
      .from('conversations')
      .upsert(
        {
          user1_id: user1,
          user2_id: user2,
        },
        {
          onConflict: 'user1_id,user2_id',
        }
      )
      .select(
        `
        id,
        user1_id,
        user2_id,
        user1_unread_count,
        user2_unread_count,
        last_message_at,
        last_message_preview,
        created_at,
        updated_at
      `
      )
      .single();

    if (error) throw error;
    const record = data as RawConversation;
    const profilesMap = await fetchProfilesMap([partnerId]);
    const conversation = mapConversationRecord(record, user.id, profilesMap);
    invalidateConversationCaches(conversation.id);
    return conversation;
  },

  /**
   * Fetch messages for a conversation
   */
  async getMessages(conversationId: string, limit: number = 200): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Send a new message within a conversation
   */
  async sendMessage(payload: SendMessagePayload): Promise<Message> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { conversationId, recipientId, content, imageUrl } = payload;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        recipient_id: recipientId,
        content,
        image_url: imageUrl || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    invalidateConversationCaches(conversationId);
    return data as Message;
  },

  /**
   * Mark a conversation as read
   */
  async markConversationAsRead(conversationId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase.rpc('mark_conversation_read', {
      p_conversation_id: conversationId,
    });

    if (error) {
      console.warn('mark_conversation_read RPC missing - falling back to client updates');
      const { data: conversation, error: fetchError } = await supabase
        .from('conversations')
        .select('user1_id, user2_id')
        .eq('id', conversationId)
        .single();

      if (fetchError || !conversation) {
        throw fetchError || new Error('Conversation not found for markConversationAsRead');
      }

      const unreadColumn =
        conversation.user1_id === user.id ? 'user1_unread_count' : 'user2_unread_count';

      await supabase
        .from('conversations')
        .update({ [unreadColumn]: 0 })
        .eq('id', conversationId);

      await supabase
        .from('messages')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('conversation_id', conversationId)
        .eq('recipient_id', user.id)
        .eq('is_read', false);
    }

    invalidateConversationCaches(conversationId);
  },

  /**
   * Send a contextual message referencing a listing
   */
  async sendListingReferenceMessage(
    conversationId: string,
    recipientId: string,
    listing: ListingWithImages
  ): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const parseListingReference = (content?: string | null): ListingReferencePayload | null => {
      if (!content || !content.startsWith(LISTING_REFERENCE_PREFIX)) return null;
      try {
        return JSON.parse(content.slice(LISTING_REFERENCE_PREFIX.length)) as ListingReferencePayload;
      } catch {
        return null;
      }
    };

    const { data: recentMessages, error } = await supabase
      .from('messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    if (
      recentMessages?.some((message) => {
        const payload = parseListingReference(message.content);
        return payload?.id === listing.id;
      })
    ) {
      return;
    }

    const payload = {
      id: listing.id,
      title:
        listing.title ||
        `${listing.year || ''} ${listing.model || 'GT-R'}`.trim(),
      price: listing.price ?? null,
      location:
        listing.location ||
        [listing.city, listing.state].filter(Boolean).join(', ') ||
        null,
    };

    const content = `${LISTING_REFERENCE_PREFIX}${JSON.stringify(payload)}`;

    await this.sendMessage({
      conversationId,
      recipientId,
      content,
    });
  },

  /**
   * Get unread conversation count
   */
  async getUnreadCount(): Promise<number> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from('conversations')
      .select('user1_id, user2_id, user1_unread_count, user2_unread_count')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

    if (error) throw error;
    if (!data) return 0;

    return data.reduce((total, convo) => {
      if (convo.user1_id === user.id) {
        return total + (convo.user1_unread_count || 0);
      }
      if (convo.user2_id === user.id) {
        return total + (convo.user2_unread_count || 0);
      }
      return total;
    }, 0);
  },
};
