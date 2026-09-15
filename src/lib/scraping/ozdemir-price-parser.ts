export interface OzdemirParsedPrice {
  priceUsd: number;
  rawPriceUsd: string;
  listPriceUsd: number | null;
  rawListPriceUsd: string | null;
  priceTry: number | null;
  rawPriceTry: string | null;
}

function decodeHtmlEntities(
  value: string
) {
  return value
    .replace(/&nbsp;/gi, " ")
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

function htmlToText(
  html: string
) {
  return decodeHtmlEntities(
    html.replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseTurkishNumber(
  rawValue: string
) {
  const clean = rawValue
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const value = Number(clean);

  return Number.isFinite(value)
    ? value
    : null;
}

function parseInvariantNumber(
  rawValue: string
) {
  const clean = rawValue
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");

  const value = Number(clean);

  return Number.isFinite(value)
    ? value
    : null;
}

function extractUsd(
  html: string
) {
  const text = htmlToText(html);

  const match =
    text.match(
      /\$\s*([0-9][0-9.]*,[0-9]{1,2}|[0-9]+(?:\.[0-9]{1,2})?)/
    );

  if (!match?.[1]) {
    return null;
  }

  const value =
    match[1].includes(",")
      ? parseTurkishNumber(
          match[1]
        )
      : parseInvariantNumber(
          match[1]
        );

  if (value === null) {
    return null;
  }

  return {
    value,
    raw: `$${match[1]}`,
  };
}

function extractTryFromText(
  html: string
) {
  const text = htmlToText(html);

  const match =
    text.match(
      /\(([0-9][0-9.]*,[0-9]{1,2})\s*TL\)/i
    );

  if (!match?.[1]) {
    return null;
  }

  const value =
    parseTurkishNumber(
      match[1]
    );

  if (value === null) {
    return null;
  }

  return {
    value,
    raw: `${match[1]} TL`,
  };
}

export function parseOzdemirProductPriceHtml(
  html: string
): OzdemirParsedPrice | null {
  /*
   * Ürün detayındaki ana fiyat bloğu örneği:
   *
   * <div class="price-item" data-basket-price="1532.48">
   *   <p class="price">
   *     <del>... $35,00 (1.702,75 TL) ...</del>
   *     <ins>... $31,50 (1.532,48 TL) ...</ins>
   *   </p>
   * </div>
   *
   * data-basket-price TL fiyatıdır. USD için indirim varsa <ins>,
   * indirim yoksa <del> çıkarıldıktan sonra kalan ana fiyat kullanılır.
   */
  const priceItemMatch =
    html.match(
      /<div\b(?=[^>]*class=["'][^"']*\bprice-item\b[^"']*["'])(?=[^>]*data-basket-price=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/div>/i
    );

  if (!priceItemMatch) {
    return null;
  }

  const rawBasketPrice =
    priceItemMatch[1]?.trim() ??
    "";

  const priceItemHtml =
    priceItemMatch[2] ?? "";

  const insMatch =
    priceItemHtml.match(
      /<ins\b[^>]*>([\s\S]*?)<\/ins>/i
    );

  const delMatch =
    priceItemHtml.match(
      /<del\b[^>]*>([\s\S]*?)<\/del>/i
    );

  const currentPriceHtml =
    insMatch?.[1] ??
    priceItemHtml.replace(
      /<del\b[^>]*>[\s\S]*?<\/del>/gi,
      " "
    );

  const currentUsd =
    extractUsd(
      currentPriceHtml
    );

  if (!currentUsd) {
    return null;
  }

  const listUsd =
    delMatch?.[1]
      ? extractUsd(
          delMatch[1]
        )
      : null;

  const visibleTry =
    extractTryFromText(
      currentPriceHtml
    );

  const basketPriceTry =
    rawBasketPrice
      ? parseInvariantNumber(
          rawBasketPrice
        )
      : null;

  const priceTry =
    basketPriceTry ??
    visibleTry?.value ??
    null;

  return {
    priceUsd:
      currentUsd.value,
    rawPriceUsd:
      currentUsd.raw,
    listPriceUsd:
      listUsd?.value ?? null,
    rawListPriceUsd:
      listUsd?.raw ?? null,
    priceTry,
    rawPriceTry:
      rawBasketPrice
        ? rawBasketPrice
        : visibleTry?.raw ?? null,
  };
}
