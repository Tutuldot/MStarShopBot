import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8369;/g, '₱');
}

function getCurrencySymbol(code?: string): string {
  if (!code) return '₱';
  const upper = code.toUpperCase();
  const map: Record<string, string> = {
    PHP: '₱',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
    AUD: 'AU$',
    SGD: 'SG$',
    HKD: 'HK$',
  };
  return map[upper] || upper;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url } = await req.json();
    if (!url || !url.trim()) {
      return NextResponse.json({ error: 'Product URL is required' }, { status: 400 });
    }

    const targetUrl = url.trim();

    // Fetch the WooCommerce product page
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page. HTTP status: ${res.status}` },
        { status: 400 }
      );
    }

    const html = await res.text();

    let name = '';
    let description = '';
    let image_url = '';
    let price: number | null = null;
    let price_max: number | null = null;
    let currency = '₱';
    let currency_code = 'PHP';

    // 1. Try finding Schema.org JSON-LD (Standard for WooCommerce)
    const jsonLdRegex = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let foundProductJsonLd: any = null;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed['@type'] === 'Product') {
          foundProductJsonLd = parsed;
          break;
        } else if (Array.isArray(parsed['@graph'])) {
          const prod = parsed['@graph'].find((item: any) => item['@type'] === 'Product');
          if (prod) {
            foundProductJsonLd = prod;
            break;
          }
        }
      } catch {
        // Continue searching
      }
    }

    if (foundProductJsonLd) {
      name = decodeHtmlEntities(foundProductJsonLd.name || '');
      description = decodeHtmlEntities(foundProductJsonLd.description || '');

      // Image
      if (typeof foundProductJsonLd.image === 'string') {
        image_url = foundProductJsonLd.image;
      } else if (Array.isArray(foundProductJsonLd.image)) {
        image_url = typeof foundProductJsonLd.image[0] === 'string' ? foundProductJsonLd.image[0] : foundProductJsonLd.image[0]?.url || '';
      } else if (foundProductJsonLd.image?.url) {
        image_url = foundProductJsonLd.image.url;
      }

      // Offers / Price / Price Range
      const offers = Array.isArray(foundProductJsonLd.offers) ? foundProductJsonLd.offers[0] : foundProductJsonLd.offers;
      if (offers) {
        if (offers.priceCurrency) {
          currency_code = offers.priceCurrency;
          currency = getCurrencySymbol(offers.priceCurrency);
        }

        // Variable product / Price Range (AggregateOffer)
        if (offers.lowPrice != null && offers.highPrice != null) {
          const low = parseFloat(offers.lowPrice);
          const high = parseFloat(offers.highPrice);
          if (!isNaN(low)) price = low;
          if (!isNaN(high) && high > low) price_max = high;
        } else if (offers.price != null) {
          const p = parseFloat(offers.price);
          if (!isNaN(p)) price = p;
        }
      }
    }

    // 2. Fallbacks from OpenGraph and HTML
    if (!name) {
      const ogTitle = html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1];
      if (ogTitle) {
        name = decodeHtmlEntities(ogTitle.split('–')[0].split('-')[0].trim());
      } else {
        const titleTag = html.match(/<title>([^<]*)<\/title>/i)?.[1];
        if (titleTag) {
          name = decodeHtmlEntities(titleTag.split('–')[0].split('-')[0].trim());
        }
      }
    }

    if (!image_url) {
      image_url = html.match(/<meta property="og:image" content="([^"]*)"/i)?.[1] || '';
    }

    if (!description) {
      const shortDesc = html.match(/class="[^"]*woocommerce-product-details__short-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
      if (shortDesc) {
        description = decodeHtmlEntities(shortDesc.replace(/<[^>]*>/g, '').trim());
      } else {
        const ogDesc = html.match(/<meta property="og:description" content="([^"]*)"/i)?.[1];
        if (ogDesc) {
          description = decodeHtmlEntities(ogDesc.trim());
        }
      }
    }

    // Fallback price extraction if not parsed from JSON-LD
    if (price === null) {
      // Look for WooCommerce price amounts (e.g., &#8369;41,715.00)
      const priceRegex = /class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>([\s\S]*?)<\/bdi>/gi;
      const amounts: number[] = [];
      let pMatch;
      while ((pMatch = priceRegex.exec(html)) !== null) {
        const cleanText = pMatch[1].replace(/<[^>]*>/g, '').replace(/[^\d.,]/g, '').trim();
        const num = parseFloat(cleanText.replace(/,/g, ''));
        if (!isNaN(num) && num > 0) {
          amounts.push(num);
        }
      }

      if (amounts.length >= 2) {
        const sorted = [...amounts].sort((a, b) => a - b);
        price = sorted[0];
        if (sorted[sorted.length - 1] > sorted[0]) {
          price_max = sorted[sorted.length - 1];
        }
      } else if (amounts.length === 1) {
        price = amounts[0];
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        name: decodeHtmlEntities(name),
        price: price ?? 0,
        price_max: price_max ?? null,
        is_range: price_max !== null && price_max > (price ?? 0),
        currency,
        currency_code,
        description: decodeHtmlEntities(description),
        image_url,
        product_url: targetUrl,
      },
    });
  } catch (err: any) {
    console.error('Scrape error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch product details from URL' },
      { status: 500 }
    );
  }
}
