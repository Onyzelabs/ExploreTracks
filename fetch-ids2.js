const https = require('https');
https.get('https://www.youtube.com/results?search_query=explore+live+nature+cams&sp=EgJAAQ%253D%253D', res => {
  let body = '';
  res.on('data', d => body+=d);
  res.on('end', () => {
    const matches = [...body.matchAll(/\"videoId\":\"([a-zA-Z0-9_-]{11})\"/g)];
    const uniqueIds = [...new Set(matches.map(m => m[1]))];
    console.log(uniqueIds.slice(0, 15).join(', '));
  });
});
