import dataManager from '.';

interface PrefetchTask {
  key: string;
  fetchFn: () => Promise<any>;
  ttl?: number;
}

class BackgroundSync {
  private tasks: PrefetchTask[] = [];
  private isRunning = false;
  private delay: number;

  constructor(delay: number = 1000) {
    this.delay = delay;
  }

  /**
   * Add prefetch task
   */
  addTask(key: string, fetchFn: () => Promise<any>, ttl?: number): void {
    // Check if task already exists
    if (this.tasks.some(t => t.key === key)) {
      return;
    }

    this.tasks.push({ key, fetchFn, ttl });
  }

  /**
   * Start background sync (called after critical data is loaded)
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Process tasks with delay between each
    this.processTasks();
  }

  /**
   * Process prefetch tasks
   */
  private async processTasks(): Promise<void> {
    for (const task of this.tasks) {
      if (!this.isRunning) break;

      // Prefetch with low priority
      dataManager.prefetch(task.key, task.fetchFn, task.ttl);

      // Wait before next task
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }

    this.tasks = []; // Clear completed tasks
  }

  /**
   * Stop background sync
   */
  stop(): void {
    this.isRunning = false;
    this.tasks = [];
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks = [];
  }
}

export default BackgroundSync;
