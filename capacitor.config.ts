import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.assem.game',
  appName: 'Assem Game',
  webDir: 'out',

  server: {
    url: 'http://192.168.110.53:3000/home',
    cleartext: true
  }
};

export default config;