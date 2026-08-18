function getEnvConfig() {
  const clientId = process.env.QF_CLIENT_ID || '';
  const clientSecret = process.env.QF_CLIENT_SECRET || '';
  const env = process.env.QF_ENV || 'prelive';
  
  const isPrelive = env === 'prelive';
  const OAUTH_URL = isPrelive 
    ? 'https://prelive-oauth2.quran.foundation/oauth2/token' 
    : 'https://oauth2.quran.foundation/oauth2/token';
  const API_URL = isPrelive 
    ? 'https://apis-prelive.quran.foundation/content/api/v4/chapters' 
    : 'https://apis.quran.foundation/content/api/v4/chapters';

  return { clientId, clientSecret, env, isPrelive, OAUTH_URL, API_URL };
}

// Lightweight caching
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;
const audioUrlCache = new Map<number, string>();

async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret, OAUTH_URL } = getEnvConfig();

  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  if (!clientId || !clientSecret) {
    throw new Error(`Missing QF_CLIENT_ID or QF_CLIENT_SECRET`);
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenResponse = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'content',
    }).toString(),
    cache: 'no-store'
  });

  if (!tokenResponse.ok) {
    throw new Error(`OAuth Authentication failed: ${tokenResponse.status}`);
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token || typeof tokenData.access_token !== 'string') {
    throw new Error('Authentication succeeded but no valid access_token was returned');
  }

  const newToken = tokenData.access_token;
  cachedToken = newToken;
  // Assume token is valid for 50 minutes (3000 seconds)
  tokenExpiresAt = Date.now() + (tokenData.expires_in ? tokenData.expires_in * 1000 : 3000000) - 60000;
  
  return newToken;
}

export async function fetchQuranChapters() {
  const { clientId, API_URL, env } = getEnvConfig();
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Missing Quran Foundation access token");
  }

  // 2. Fetch Chapters via Content API
  const chaptersResponse = await fetch(API_URL, {
    method: 'GET',
    headers: {
      'x-auth-token': accessToken,
      'x-client-id': clientId,
    },
    cache: 'no-store'
  });

  if (!chaptersResponse.ok) {
    const status = chaptersResponse.status;
    console.error(`Content API Failed. Status: ${status}, Environment: ${env}, Hostname: ${new URL(API_URL).hostname}`);
    throw new Error(`Content API request failed: ${status}`);
  }

  const data = await chaptersResponse.json();
  return data;
}

/**
 * Retrieves the Arabic recitation audio URL for a specific Surah
 * using Mishari Rashid al-`Afasy (Reciter ID 7).
 */
export async function getArabicChapterAudio(surahNumber: number) {
  if (surahNumber < 1 || surahNumber > 114) {
    throw { status: 400, message: 'Invalid Surah ID' };
  }

  const RECITER_ID = 7;

  // Check cache first
  if (audioUrlCache.has(surahNumber)) {
    return {
      surahNumber,
      audioUrl: audioUrlCache.get(surahNumber),
      reciter: RECITER_ID
    };
  }

  const { clientId, env, isPrelive } = getEnvConfig();
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error("Missing Quran Foundation access token");
  }

  // 2. Fetch Audio URL via Content API
  const audioUrlEndpoint = isPrelive 
    ? `https://apis-prelive.quran.foundation/content/api/v4/chapter_recitations/${RECITER_ID}/${surahNumber}`
    : `https://apis.quran.foundation/content/api/v4/chapter_recitations/${RECITER_ID}/${surahNumber}`;

  const audioResponse = await fetch(audioUrlEndpoint, {
    method: 'GET',
    headers: {
      'x-auth-token': accessToken,
      'x-client-id': clientId,
    },
    cache: 'no-store'
  });

  if (!audioResponse.ok) {
    const status = audioResponse.status;
    console.error(`Content API Audio Fetch Failed. Status: ${status}, Environment: ${env}, Surah: ${surahNumber}, Endpoint: ${audioUrlEndpoint}`);
    throw { status, message: 'Arabic audio unavailable' };
  }

  const data = await audioResponse.json();
  
  if (!data?.audio_file?.audio_url) {
    console.error(`Missing audio_url in response for Surah: ${surahNumber}`);
    throw { status: 500, message: 'No audio URL found in response' };
  }
  
  // Cache the audio URL
  audioUrlCache.set(surahNumber, data.audio_file.audio_url);

  return {
    surahNumber,
    audioUrl: data.audio_file.audio_url,
    reciter: RECITER_ID
  };
}
