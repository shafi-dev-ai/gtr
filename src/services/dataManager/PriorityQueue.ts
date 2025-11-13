import { QueuedRequest, RequestPriority } from './types';

class PriorityQueue {
  private queue: QueuedRequest[] = [];
  private processing = false;
  private paused = false;

  /**
   * Add request to queue
   */
  enqueue(request: QueuedRequest): void {
    // Insert based on priority (lower number = higher priority)
    const index = this.queue.findIndex(r => r.priority > request.priority);
    if (index === -1) {
      this.queue.push(request);
    } else {
      this.queue.splice(index, 0, request);
    }

    // Start processing if not already processing
    if (!this.processing && !this.paused) {
      this.process();
    }
  }

  /**
   * Process queue
   */
  private async process(): Promise<void> {
    if (this.processing || this.paused) return;

    this.processing = true;

    while (this.queue.length > 0 && !this.paused) {
      const request = this.queue.shift();
      if (!request || request.cancelled) continue;

      try {
        const result = await request.fetchFn();
        if (!request.cancelled) {
          request.resolve(result);
        }
      } catch (error) {
        if (!request.cancelled) {
          request.reject(error);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Pause queue processing (e.g., when user action is in progress)
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.paused = false;
    if (!this.processing && this.queue.length > 0) {
      this.process();
    }
  }

  /**
   * Cancel a specific request
   */
  cancel(requestId: string): void {
    const request = this.queue.find(r => r.id === requestId);
    if (request) {
      request.cancelled = true;
      this.queue = this.queue.filter(r => r.id !== requestId);
    }
  }

  /**
   * Cancel all requests of a specific priority or lower
   */
  cancelByPriority(maxPriority: RequestPriority): void {
    this.queue = this.queue.filter(request => {
      if (request.priority <= maxPriority) {
        request.cancelled = true;
        return false;
      }
      return true;
    });
  }

  /**
   * Clear all pending requests
   */
  clear(): void {
    this.queue.forEach(request => {
      request.cancelled = true;
    });
    this.queue = [];
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is processing
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Check if queue is paused
   */
  isPaused(): boolean {
    return this.paused;
  }
}

export default PriorityQueue;

