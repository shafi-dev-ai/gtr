class RequestDeduplicator {
  private pendingRequests: Map<string, Promise<any>> = new Map();

  /**
   * Execute request or return existing pending request if duplicate
   */
  async execute<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request
    const promise = fetchFn()
      .finally(() => {
        // Remove from pending when complete
        this.pendingRequests.delete(key);
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Check if a request is pending
   */
  isPending(key: string): boolean {
    return this.pendingRequests.has(key);
  }

  /**
   * Cancel a pending request
   */
  cancel(key: string): void {
    this.pendingRequests.delete(key);
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.pendingRequests.clear();
  }

  /**
   * Get number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

export default RequestDeduplicator;

