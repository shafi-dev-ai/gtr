// ============================================================================
// Notification Types
// ============================================================================

export type NotificationType =
  | 'listing_favorited'
  | 'event_rsvp'
  | 'event_favorited'
  | 'forum_comment'
  | 'forum_reply'
  | 'forum_like'
  | 'saved_search_match'
  | 'message';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: {
    listing_id?: string;
    event_id?: string;
    post_id?: string;
    comment_id?: string;
    parent_comment_id?: string;
    user_id?: string;
    conversation_id?: string;
    message_id?: string;
    favorite_id?: string;
    rsvp_id?: string;
    like_id?: string;
    status?: string;
  } | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationGroup {
  date: string; // 'Today', 'Yesterday', or formatted date
  notifications: Notification[];
}

