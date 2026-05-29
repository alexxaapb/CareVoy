import * as Sentry from '@sentry/react-native';
import { version } from './package.json';
import appConfig from './app.json';

const buildNumber = appConfig?.expo?.ios?.buildNumber ?? '1';

Sentry.init({
  dsn: 'https://1cef0416628d9c1fbcea7cdba1ad898d@o4511412235862016.ingest.us.sentry.io/4511412248969216',
  tracesSampleRate: 1.0,
  environment: __DEV__ ? 'development' : 'production',
  enableNative: true,
  enableAutoSessionTracking: true,
  release: `co.carevoy.app@${version}`,
  dist: buildNumber,
});

// Remove this line once Sentry confirms first event received
Sentry.captureMessage('CareVoy app launched - Sentry connected', 'info');

export default Sentry;
