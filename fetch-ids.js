const https = require('https');
https.get('https://www.youtube.com/@exploreorg/streams', res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const matches = [...body.matchAll(/\"videoId\":\"([A-Za-z0-9_-]{11})\"/g)];
    const uniqueIds = [...new Set(matches.map(m => m[1]))].slice(0, 20);
    console.log(uniqueIds.join(', '));
  });
});
