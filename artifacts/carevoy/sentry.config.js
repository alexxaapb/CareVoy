import * as Sentry from '@sentry/react-native';
import { version } from './package.json';

Sentry.init({
  dsn: 'https://a8bde62c03f6d28e4ad7c2e1c41fd0c3@o4508634229653504.ingest.us.sentry.io/4508634231292928',
  tracesSampleRate: 1.0,
  environment: __DEV__ ? 'development' : 'production',
  enableNative: true,
  enableAutoSessionTracking: true,
  release: `co.carevoy.app@${version}`,
  dist: '12',
});

export default Sentry;
