const fp = require('fastify-plugin');
const schema = require('../schema/lang-type');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const getAuth = type => (options.getAuthenticate ? options.getAuthenticate(type) : []);

  fastify.get(
    `${options.prefix}/lang-type/list`,
    {
      onRequest: getAuth('langType'),
      schema: {
        summary: '语言类型列表',
        query: schema.listQuery
      }
    },
    async request => services.langType.list(request.userInfo || {}, request.query)
  );

  fastify.post(
    `${options.prefix}/lang-type/create`,
    {
      onRequest: getAuth('langType:manage'),
      schema: {
        summary: '创建语言类型',
        body: schema.createBody
      }
    },
    async request => services.langType.create(request.userInfo || {}, request.body)
  );

  fastify.post(
    `${options.prefix}/lang-type/save`,
    {
      onRequest: getAuth('langType:manage'),
      schema: {
        summary: '保存语言类型',
        body: schema.saveBody
      }
    },
    async request => {
      await services.langType.save(request.userInfo || {}, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/lang-type/remove`,
    {
      onRequest: getAuth('langType:manage'),
      schema: {
        summary: '删除语言类型',
        body: schema.removeBody
      }
    },
    async request => {
      await services.langType.remove(request.userInfo || {}, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/lang-type/set-status`,
    {
      onRequest: getAuth('langType:manage'),
      schema: {
        summary: '设置语言类型状态',
        body: schema.setStatusBody
      }
    },
    async request => {
      await services.langType.setStatus(request.userInfo || {}, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/lang-type/set-default`,
    {
      onRequest: getAuth('langType:manage'),
      schema: {
        summary: '设置默认语言',
        body: schema.setDefaultBody
      }
    },
    async request => {
      await services.langType.setDefault(request.userInfo || {}, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/lang-type/move`,
    {
      onRequest: getAuth('langType:manage'),
      schema: {
        summary: '语言类型上移/下移',
        body: schema.moveBody
      }
    },
    async request => services.langType.move(request.userInfo || {}, request.body)
  );

  fastify.post(
    `${options.prefix}/lang-type/translate-remaining`,
    {
      onRequest: getAuth('langType:manage'),
      schema: {
        summary: '补译目标语言缺失词条',
        body: schema.translateRemainingBody
      }
    },
    async request => services.langType.translateRemaining(request.userInfo || {}, request.body)
  );
});
