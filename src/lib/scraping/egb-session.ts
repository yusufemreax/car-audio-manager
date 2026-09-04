const EGB_BASE_URL =
  "https://www.b2begb.com";

const EGB_LOGIN_URL =
  `${EGB_BASE_URL}/uye-girisi`;

const EGB_SESSION_TIMEOUT_MS =
  15000;

const EGB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

export type EgbSessionErrorCode =
  | "AUTH_CONFIG_MISSING"
  | "BOOTSTRAP_FAILED"
  | "LOGIN_REQUEST_FAILED"
  | "LOGIN_FAILED"
  | "NETWORK_ERROR";

export class EgbSessionError extends Error {
  readonly code: EgbSessionErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: EgbSessionErrorCode,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "EgbSessionError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

interface HeadersWithGetSetCookie
  extends Headers {
  getSetCookie(): string[];
}

let cachedSessionCookie:
  string | null = null;

let loginPromise:
  Promise<string> | null =
    null;

function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds
      );
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

function splitSetCookieHeader(
  value: string
) {
  /*
   * Node sürümünde headers.getSetCookie()
   * bulunamazsa fallback.
   *
   * Expires=Wed, 21 Oct... içindeki virgülü
   * cookie ayıracı sanmamak için yalnızca
   * sonraki parça cookieName= şeklindeyse böler.
   */
  return value
    .split(
      /,(?=\s*[^=;,\s]+=)/
    )
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

function getSetCookieValues(
  headers: Headers
) {
  const headersWithGetSetCookie =
    headers as Partial<HeadersWithGetSetCookie>;

  if (
    typeof headersWithGetSetCookie
      .getSetCookie ===
    "function"
  ) {
    return headersWithGetSetCookie
      .getSetCookie();
  }

  const combined =
    headers.get(
      "set-cookie"
    );

  return combined
    ? splitSetCookieHeader(
        combined
      )
    : [];
}

function parseCookieHeader(
  cookieHeader: string
) {
  const jar =
    new Map<string, string>();

  for (
    const part of
    cookieHeader.split(";")
  ) {
    const trimmed =
      part.trim();

    if (!trimmed) {
      continue;
    }

    const separatorIndex =
      trimmed.indexOf("=");

    if (
      separatorIndex <=
      0
    ) {
      continue;
    }

    const name =
      trimmed
        .slice(
          0,
          separatorIndex
        )
        .trim();

    const value =
      trimmed
        .slice(
          separatorIndex + 1
        )
        .trim();

    if (name) {
      jar.set(
        name,
        value
      );
    }
  }

  return jar;
}

function applySetCookie(
  jar: Map<string, string>,
  setCookieValue: string
) {
  const firstPart =
    setCookieValue
      .split(";")[0]
      ?.trim();

  if (!firstPart) {
    return;
  }

  const separatorIndex =
    firstPart.indexOf("=");

  if (
    separatorIndex <=
    0
  ) {
    return;
  }

  const name =
    firstPart
      .slice(
        0,
        separatorIndex
      )
      .trim();

  const value =
    firstPart
      .slice(
        separatorIndex + 1
      )
      .trim();

  if (!name) {
    return;
  }

  /*
   * Max-Age=0 / expires durumunda server çoğunlukla
   * cookie değerini boş gönderir. Boşsa jar'dan sil.
   */
  if (!value) {
    jar.delete(
      name
    );

    return;
  }

  jar.set(
    name,
    value
  );
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

function browserHeaders(
  cookieHeader?: string
) {
  const headers =
    new Headers();

  headers.set(
    "Accept",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
  );

  headers.set(
    "Accept-Language",
    "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
  );

  headers.set(
    "User-Agent",
    EGB_USER_AGENT
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
          cache:
            "no-store",
          signal:
            AbortSignal.timeout(
              EGB_SESSION_TIMEOUT_MS
            ),
        }
      );
    } catch (error) {
      lastError = error;

      if (
        attempt <
        2
      ) {
        await sleep(
          500
        );
      }
    }
  }

  throw new EgbSessionError(
    "EGB oturum isteğinde bağlantı kurulamadı.",
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

export function isEgbLoggedInHtml(
  html: string
) {
  return (
    html.includes(
      "Çıkış Yap"
    ) ||
    /href=["']\/cikis["']/i.test(
      html
    )
  );
}

async function verifySession(
  jar: Map<string, string>
) {
  const cookieHeader =
    toCookieHeader(
      jar
    );

  if (!cookieHeader) {
    return false;
  }

  const headers =
    browserHeaders(
      cookieHeader
    );

  headers.set(
    "Referer",
    EGB_BASE_URL
  );

  const response =
    await fetchSessionRequest(
      `${EGB_BASE_URL}/`,
      {
        method: "GET",
        headers,
        redirect:
          "follow",
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

  return isEgbLoggedInHtml(
    html
  );
}

async function performLogin() {
  const username =
    process.env
      .EGB_USERNAME
      ?.trim();

  const password =
    process.env
      .EGB_PASSWORD
      ?.trim();

  if (
    !username ||
    !password
  ) {
    throw new EgbSessionError(
      "EGB_USERNAME veya EGB_PASSWORD tanımlı değil. .env.local dosyasını kontrol edin.",
      "AUTH_CONFIG_MISSING",
      500
    );
  }

  /*
   * =====================================================
   * 1. LOGIN PAGE BOOTSTRAP
   *
   * anticsrf, PHPSESSID vb. cookie'leri al.
   * =====================================================
   */

  const jar =
    new Map<string, string>();

  const bootstrapHeaders =
    browserHeaders();

  bootstrapHeaders.set(
    "Referer",
    EGB_BASE_URL
  );

  const bootstrapResponse =
    await fetchSessionRequest(
      EGB_LOGIN_URL,
      {
        method: "GET",
        headers:
          bootstrapHeaders,
        redirect:
          "follow",
      }
    );

  mergeResponseCookies(
    jar,
    bootstrapResponse
  );

  if (
    !bootstrapResponse.ok
  ) {
    throw new EgbSessionError(
      `EGB giriş sayfası açılamadı. HTTP ${bootstrapResponse.status}.`,
      "BOOTSTRAP_FAILED",
      502,
      {
        responseStatus:
          bootstrapResponse.status,
      }
    );
  }

  /*
   * Body'yi tüket.
   * İçeriğini loglamıyoruz.
   */
  await bootstrapResponse.text();

  /*
   * =====================================================
   * 2. LOGIN POST
   *
   * DevTools'tan doğrulanan gerçek alanlar:
   * email
   * pass
   * remember
   * =====================================================
   */

  const loginBody =
    new URLSearchParams({
      email:
        username,
      pass:
        password,
      remember:
        "1",
    });

  const loginHeaders =
    browserHeaders(
      toCookieHeader(
        jar
      )
    );

  loginHeaders.set(
    "Content-Type",
    "application/x-www-form-urlencoded"
  );

  loginHeaders.set(
    "Origin",
    EGB_BASE_URL
  );

  loginHeaders.set(
    "Referer",
    `${EGB_BASE_URL}/`
  );

  /*
   * redirect: manual önemli.
   * Login response'un Set-Cookie değerlerini
   * redirect gerçekleşmeden önce yakalıyoruz.
   */
  const loginResponse =
    await fetchSessionRequest(
      EGB_LOGIN_URL,
      {
        method: "POST",
        headers:
          loginHeaders,
        body:
          loginBody.toString(),
        redirect:
          "manual",
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
    throw new EgbSessionError(
      `EGB giriş isteği başarısız. HTTP ${loginResponse.status}.`,
      "LOGIN_REQUEST_FAILED",
      502,
      {
        responseStatus:
          loginResponse.status,
      }
    );
  }

  /*
   * Response body varsa tüket.
   * Burada şifre/cookie loglanmaz.
   */
  await loginResponse.text();

  /*
   * =====================================================
   * 3. VERIFY LOGIN
   * =====================================================
   */

  const loggedIn =
    await verifySession(
      jar
    );

  if (!loggedIn) {
    throw new EgbSessionError(
      "EGB giriş işlemi tamamlanamadı. Kullanıcı adı/şifre hatalı olabilir veya giriş akışı değişmiş olabilir.",
      "LOGIN_FAILED",
      401
    );
  }

  const cookieHeader =
    toCookieHeader(
      jar
    );

  if (!cookieHeader) {
    throw new EgbSessionError(
      "EGB girişi başarılı görünüyor ancak oturum cookie bilgisi oluşturulamadı.",
      "LOGIN_FAILED",
      500
    );
  }

  cachedSessionCookie =
    cookieHeader;

  return cookieHeader;
}

export function invalidateEgbSession() {
  cachedSessionCookie =
    null;
}

export async function loginEgb() {
  invalidateEgbSession();

  if (loginPromise) {
    return loginPromise;
  }

  loginPromise =
    performLogin();

  try {
    return await loginPromise;
  } finally {
    loginPromise =
      null;
  }
}

export async function getEgbSessionCookie(
  options?: {
    forceLogin?: boolean;
  }
) {
  const forceLogin =
    options?.forceLogin ===
      true;

  if (
    !forceLogin &&
    cachedSessionCookie
  ) {
    return cachedSessionCookie;
  }

  /*
   * Geçiş sürecinde eski EGB_COOKIE varsa ilk denemede
   * kullanılabilir. Geçersiz çıkarsa scraper forceLogin
   * ile otomatik gerçek login yapacak.
   */
  if (!forceLogin) {
    const envCookie =
      process.env
        .EGB_COOKIE
        ?.trim();

    if (envCookie) {
      cachedSessionCookie =
        envCookie;

      return envCookie;
    }
  }

  return loginEgb();
}
