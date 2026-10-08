/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Test mode only (.env.development.local). Never set this for a real build. */
  readonly VITE_DEV_PASSWORD?: string;
  /** Set in vite.config.ts from package.json. */
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
