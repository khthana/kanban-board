const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  const target = process.env.API_PROXY_TARGET || 'http://localhost:4000';
  const proxy = createProxyMiddleware({ target, changeOrigin: true });

  // Only proxy XHR/fetch requests, not browser navigations (Accept: text/html).
  // Browser navigations to /boards/:id etc. should be served by React's historyApiFallback.
  app.use(
    ['/auth', '/boards', '/columns', '/cards', '/labels', '/subtasks'],
    (req, res, next) => {
      if ((req.headers.accept || '').includes('text/html')) return next();
      return proxy(req, res, next);
    }
  );
};
