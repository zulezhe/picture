// qianliao-sw.js - 独立的 Service Worker 文件
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = event.request.url;
  const isMedia = /\.(ts|m4s|mp4|aac|mp3|webm|m4a)(\?.*)?$/i.test(url) ||
                  /avc1\.|mp4a\./.test(url) ||
                  event.request.destination === 'video' ||
                  event.request.destination === 'audio';

  if (!isMedia) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request).then(async response => {
      if (!response.ok || !response.body) return response;

      const contentType = response.headers.get('content-type');
      if (!contentType?.match(/video|audio/i) && !isMedia) {
        return response;
      }

      const reader = response.body.getReader();
      const chunks = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalBytes += value.length;
      }

      const combined = new Blob(chunks);
      const arrayBuf = await combined.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuf);

      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'MEDIA_FRAGMENT',
            data: uint8,
            url: url,
            size: totalBytes
          });
        });
      });

      return new Response(combined, {
        status: response.status,
        headers: response.headers
      });
    })
  );
});