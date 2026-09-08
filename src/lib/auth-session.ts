export const AUTH_COOKIE_NAME = "car_audio_session";
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

interface SessionPayload {
  sub: string;
  exp: number;
}

function getAuthSecret() {
  const secret = process.env.APP_AUTH_SECRET?.trim();

  if (!secret || secret.length < 32) {
    return null;
  }

  return secret;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = normalized.padEnd(
    Math.ceil(normalized.length / 4) * 4,
    "="
  );

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function getHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(
  username: string
): Promise<string> {
  const secret = getAuthSecret();

  if (!secret) {
    throw new Error(
      "APP_AUTH_SECRET en az 32 karakter olacak şekilde tanımlanmalıdır."
    );
  }

  const payload: SessionPayload = {
    sub: username,
    exp:
      Math.floor(Date.now() / 1000) +
      AUTH_SESSION_MAX_AGE_SECONDS,
  };

  const payloadBytes = new TextEncoder().encode(
    JSON.stringify(payload)
  );
  const payloadBase64 = bytesToBase64Url(payloadBytes);

  const key = await getHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadBase64)
  );

  return `${payloadBase64}.${bytesToBase64Url(
    new Uint8Array(signature)
  )}`;
}

export async function verifySessionToken(
  token: string | null | undefined
): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  const secret = getAuthSecret();

  if (!secret) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [payloadBase64, signatureBase64] = parts;

  try {
    const key = await getHmacKey(secret);

    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signatureBase64),
      new TextEncoder().encode(payloadBase64)
    );

    if (!validSignature) {
      return null;
    }

    const payloadText = new TextDecoder().decode(
      base64UrlToBytes(payloadBase64)
    );

    const payload = JSON.parse(payloadText) as SessionPayload;

    if (
      !payload ||
      typeof payload.sub !== "string" ||
      !payload.sub.trim() ||
      typeof payload.exp !== "number" ||
      !Number.isFinite(payload.exp)
    ) {
      return null;
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
