const https = require('https');
https.get('https://www.youtube.com/@ExploreLiveNatureCams/about', res => {
  let body = '';
  res.on('data', d => body+=d);
  res.on('end', () => {
    const match = body.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
    if (match) console.log(match[1]);
  });
});
