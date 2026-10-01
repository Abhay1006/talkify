// Express 4 does not catch rejected promises from async handlers. Wrapping
// every handler forwards those rejections to the global error handler in
// server.js, so controllers no longer each need their own try/catch.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
