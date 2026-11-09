// A thrown error may carry an HTTP status (e.g. a 400 thrown inside a
// transaction to roll it back); only unexpected ones are logged.
function errorHandler(err, req, res, next) {
  if ((err.status ?? 500) >= 500) console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status ?? 500).json({ error: err.message || 'internal server error' });
}

export default errorHandler;
