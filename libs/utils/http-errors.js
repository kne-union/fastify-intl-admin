/**
 * 构造带 statusCode 的 HTTP 错误（不依赖 @fastify/sensible）
 * @param {number} statusCode
 * @param {string} message
 * @returns {Error}
 */
const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * @returns {{ badRequest: Function, notFound: Function, internalServerError: Function }}
 */
const createHttpErrors = () => ({
  badRequest: message => createHttpError(400, message),
  notFound: message => createHttpError(404, message),
  internalServerError: message => createHttpError(500, message)
});

/**
 * 确保 fastify 上有 httpErrors（优先沿用宿主 @fastify/sensible）
 * @param {import('fastify').FastifyInstance} fastify
 */
const ensureHttpErrors = fastify => {
  if (fastify.hasDecorator && fastify.hasDecorator('httpErrors') && fastify.httpErrors) {
    return fastify.httpErrors;
  }
  if (fastify.httpErrors) {
    return fastify.httpErrors;
  }
  const httpErrors = createHttpErrors();
  if (typeof fastify.decorate === 'function') {
    try {
      fastify.decorate('httpErrors', httpErrors);
    } catch (e) {
      // 已存在则忽略
    }
  }
  return fastify.httpErrors || httpErrors;
};

module.exports = {
  createHttpError,
  createHttpErrors,
  ensureHttpErrors
};
