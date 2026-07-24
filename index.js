const fp = require('fastify-plugin');
const path = require('node:path');
const { ensureHttpErrors } = require('./libs/utils/http-errors');

module.exports = fp(async (fastify, options) => {
  ensureHttpErrors(fastify);

  options = Object.assign(
    {},
    {
      dbTableNamePrefix: 't_',
      name: 'intl-admin',
      prefix: '/api/v1/intl-admin',
      getAuthenticate: () => {
        return [fastify.account.authenticate.user, fastify.account.authenticate.admin];
      },
      getUserModel: () => {
        if (!fastify.account) {
          throw new Error('请先安装 fastify-account 插件或者实现 options.getUserModel');
        }
        return fastify.account.models.user;
      },
      // ({ namespace, code, locales, sourceTarget, defaultLocale }) => Promise<{ [locale]: string }>
      generateTargets: null
    },
    options
  );

  fastify.register(require('@kne/fastify-namespace'), {
    options,
    name: options.name,
    modules: [
      ['controllers', path.resolve(__dirname, './libs/controllers')],
      [
        'models',
        await fastify.sequelize.addModels(path.resolve(__dirname, './libs/models'), {
          prefix: options.dbTableNamePrefix,
          getUserModel: options.getUserModel,
          modelPrefix: options.name
        })
      ],
      ['services', path.resolve(__dirname, './libs/services')]
    ]
  });
});
