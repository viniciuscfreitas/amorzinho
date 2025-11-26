const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('tmp2.html', 'utf8');
const $ = cheerio.load(html);
const sel = '#corePrice_feature_div .a-offscreen';
console.log('sel length', $(sel).length);
$(sel).each((i, el) => {
  console.log(i, $(el).text().trim());
});
const alt = '#corePrice_feature_div';
console.log('corePrice text snippet', $(alt).text().trim().slice(0, 60));
