import DataManager from './DataManager';
import { RequestPriority } from './types';

// Create singleton instance
const dataManager = new DataManager({
  cacheTTL: 10 * 60 * 1000, // 10 minutes (was MAX_SAFE_INTEGER - never expired)
  maxCacheSize: 200, // Increased from 100 for better browsing experience
  backgroundFetchDelay: 1000, // 1 second
  requestTimeout: 30000, // 30 seconds
});

export default dataManager;
export { RequestPriority };
export type { DataManagerConfig } from './types';

