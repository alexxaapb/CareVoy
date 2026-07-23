import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { SignJWT } from 'jose';
import crypto from 'crypto';
import { readFile } from 'fs/promises';

const CLIENT_ID = process.env.ATHENA_CLIENT_ID;
const KID = process.env.ATHENA_KID;
const TOKEN_URL = 'https://api.preview.platform.athenahealth.com/oauth2/v1/token';

const SCOPES = [
  'system/Patient.rs',
  'system/Location.r',
  'system/Practitioner.r',
].join(' ');

let cachedToken = null;
let cachedExpiry = 0;

async function loadPrivateKey() {
  const pem = process.env.ATHENA_PRIVATE_KEY
    ? process.env.ATHENA_PRIVATE_KEY.replace(/\\n/g, '\n')
    : await readFile(process.env.ATHENA_PRIVATE_KEY_PATH || './private_key.pem', 'utf8');
  return crypto.createPrivateKey(pem);
}

async function buildClientAssertion() {
  const privateKey = await loadPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: KID, typ: 'JWT' })
    .setIssuer(CLIENT_ID)
    .setSubject(CLIENT_ID)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setJti(crypto.randomUUID())
    .sign(privateKey);
}

export async function getAthenaAccessToken() {
  if (cachedToken && Date.now() < cachedExpiry) {
    return cachedToken;
  }

  const clientAssertion = await buildClientAssertion();

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: SCOPES,
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`athenahealth token request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  cachedExpiry = Date.now() + (Number(data.expires_in) - 60) * 1000;

  return cachedToken;
}