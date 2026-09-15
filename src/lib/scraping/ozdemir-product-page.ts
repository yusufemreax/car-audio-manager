import {
  getExistingOzdemirSessionCookie,
  getOzdemirSessionCookie,
  invalidateOzdemirSession,
  isOzdemirGuestProductHtml,
  isOzdemirLoggedInHtml,
  isOzdemirUrl,
  OzdemirSessionError,
} from "@/lib/scraping/ozdemir-session";

const OZDEMIR_BASE_URL =
  "https://ozdemirelektronik.com";

const OZDEMIR_FETCH_TIMEOUT_MS =
  15000;

const OZDEMIR_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36";

export type OzdemirProductPageErrorCode =
  | "INVALID_URL"
  | "NETWORK_ERROR"
  | "UNEXPECTED_REDIRECT"
  | "HTTP_ERROR"
  | "SESSION_EXPIRED";

export class OzdemirProductPageError extends Error {
  readonly code: OzdemirProductPageErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: OzdemirProductPageErrorCode,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OzdemirProductPageError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface OzdemirProductPageResult {
  source: "OZDEMIR";
  sourceUrl: string;
  finalUrl: string;
  responseStatus: number;
  loggedIn: boolean;
  loginPerformed: boolean;
  guestPromptFound: boolean;
  html: string;
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : String(error);
}

function buildHeaders(
  cookie?: string | null
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
    "Referer",
    `${OZDEMIR_BASE_URL}/`
  );

  if (cookie) {
    headers.set(
      "Cookie",
      cookie
    );
  }

  return headers;
}

async function fetchProductPage(
  sourceUrl: string,
  cookie?: string | null
) {
  try {
    return await fetch(
      sourceUrl,
      {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        headers:
          buildHeaders(cookie),
        signal:
          AbortSignal.timeout(
            OZDEMIR_FETCH_TIMEOUT_MS
          ),
      }
    );
  } catch (error) {
    throw new OzdemirProductPageError(
      "Özdemir Elektronik ürün sayfasına bağlanılamadı.",
      "NETWORK_ERROR",
      502,
      {
        error:
          getErrorMessage(error),
      }
    );
  }
}

function validateFinalUrl(
  response: Response
) {
  if (
    !isOzdemirUrl(
      response.url
    )
  ) {
    throw new OzdemirProductPageError(
      "Özdemir Elektronik isteği beklenmeyen bir adrese yönlendirildi.",
      "UNEXPECTED_REDIRECT",
      502,
      {
        finalUrl:
          response.url,
      }
    );
  }
}

function throwForHttpError(
  response: Response
) {
  if (response.ok) {
    return;
  }

  throw new OzdemirProductPageError(
    `Özdemir Elektronik ürün sayfası alınamadı. HTTP ${response.status}.`,
    "HTTP_ERROR",
    response.status === 404
      ? 404
      : 502,
    {
      responseStatus:
        response.status,
      finalUrl:
        response.url,
    }
  );
}

export function hasOzdemirPriceArea(
  html: string
) {
  return (
    /detail=["']priceArea["']/i.test(
      html
    ) &&
    /class=["'][^"']*\bprice-item\b[^"']*["']/i.test(
      html
    )
  );
}

export async function fetchOzdemirProductPage(
  sourceUrl: string
): Promise<OzdemirProductPageResult> {
  const cleanSourceUrl =
    sourceUrl.trim();

  if (
    !isOzdemirUrl(
      cleanSourceUrl
    )
  ) {
    throw new OzdemirProductPageError(
      "Sadece ozdemirelektronik.com ürün linkleri kullanılabilir.",
      "INVALID_URL",
      400
    );
  }

  /*
   * 1. Kullanıcının istediği akış:
   * Ürün linkini önce mevcut session ile veya anonim aç.
   */
  let cookie =
    getExistingOzdemirSessionCookie();

  let response =
    await fetchProductPage(
      cleanSourceUrl,
      cookie
    );

  validateFinalUrl(response);
  throwForHttpError(response);

  let html =
    await response.text();

  let guestPromptFound =
    isOzdemirGuestProductHtml(
      html
    );

  let loginPerformed =
    false;

  /*
   * 2. Sayfa public açılıyor ama fiyat yerine
   * "Toptan Fiyatlar İçin Bayi Girişi Yapınız" görünüyorsa
   * session geçersiz kabul edilir ve otomatik login yapılır.
   */
  const sessionInvalid =
    response.status === 401 ||
    response.status === 403 ||
    guestPromptFound;

  if (sessionInvalid) {
    invalidateOzdemirSession();

    try {
      cookie =
        await getOzdemirSessionCookie({
          forceLogin: true,
        });
    } catch (error) {
      if (
        error instanceof
        OzdemirSessionError
      ) {
        throw error;
      }

      throw error;
    }

    loginPerformed = true;

    /*
     * 3. Login tamamlandıktan sonra AYNI ürün linkini tekrar aç.
     */
    response =
      await fetchProductPage(
        cleanSourceUrl,
        cookie
      );

    validateFinalUrl(response);
    throwForHttpError(response);

    html =
      await response.text();

    guestPromptFound =
      isOzdemirGuestProductHtml(
        html
      );

    if (
      guestPromptFound ||
      !isOzdemirLoggedInHtml(
        html
      )
    ) {
      invalidateOzdemirSession();

      throw new OzdemirProductPageError(
        "Özdemir Elektronik otomatik login sonrasında ürün sayfasında oturum doğrulanamadı.",
        "SESSION_EXPIRED",
        401,
        {
          responseStatus:
            response.status,
          finalUrl:
            response.url,
          guestPromptFound,
        }
      );
    }
  }

  return {
    source: "OZDEMIR",
    sourceUrl:
      cleanSourceUrl,
    finalUrl:
      response.url,
    responseStatus:
      response.status,
    loggedIn:
      isOzdemirLoggedInHtml(
        html
      ),
    loginPerformed,
    guestPromptFound,
    html,
  };
}
