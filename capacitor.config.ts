import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.suqlink',
  appName: 'SuqLink',
  webDir: 'dist',
  server: {
    // Loads the live published app inside the native shell so SSR + server
    // functions keep working. After cloning from GitHub, run:
    //   npm install && npx cap sync
    // To run a fully local bundle instead, remove `url` below and run
    //   npm run build && npx cap sync
    url: 'https://4b6ef209-641c-4a28-8e1b-d7b6ff7bb925.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
