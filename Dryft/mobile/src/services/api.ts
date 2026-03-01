// Re-export API client for backwards compatibility
// New code should import directly from '../api/client'
import { api, apiClient } from '../api/client';
export { api, apiClient };
export default api;
