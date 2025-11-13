import dataManager, { RequestPriority } from './dataManager';
import BackgroundSync from './dataManager/BackgroundSync';
import { listingsService } from './listings';
import { eventsService } from './events';
import { forumService } from './forum';
import { profilesService } from './profiles';
import { supabase } from './supabase';

class InitializationService {
  private backgroundSync: BackgroundSync;
  private userId: string | null = null;

  constructor() {
    this.backgroundSync = new BackgroundSync(1000);
  }

  /**
   * Initialize critical data on login/signup
   */
  async initializeCriticalData(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    this.userId = user.id;

    // Phase 1: Critical data (blocking, high priority)
    const criticalTasks = [
      // Home screen data
      dataManager.fetch(
        'home:forum:recent:3',
        () => forumService.getAllPosts(3),
        { priority: RequestPriority.HIGH, ttl: 2 * 60 * 1000 } // 2 minutes
      ),
      dataManager.fetch(
        'home:listings:nearby:5',
        () => listingsService.getNearbyListings(5),
        { priority: RequestPriority.HIGH, ttl: 2 * 60 * 1000 }
      ),
      dataManager.fetch(
        'home:events:upcoming:5',
        () => eventsService.getUpcomingEvents(5),
        { priority: RequestPriority.HIGH, ttl: 2 * 60 * 1000 }
      ),
      // User profile stats (small, important)
      dataManager.fetch(
        `profile:stats:${user.id}`,
        async () => {
          try {
            const { data, error } = await supabase.rpc('get_user_stats', {
              p_user_id: user.id,
            });
            if (error) throw error;
            return data;
          } catch {
            // Fallback to individual queries if RPC fails
            const profile = await profilesService.getCurrentUserProfile();
            return {
              listings_count: 0,
              events_count: 0,
              posts_count: 0,
              garage_count: 0,
              favorite_listings_count: profile?.favorite_listings_count || 0,
              favorite_events_count: profile?.favorite_events_count || 0,
            };
          }
        },
        { priority: RequestPriority.HIGH, ttl: 5 * 60 * 1000 }
      ),
      // User profile data
      dataManager.fetch(
        'profile:current',
        () => profilesService.getCurrentUserProfile(),
        { priority: RequestPriority.HIGH, ttl: 10 * 60 * 1000 } // 10 minutes
      ),
    ];

    // Wait for all critical data
    await Promise.allSettled(criticalTasks);

    // Phase 2: Start background prefetch (non-blocking)
    this.startBackgroundPrefetch();
  }

  /**
   * Start background prefetch for other tabs
   */
  private startBackgroundPrefetch(): void {
    if (!this.userId) return;

    // Marketplace listings (10 items)
    this.backgroundSync.addTask(
      'marketplace:listings:10',
      () => listingsService.getAllListings(10),
      5 * 60 * 1000 // 5 minutes
    );

    // More forum posts for community tab
    this.backgroundSync.addTask(
      'community:forum:recent:20',
      () => forumService.getAllPosts(20),
      5 * 60 * 1000
    );

    // More events for events tab
    this.backgroundSync.addTask(
      'events:upcoming:20',
      () => eventsService.getUpcomingEvents(20),
      5 * 60 * 1000
    );

    // User's own listings
    this.backgroundSync.addTask(
      `listings:user:${this.userId}`,
      () => listingsService.getListingsByUserId(this.userId!),
      5 * 60 * 1000
    );

    // User's own events
    this.backgroundSync.addTask(
      `events:user:${this.userId}`,
      () => eventsService.getUserEvents(this.userId!),
      5 * 60 * 1000
    );

    // User's forum posts
    this.backgroundSync.addTask(
      `forum:user:${this.userId}`,
      () => forumService.getUserPosts(this.userId!),
      5 * 60 * 1000
    );

    // Start background sync
    this.backgroundSync.start();
  }

  /**
   * Clear all cached data (on logout)
   */
  clearAll(): void {
    dataManager.clearCache();
    this.backgroundSync.stop();
    this.userId = null;
  }

  /**
   * Prefetch data for a specific tab
   */
  prefetchTab(tabName: string): void {
    if (!this.userId) return;

    switch (tabName) {
      case 'marketplace':
        dataManager.prefetch(
          'marketplace:listings:10',
          () => listingsService.getAllListings(10)
        );
        break;
      case 'community':
        dataManager.prefetch(
          'community:forum:recent:20',
          () => forumService.getAllPosts(20)
        );
        break;
      case 'events':
        dataManager.prefetch(
          'events:upcoming:20',
          () => eventsService.getUpcomingEvents(20)
        );
        break;
      case 'profile':
        dataManager.prefetch(
          `profile:${this.userId}`,
          () => profilesService.getCurrentUserProfile()
        );
        break;
    }
  }
}

export const initializationService = new InitializationService();

