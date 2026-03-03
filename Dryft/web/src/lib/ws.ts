const DEFAULT_PROD_WS_URL = 'ws://api.dryft.site:8080/v1/ws';
const DEFAULT_DEV_WS_URL = 'ws://localhost:8080/v1/ws';

// Temporary default while DreamHost proxy websocket upgrade is pending.
// Set NEXT_PUBLIC_WS_URL=wss://api.dryft.site/v1/ws once proxy headers are fixed.
export const DEFAULT_WS_URL =
  process.env.NODE_ENV === 'production' ? DEFAULT_PROD_WS_URL : DEFAULT_DEV_WS_URL;

export function getWebSocketURL(): string {
  return process.env.NEXT_PUBLIC_WS_URL || DEFAULT_WS_URL;
}

