const OZDEMIR_BASE_URL =
  "https://ozdemirelektronik.com";

const OZDEMIR_LOGIN_URL =
  `${OZDEMIR_BASE_URL}/kullanici/Hesap.aspx?tab=giris`;

const OZDEMIR_ALLOWED_HOSTS =
  new Set([
    "ozdemirelektronik.com",
    "www.ozdemirelektronik.com",
  ]);

const OZDEMIR_SESSION_TIMEOUT_MS =
  15000;

const OZDEMIR_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

export type OzdemirSessionErrorCode =
  | "AUTH_CONFIG_MISSING"
  | "BOOTSTRAP_FAILED"
  | "LOGIN_FORM_INVALID"
  | "LOGIN_REQUEST_FAILED"
  | "LOGIN_FAILED"
  | "NETWORK_ERROR";

export class OzdemirSessionError extends Error {
  readonly code: OzdemirSessionErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: OzdemirSessionErrorCode,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OzdemirSessionError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

let cachedSessionCookie:
  | string
  | null = null;

let loginPromise:
  | Promise<string>
  | null = null;

function sleep(ms: number) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(resolve, ms);
    }
  );
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : String(error);
}

function decodeHtmlAttribute(
  value: string
) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(
      /&#(\d+);/g,
      (_, code: string) =>
        String.fromCharCode(
          Number(code)
        )
    );
}

function readTagAttributes(
  tag: string
) {
  const attributes =
    new Map<string, string>();

  const regex =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

  for (
    const match of
      tag.matchAll(regex)
  ) {
    const rawName =
      match[1];

    if (!rawName) {
      continue;
    }

    const name =
      rawName.toLowerCase();

    if (
      name === "input" ||
      name.startsWith("<")
    ) {
      continue;
    }

    const rawValue =
      match[2] ??
      match[3] ??
      match[4] ??
      "";

    attributes.set(
      name,
      decodeHtmlAttribute(
        rawValue
      )
    );
  }

  return attributes;
}

function getSetCookieValues(
  headers: Headers
) {
  const headersWithGetSetCookie =
    headers as Headers & {
      getSetCookie?: () => string[];
    };

  const direct =
    headersWithGetSetCookie.getSetCookie?.();

  if (
    direct &&
    direct.length > 0
  ) {
    return direct;
  }

  const combined =
    headers.get("set-cookie");

  if (!combined) {
    return [];
  }

  /*
   * Expires=Tue, 14 Sep ... içindeki virgülü bölmeden,
   * sadece sonraki cookie adından önceki virgülde ayır.
   */
  return combined.split(
    /,(?=\s*[^;,\s=]+=[^;,]*)/g
  );
}

function applySetCookie(
  jar: Map<string, string>,
  setCookie: string
) {
  const firstPart =
    setCookie.split(";", 1)[0]
      ?.trim();

  if (!firstPart) {
    return;
  }

  const separatorIndex =
    firstPart.indexOf("=");

  if (separatorIndex <= 0) {
    return;
  }

  const name =
    firstPart
      .slice(0, separatorIndex)
      .trim();

  const value =
    firstPart
      .slice(separatorIndex + 1)
      .trim();

  if (!name) {
    return;
  }

  if (!value) {
    jar.delete(name);
    return;
  }

  jar.set(name, value);
}

function mergeResponseCookies(
  jar: Map<string, string>,
  response: Response
) {
  for (
    const setCookie of
      getSetCookieValues(
        response.headers
      )
  ) {
    applySetCookie(
      jar,
      setCookie
    );
  }
}

function toCookieHeader(
  jar: Map<string, string>
) {
  return Array.from(
    jar.entries()
  )
    .map(
      ([name, value]) =>
        `${name}=${value}`
    )
    .join("; ");
}

function cookieHeaderToJar(
  cookieHeader: string
) {
  const jar =
    new Map<string, string>();

  for (
    const part of
      cookieHeader.split(";")
  ) {
    const cleanPart =
      part.trim();

    if (!cleanPart) {
      continue;
    }

    const separatorIndex =
      cleanPart.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    jar.set(
      cleanPart
        .slice(0, separatorIndex)
        .trim(),
      cleanPart
        .slice(separatorIndex + 1)
        .trim()
    );
  }

  return jar;
}

function browserHeaders(
  cookieHeader?: string
) {
  const headers =
    new Headers();

  headers.set(
    "Accept",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
  );

  headers.set(
    "Accept-Language",
    "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
  );

  headers.set(
    "User-Agent",
    OZDEMIR_USER_AGENT
  );

  headers.set(
    "Cache-Control",
    "max-age=0"
  );

  if (cookieHeader) {
    headers.set(
      "Cookie",
      cookieHeader
    );
  }

  return headers;
}

