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
        { priority: RequestPriority.HIGH }
      ),
      dataManager.fetch(
        'home:listings:nearby:5',
        () => listingsService.getAllListings(5),
        { priority: RequestPriority.HIGH }
      ),
      dataManager.fetch(
        'home:events:upcoming:5',
        () => eventsService.getUpcomingEvents(5),
        { priority: RequestPriority.HIGH }
      ),
      // User profile stats (small, important)
      dataManager.fetch(
        `profile:stats:${user.id}`,
        async () => {
          const formatStats = (stats: any) => ({
            listings: stats?.listings_count || 0,
            events: stats?.events_count || 0,
            posts: stats?.posts_count || 0,
            garage: stats?.garage_count || 0,
            likedListings:
              stats?.liked_listings_count ??
              stats?.favorite_listings_count ??
              0,
            likedEvents:
              stats?.liked_events_count ??
              stats?.favorite_events_count ??
              0,
          });

          try {
            const { data, error } = await supabase.rpc('get_user_stats', {
              p_user_id: user.id,
            });
            if (error) throw error;
            return formatStats(data);
          } catch {
            // Fallback to individual queries if RPC fails
            const profile = await profilesService.getCurrentUserProfile();
            return formatStats({
              listings_count: 0,
              events_count: 0,
              posts_count: 0,
              garage_count: 0,
              favorite_listings_count: profile?.favorite_listings_count || 0,
              favorite_events_count: profile?.favorite_events_count || 0,
            });
          }
        },
        { priority: RequestPriority.HIGH }
      ),
      // User profile data
      dataManager.fetch(
        'profile:current',
        () => profilesService.getCurrentUserProfile(),
        { priority: RequestPriority.HIGH }
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
      () => listingsService.getAllListings(10)
    );

    // More forum posts for community tab
    this.backgroundSync.addTask(
      'community:forum:recent:20',
      () => forumService.getAllPosts(20)
    );

    // More events for events tab
    this.backgroundSync.addTask(
      'events:upcoming:20',
      () => eventsService.getUpcomingEvents(20)
    );

    // User's own listings
    this.backgroundSync.addTask(
      `listings:user:${this.userId}`,
      () => listingsService.getUserListings(this.userId!)
    );

    // User's own events
    this.backgroundSync.addTask(
      `events:user:${this.userId}`,
      () => eventsService.getUserEvents(this.userId!)
    );

    // User's forum posts
    this.backgroundSync.addTask(
      `forum:user:${this.userId}`,
      () => forumService.getUserPosts(this.userId!)
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
