import { getAthenaAccessToken } from './lib/athenaAuth.mjs';

try {
  const token = await getAthenaAccessToken();
  console.log('Got token:', token.slice(0, 20) + '...');
} catch (err) {
  console.error('Token request failed:', err.message);
}