async function fetchSessionRequest(
  url: string,
  init: RequestInit
) {
  let lastError:
    unknown = null;

  for (
    let attempt = 1;
    attempt <= 2;
    attempt++
  ) {
    try {
      return await fetch(
        url,
        {
          ...init,
          cache: "no-store",
          signal:
            AbortSignal.timeout(
              OZDEMIR_SESSION_TIMEOUT_MS
            ),
        }
      );
    } catch (error) {
      lastError = error;

      if (attempt < 2) {
        await sleep(500);
      }
    }
  }

  throw new OzdemirSessionError(
    "Özdemir Elektronik oturum isteğinde bağlantı kurulamadı.",
    "NETWORK_ERROR",
    502,
    {
      error:
        getErrorMessage(
          lastError
        ),
    }
  );
}

export function isOzdemirUrl(
  value: string
) {
  try {
    const url =
      new URL(value);

    return (
      url.protocol === "https:" &&
      OZDEMIR_ALLOWED_HOSTS.has(
        url.hostname.toLowerCase()
      )
    );
  } catch {
    return false;
  }
}

export function isOzdemirGuestProductHtml(
  html: string
) {
  return (
    /Toptan\s+Fiyatlar\s+İçin\s+Bayi\s+Girişi\s+Yapınız/i.test(
      html
    ) ||
    /class=["'][^"']*\bguestNote\b[^"']*["']/i.test(
      html
    )
  );
}

export function isOzdemirLoggedInHtml(
  html: string
) {
  return (
    /href=["'][^"']*\/kullanici\/Cikis\.aspx[^"']*["']/i.test(
      html
    ) ||
    /data-seviye=["']Bayii["']/i.test(
      html
    )
  );
}

