import DataManager from './DataManager';
import { RequestPriority } from './types';

// Create singleton instance
const dataManager = new DataManager({
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100,
  backgroundFetchDelay: 1000, // 1 second
  requestTimeout: 30000, // 30 seconds
});

export default dataManager;
export { RequestPriority };
export type { DataManagerConfig } from './types';

