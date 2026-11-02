/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Mapbox access token. When absent the keyless Sentinel-2 stack is used. */
  readonly VITE_MAPBOX_TOKEN?: string;
  /** Optional base URL of a connected AgriSense rules-engine / explanation API. */
  readonly VITE_AGRISENSE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css';