function extractAspNetLoginFields(
  html: string
) {
  const formMatch =
    html.match(
      /<form\b[^>]*id=["']aspnetForm["'][^>]*>([\s\S]*?)<\/form>/i
    );

  if (!formMatch?.[1]) {
    throw new OzdemirSessionError(
      "Özdemir Elektronik login formu bulunamadı.",
      "LOGIN_FORM_INVALID",
      502
    );
  }

  const formHtml =
    formMatch[1];

  const body =
    new URLSearchParams();

  for (
    const inputMatch of
      formHtml.matchAll(
        /<input\b[^>]*>/gi
      )
  ) {
    const tag =
      inputMatch[0];

    const attributes =
      readTagAttributes(tag);

    const name =
      attributes.get("name");

    if (!name) {
      continue;
    }

    if (
      attributes.has("disabled")
    ) {
      continue;
    }

    const type =
      (
        attributes.get("type") ??
        "text"
      ).toLowerCase();

    if (
      type === "submit" ||
      type === "button" ||
      type === "reset" ||
      type === "file"
    ) {
      continue;
    }

    if (
      (
        type === "checkbox" ||
        type === "radio"
      ) &&
      !attributes.has("checked")
    ) {
      continue;
    }

    body.set(
      name,
      attributes.get("value") ??
        ""
    );
  }

  if (!body.get("__VIEWSTATE")) {
    throw new OzdemirSessionError(
      "Özdemir Elektronik login sayfasında __VIEWSTATE bulunamadı.",
      "LOGIN_FORM_INVALID",
      502
    );
  }

  return body;
}

async function verifySession(
  jar: Map<string, string>
) {
  const cookieHeader =
    toCookieHeader(jar);

  if (!cookieHeader) {
    return false;
  }

  const headers =
    browserHeaders(
      cookieHeader
    );

  headers.set(
    "Referer",
    OZDEMIR_BASE_URL
  );

  const response =
    await fetchSessionRequest(
      `${OZDEMIR_BASE_URL}/`,
      {
        method: "GET",
        headers,
        redirect: "follow",
      }
    );

  mergeResponseCookies(
    jar,
    response
  );

  if (!response.ok) {
    return false;
  }

  const html =
    await response.text();

  return isOzdemirLoggedInHtml(
    html
  );
}

async function performLogin() {
  const username =
    process.env
      .OZDEMIR_USERNAME
      ?.trim();

  const password =
    process.env
      .OZDEMIR_PASSWORD
      ?.trim();

  if (
    !username ||
    !password
  ) {
    throw new OzdemirSessionError(
      "OZDEMIR_USERNAME veya OZDEMIR_PASSWORD tanımlı değil. .env.local / Vercel Environment Variables alanını kontrol edin.",
      "AUTH_CONFIG_MISSING",
      500
    );
  }

  /*
   * 1. Login sayfasını aç.
   * ASP.NET_SessionId, client_id vb. cookie'leri ve
   * __VIEWSTATE / __EVENTVALIDATION değerlerini al.
   */
  const jar =
    new Map<string, string>();

  const bootstrapHeaders =
    browserHeaders();

  bootstrapHeaders.set(
    "Referer",
    OZDEMIR_BASE_URL
  );

  const bootstrapResponse =
    await fetchSessionRequest(
      OZDEMIR_LOGIN_URL,
      {
        method: "GET",
        headers:
          bootstrapHeaders,
        redirect: "follow",
      }
    );

  mergeResponseCookies(
    jar,
    bootstrapResponse
  );

  if (!bootstrapResponse.ok) {
    throw new OzdemirSessionError(
      `Özdemir Elektronik giriş sayfası açılamadı. HTTP ${bootstrapResponse.status}.`,
      "BOOTSTRAP_FAILED",
      502,
      {
        responseStatus:
          bootstrapResponse.status,
        finalUrl:
          bootstrapResponse.url,
      }
    );
  }

  const loginHtml =
    await bootstrapResponse.text();

  const loginBody =
    extractAspNetLoginFields(
      loginHtml
    );

  /*
   * DevTools ve gönderilen HTML ile doğrulanan alanlar.
   */
  loginBody.set(
    "ctl00$Content$form_mail",
    username
  );

  loginBody.set(
    "ctl00$Content$form_password",
    password
  );

  loginBody.set(
    "ctl00$Content$form_benihatirla",
    "1"
  );

  loginBody.set(
    "ctl00$Content$btnSubmit",
    ""
  );

  loginBody.set(
    "activeTab",
    "giris"
  );

  const loginHeaders =
    browserHeaders(
      toCookieHeader(jar)
    );

  loginHeaders.set(
    "Content-Type",
    "application/x-www-form-urlencoded"
  );

  loginHeaders.set(
    "Origin",
    OZDEMIR_BASE_URL
  );

  loginHeaders.set(
    "Referer",
    OZDEMIR_LOGIN_URL
  );

  /*
   * redirect: manual önemli.
   * Başarılı login 302 döndürüyor ve LoginHASH gibi
   * Set-Cookie değerlerini redirect'ten önce yakalıyoruz.
   */
  const loginResponse =
    await fetchSessionRequest(
      OZDEMIR_LOGIN_URL,
      {
        method: "POST",
        headers:
          loginHeaders,
        body:
          loginBody.toString(),
        redirect: "manual",
      }
    );

  mergeResponseCookies(
    jar,
    loginResponse
  );

  if (
    loginResponse.status >=
      400
  ) {
    throw new OzdemirSessionError(
      `Özdemir Elektronik giriş isteği başarısız. HTTP ${loginResponse.status}.`,
      "LOGIN_REQUEST_FAILED",
      502,
      {
        responseStatus:
          loginResponse.status,
      }
    );
  }

  /* Response body varsa tüket. Şifre/cookie loglanmaz. */
  await loginResponse.text();

  const loggedIn =
    await verifySession(jar);

  if (!loggedIn) {
    throw new OzdemirSessionError(
      "Özdemir Elektronik giriş işlemi tamamlanamadı. Kullanıcı adı/şifre hatalı olabilir veya login akışı değişmiş olabilir.",
      "LOGIN_FAILED",
      401,
      {
        loginResponseStatus:
          loginResponse.status,
      }
    );
  }

  const cookieHeader =
    toCookieHeader(jar);

  if (!cookieHeader) {
    throw new OzdemirSessionError(
      "Özdemir Elektronik girişi başarılı görünüyor ancak oturum cookie bilgisi oluşturulamadı.",
      "LOGIN_FAILED",
      500
    );
  }

  cachedSessionCookie =
    cookieHeader;

  return cookieHeader;
}

export function invalidateOzdemirSession() {
  cachedSessionCookie =
    null;
}

export function getExistingOzdemirSessionCookie() {
  if (cachedSessionCookie) {
    return cachedSessionCookie;
  }

  /*
   * İsteğe bağlı geçiş desteği.
   * Normal kullanımda kullanıcı adı/şifre ile otomatik login yeterlidir.
   */
  const envCookie =
    process.env
      .OZDEMIR_COOKIE
      ?.trim();

  if (envCookie) {
    const jar =
      cookieHeaderToJar(
        envCookie
      );

    cachedSessionCookie =
      toCookieHeader(jar);

    return cachedSessionCookie;
  }

  return null;
}

export async function loginOzdemir() {
  invalidateOzdemirSession();

  if (loginPromise) {
    return loginPromise;
  }

  loginPromise =
    performLogin();

  try {
    return await loginPromise;
  } finally {
    loginPromise = null;
  }
}

export async function getOzdemirSessionCookie(
  options?: {
    forceLogin?: boolean;
  }
) {
  const forceLogin =
    options?.forceLogin ===
      true;

  if (!forceLogin) {
    const existing =
      getExistingOzdemirSessionCookie();

    if (existing) {
      return existing;
    }
  }

  return loginOzdemir();
}
