export interface ConversationParticipant {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  phone_verified?: boolean;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_unread_count: number;
  user2_unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  partner: ConversationParticipant;
  unreadCount: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  image_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface SendMessagePayload {
  conversationId: string;
  recipientId: string;
  content: string;
  imageUrl?: string | null;
}
