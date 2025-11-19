import { supabase } from './supabase';
import dataManager from './dataManager';

type RealtimeCallback<T> = (payload: T) => void;
type UnsubscribeFn = () => void;

class RealtimeService {
  private subscriptions: Map<string, any> = new Map();

  private removeChannel(channelKey: string): void {
    const existing = this.subscriptions.get(channelKey);
    if (existing) {
      try {
        existing.unsubscribe?.();
      } catch (error) {
        console.warn(`Error unsubscribing channel ${channelKey}:`, error);
      }
      supabase.removeChannel(existing).catch(() => {});
      this.subscriptions.delete(channelKey);
    }
  }

  private createUniqueChannelKey(baseKey: string): string {
    return `${baseKey}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Subscribe to listing favorites changes for a specific listing
   */
  async subscribeToListingFavorite(
    listingId: string,
    callback: (isFavorited: boolean) => void
  ): Promise<UnsubscribeFn> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return () => {};

    const channelKey = `listing_favorite_${listingId}_${user.id}`;
    
    // Remove existing subscription if any
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listing_favorites',
          filter: `listing_id=eq.${listingId}`,
        },
        async (payload) => {
          // Check if current user favorited/unfavorited
          if (payload.new && (payload.new as any).user_id === user.id) {
            callback(true);
            // Invalidate favorites cache
            dataManager.invalidateCache(/^user:favorites/);
            dataManager.invalidateCache(/^home:listings/);
            dataManager.invalidateCache(/^marketplace:listings/);
          } else if (payload.eventType === 'DELETE' && (payload.old as any).user_id === user.id) {
            callback(false);
            // Invalidate favorites cache
            dataManager.invalidateCache(/^user:favorites/);
            dataManager.invalidateCache(/^home:listings/);
            dataManager.invalidateCache(/^marketplace:listings/);
          }
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to all favorites changes for current user
   */
  async subscribeToUserFavorites(
    callback: () => void
  ): Promise<UnsubscribeFn> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return () => {};

    const channelKey = `user_favorites_${user.id}`;
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listing_favorites',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          // Invalidate cache FIRST
          dataManager.invalidateCache(/^user:favorites/);
          dataManager.invalidateCache(/^home:listings/);
          dataManager.invalidateCache(/^marketplace:listings/);
          
          // Then call callback to refresh UI
          callback();
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to event favorites changes
   */
  async subscribeToEventFavorite(
    eventId: string,
    callback: (isFavorited: boolean) => void
  ): Promise<UnsubscribeFn> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return () => {};

    const channelKey = `event_favorite_${eventId}_${user.id}`;
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_favorites',
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          if (payload.new && (payload.new as any).user_id === user.id) {
            callback(true);
            dataManager.invalidateCache(/^user:favorites:events/);
            dataManager.invalidateCache(/^home:events/);
          } else if (payload.eventType === 'DELETE' && (payload.old as any).user_id === user.id) {
            callback(false);
            dataManager.invalidateCache(/^user:favorites:events/);
            dataManager.invalidateCache(/^home:events/);
          }
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to all event favorites changes for current user
   */
  async subscribeToUserEventFavorites(
    callback: () => void
  ): Promise<UnsubscribeFn> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return () => {};

    const channelKey = `user_event_favorites_${user.id}`;
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_favorites',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          // Invalidate cache FIRST
          dataManager.invalidateCache(`user:favorites:events:${user.id}`);
          dataManager.invalidateCache(/^user:favorites:events/);
          dataManager.invalidateCache(`profile:stats:${user.id}`);
          
          // Then call callback to refresh UI
          callback();
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to all forum like changes for current user
   */
  async subscribeToUserForumLikes(callback: () => void): Promise<UnsubscribeFn> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return () => {};

    const channelKey = `user_forum_likes_${user.id}`;

    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          dataManager.invalidateCache(`user:favorites:forum:${user.id}`);
          dataManager.invalidateCache(/^user:favorites:forum/);
          dataManager.invalidateCache(/^home:forum/);
          dataManager.invalidateCache(/^explore:forum/);
          dataManager.invalidateCache(`profile:stats:${user.id}`);
          callback();
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to forum post likes
   */
  async subscribeToPostLike(
    postId: string,
    callback: (isLiked: boolean, likeCount: number) => void
  ): Promise<UnsubscribeFn> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return () => {};

    const channelKey = `post_like_${postId}_${user.id}`;
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'post_likes',
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          // Fetch updated like count
          const { count } = await supabase
            .from('post_likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', postId);

          const isLiked = payload.new && (payload.new as any).user_id === user.id;
          callback(isLiked, count || 0);
          
          // Invalidate forum cache
          dataManager.invalidateCache(/^home:forum/);
          dataManager.invalidateCache(/^user:favorites:forum/);
          dataManager.invalidateCache(/^explore:forum/);
          dataManager.invalidateCache(/^user:forum/);
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to new listings
   */
  subscribeToNewListings(
    callback: () => void
  ): UnsubscribeFn {
    const channelKey = 'new_listings';
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'listings',
          filter: 'status=eq.active',
        },
        () => {
          callback();
          // Invalidate listings cache
          dataManager.invalidateCache(/^home:listings/);
          dataManager.invalidateCache(/^marketplace:listings/);
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to new forum posts
   */
  subscribeToNewForumPosts(
    callback: () => void
  ): UnsubscribeFn {
    const channelKey = 'new_forum_posts';
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'forum_posts',
        },
        () => {
          callback();
          dataManager.invalidateCache(/^home:forum/);
          dataManager.invalidateCache(/^explore:forum/);
          dataManager.invalidateCache(/^user:forum/);
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to new forum comments
   */
  subscribeToNewForumComments(
    postId: string,
    callback: () => void
  ): UnsubscribeFn {
    const channelKey = `forum_comments_${postId}`;
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'forum_comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          callback();
          dataManager.invalidateCache(/^home:forum/);
          dataManager.invalidateCache(/^explore:forum/);
          dataManager.invalidateCache(/^home:forum:comments/);
          dataManager.invalidateCache(/^user:forum/);
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to new events
   */
  subscribeToNewEvents(
    callback: () => void
  ): UnsubscribeFn {
    const channelKey = 'new_events';
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
        },
        () => {
          callback();
          dataManager.invalidateCache(/^home:events/);
          dataManager.invalidateCache(/^user:events/);
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to RSVP changes for a specific event
   */
  subscribeToEventRSVPs(
    eventId: string,
    callback: () => void
  ): UnsubscribeFn {
    const channelKey = `event_rsvps_${eventId}`;
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_rsvps',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          callback();
          // Invalidate event-related caches
          dataManager.invalidateCache(/^home:events/);
          dataManager.invalidateCache(/^user:events/);
          dataManager.invalidateCache(new RegExp(`.*events:rsvps.*${eventId}.*`));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${eventId}`,
        },
        () => {
          callback();
          dataManager.invalidateCache(/^home:events/);
          dataManager.invalidateCache(/^user:events/);
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to listing updates (status changes, etc.)
   */
  subscribeToListingUpdates(
    listingId: string,
    callback: () => void
  ): UnsubscribeFn {
    const channelKey = `listing_update_${listingId}`;
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'listings',
          filter: `id=eq.${listingId}`,
        },
        () => {
          callback();
          dataManager.invalidateCache(new RegExp(`.*listing.*${listingId}.*`));
          dataManager.invalidateCache(/^home:listings/);
          dataManager.invalidateCache(/^marketplace:listings/);
          dataManager.invalidateCache(/^user:listings/);
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to user's own data changes (for profile stats)
   */
  async subscribeToUserDataChanges(
    userId: string,
    callback: () => void
  ): Promise<UnsubscribeFn> {
    const channelKey = `user_data_changes_${userId}`;
    
    this.removeChannel(channelKey);

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listings',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          callback();
          dataManager.invalidateCache(`profile:stats:${userId}`);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `created_by=eq.${userId}`,
        },
        () => {
          callback();
          dataManager.invalidateCache(`profile:stats:${userId}`);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'forum_posts',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          callback();
          dataManager.invalidateCache(`profile:stats:${userId}`);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_garage',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          callback();
          dataManager.invalidateCache(`profile:stats:${userId}`);
        }
      )
      .subscribe();

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to conversation changes (inbox/unread count)
   */
  async subscribeToConversations(callback: () => void): Promise<UnsubscribeFn> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return () => {};

    const channelKey = this.createUniqueChannelKey(`conversations_${user.id}`);

    const handleChange = () => {
      try {
        callback();
      } catch (error) {
        console.warn('Conversation callback error:', error);
      }
      dataManager.invalidateCache(/^messages:conversations/);
      dataManager.invalidateCache('messages:unread_count');
    };

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user1_id=eq.${user.id}`,
        },
        handleChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user2_id=eq.${user.id}`,
        },
        handleChange
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        handleChange
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Conversation channel ${channelKey} status:`, status);
        }
      });

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to messages within a conversation
   */
  async subscribeToConversationMessages(
    conversationId: string,
    callback: () => void
  ): Promise<UnsubscribeFn> {
    const channelKey = this.createUniqueChannelKey(
      `conversation_messages_${conversationId}`
    );

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          try {
            callback();
          } catch (error) {
            console.warn('Conversation message callback error:', error);
          }
          dataManager.invalidateCache(new RegExp(`^messages:conversation:${conversationId}`));
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Conversation messages channel ${channelKey} status:`, status);
        }
      });

    this.subscriptions.set(channelKey, channel);

    return () => {
      this.removeChannel(channelKey);
    };
  }

  /**
   * Subscribe to notifications for current user
   */
  async subscribeToNotifications(
    callback: () => void
  ): Promise<UnsubscribeFn> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return () => {};

    const uniqueChannelKey = this.createUniqueChannelKey(`notifications_${user.id}`);

    const channel = supabase
      .channel(uniqueChannelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          callback();
          // Invalidate notification cache
          dataManager.invalidateCache(/^notifications/);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Notification channel ${uniqueChannelKey} status:`, status);
        }
      });

    this.subscriptions.set(uniqueChannelKey, channel);

    return () => {
      this.removeChannel(uniqueChannelKey);
    };
  }

  /**
   * Cleanup all subscriptions
   */
  cleanup(): void {
    Array.from(this.subscriptions.keys()).forEach((key) => {
      this.removeChannel(key);
    });
  }
}

export const realtimeService = new RealtimeService();
