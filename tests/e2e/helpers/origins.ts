// Fixed loopback origins owned by the Playwright web servers. They differ
// from Vite's defaults (5173/4173) and from each other, so development
// fixture and production preview storage never share an origin.
export const devPort = 5180;
export const previewPort = 4180;
export const devOrigin = `http://127.0.0.1:${devPort}`;
export const previewOrigin = `http://127.0.0.1:${previewPort}`;
