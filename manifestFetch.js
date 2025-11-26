const fetch = require('node-fetch');
const cheerio = require('cheerio');
const url = 'https://www.amazon.com.br/PlayStation%C2%AE5-Slim-Digital-825GB-Turismo/dp/B0FPGF9J2J/ref=nav_ya_signin?__mk_pt_BR=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=H2LSMYBSEUDR&dib=eyJ2IjoiMSJ9.33AAXNUmDbmNXw5rBGQ6KCILud8_D_B5nFUnTotRVYEGK6p1-B2AryiuNfp9-ntjOQQpNXKWacIjamqAqzcprXH44K461u-jBrS4UR9zQ1DVuxRx6tXV5huCXMPkT7yl-R5OpGUOhVxHEkMWm4QlhIMmifhykxEiQZRVSBYXbJI_ZiGG98BrJRXeSbD-eOvnHLQ7ETAR0JZwgMiXr4JWzujTMlh4nMoMB5ModB84JpEs.S5jTHQD2HECD16PbnYI3PNmSnnAv0FFM7aJ2-HX6zAY&dib_tag=se&keywords=ps5&qid=1763995383&s=videogames&sprefix=ps5%2Bblackfriday%2Cvideogames%2C154&sr=1-3&ufe=app_do%3Aamzn1.fos.9e6a115c-05b9-4b96-8e1c-b1f9ce2ac1a6&th=1';

async function fetchLinkData(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8'
    },
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  const html = await response.text();
  const $ = cheerio.load(html);

  let title = $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || $('title').text() || '';
  console.log('title raw =>', title);
  let image = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('img').first().attr('src') || '';
  console.log('image raw =>', image);
  let price = '';

  // JSON-LD
  $('script[type="application/ld+json"]').each((i, el) => {
    if (price) return;
    try {
      const json = JSON.parse($(el).html());
      const findPrice = (obj) => {
        if (!obj) return null;
        if (obj['@type'] === 'Offer' || obj['@type'] === 'AggregateOffer') {
          if (obj.price) return obj.price;
          if (obj.lowPrice) return obj.lowPrice;
        }
        if (obj.offers) {
          if (Array.isArray(obj.offers)) {
            for (const offer of obj.offers) {
              const p = findPrice(offer);
              if (p) return p;
            }
          } else {
            return findPrice(obj.offers);
          }
        }
        return null;
      };
      const data = Array.isArray(json) ? json : [json];
      for (const item of data) {
        const p = findPrice(item);
        if (p) {
          price = p.toString();
          break;
        }
      }
    } catch (e) {
      console.error('JSON-LD parse', e.message);
    }
  });
  console.log('price after JSON-LD', price);

  if (!price) {
    price = $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content') || $('meta[name="twitter:data1"]').attr('content') || $('[itemprop="price"]').attr('content') || '';
    console.log('price after meta tags', price);
  }

  if (!price) {
    const selectors = ['.price', '.product-price', '.offer-price', '.sales-price', '.current-price', '#price', '#product-price', '.preco', '.valor', '.price-current', '.vtex-product-price-1-x-currencyInteger', '.sales-price', '.final-price'];
    for (const sel of selectors) {
      const el = $(sel).first();
      if (el.length) {
        const text = el.text().trim();
        if (/\d/.test(text)) {
          price = text;
          console.log('price found (common selector)', sel, text);
          break;
        }
      }
    }
  }

  if (!price) {
    const amazonSelectors = ['#corePrice_feature_div .a-offscreen', '#corePriceDisplay_desktop_feature_div .a-offscreen', '#price_inside_buybox .a-offscreen', '#corePrice .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice', '#priceblock_saleprice', '#priceblock_pospromoprice', '[data-asin-price]', '.a-price .a-offscreen', '.a-color-price .a-offscreen'];
    for (const sel of amazonSelectors) {
      const el = $(sel).first();
      if (el.length) {
        const text = el.text().trim();
        if (text && /\d/.test(text)) {
          price = text;
          console.log('price found (amazon selector)', sel, text);
          break;
        }
      }
    }
  }

  if (!price) {
    const bodyText = $('body').text().substring(0, 50000);
    const match = bodyText.match(/R\$\s?(\d{1,3}(\.?\d{3})*,\d{2})/);
    if (match) {
      price = match[0];
      console.log('price found (regex)', price);
    }
  }

  console.log('price final before clean', price);
  if (!price) {
    console.warn('Price still empty');
  }

  return { title: title.trim().substring(0, 200), price, image: image.substring(0, 500) };
}

fetchLinkData(url).then(console.log).catch(console.error);
