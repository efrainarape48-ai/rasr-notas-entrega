import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.easudios.rasr',
  appName: 'RASR',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
