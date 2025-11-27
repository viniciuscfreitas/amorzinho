const fetch = require('node-fetch');
const fs = require('fs');
(async () => {
  const url = 'https://www.amazon.com.br/PlayStation%C2%AE5-Slim-Digital-825GB-Turismo/dp/B0FPGF9J2J/ref=nav_ya_signin?__mk_pt_BR=%C3%85M%C3%85%C5%BD%C3%95%C3%91&crid=H2LSMYBSEUDR&dib=eyJ2IjoiMSJ9.33AAXNUmDbmNXw5rBGQ6KCILud8_D_B5nFUnTotRVYEGK6p1-B2AryiuNfp9-ntjOQQpNXKWacIjamqAqzcprXH44K461u-jBrS4UR9zQ1DVuxRx6tXV5huCXMPkT7yl-R5OpGUOhVxHEkMWm4QlhIMmifhykxEiQZRVSBYXbJI_ZiGG98BrJRXeSbD-eOvnHLQ7ETAR0JZwgMiXr4JWzujTMlh4nMoMB5ModB84JpEs.S5jTHQD2HECD16PbnYI3PNmSnnAv0FFM7aJ2-HX6zAY&dib_tag=se&keywords=ps5&qid=1763995383&s=videogames&sprefix=ps5%2Bblackfriday%2Cvideogames%2C154&sr=1-3&ufe=app_do%3Aamzn1.fos.9e6a115c-05b9-4b96-8e1c-b1f9ce2ac1a6&th=1';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8'
    }
  });
  const text = await res.text();
  fs.writeFileSync('tmp2.html', text);
})();
