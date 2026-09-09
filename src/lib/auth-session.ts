export const AUTH_COOKIE_NAME = "car_audio_session";
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export interface SessionPayload {
  sub: string;
  exp: number;
}

function getConfiguredSessionToken() {
  const token = process.env.APP_SESSION_TOKEN?.trim();

  if (!token || token.length < 32) {
    return null;
  }

  return token;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

export function isAuthSessionConfigured() {
  return Boolean(getConfiguredSessionToken());
}

export async function createSessionToken(
  _username: string
): Promise<string> {
  const token = getConfiguredSessionToken();

  if (!token) {
    throw new Error(
      "APP_SESSION_TOKEN en az 32 karakter olacak şekilde tanımlanmalıdır."
    );
  }

  return token;
}

export async function verifySessionToken(
  token: string | null | undefined
): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  const configuredToken = getConfiguredSessionToken();

  if (!configuredToken) {
    return null;
  }

  if (!constantTimeEqual(token, configuredToken)) {
    return null;
  }

  const username =
    process.env.APP_LOGIN_USER?.trim() || "admin";

  return {
    sub: username,
    exp:
      Math.floor(Date.now() / 1000) +
      AUTH_SESSION_MAX_AGE_SECONDS,
  };
}
