const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use(
  '/',
  createProxyMiddleware({
    target: 'http://127.0.0.1:8080', // Your http-server URL
    changeOrigin: true,
    onProxyRes: (proxyRes) => {
      proxyRes.headers['Access-Control-Allow-Origin'] = '*'; // Set your desired CORS headers
    },
    mode: 'no-cors',
  })
);

app.listen(8081, () => {
  console.log('Proxy server is running on http://localhost:8081');
});
