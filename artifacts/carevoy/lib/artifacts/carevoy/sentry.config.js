import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://a8bde62c03f6d28e4ad7c2e1c41fd0c3@o4508634229653504.ingest.us.sentry.io/4508634231292928',
  
  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
  // Capture 100% of errors in production
  environment: __DEV__ ? 'development' : 'production',
  
  // Enable native crash reporting
  enableNative: true,
  
  // Enable auto session tracking
  enableAutoSessionTracking: true,
});

export default Sentry;