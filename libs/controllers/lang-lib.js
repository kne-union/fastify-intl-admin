const fp = require('fastify-plugin');
const schema = require('../schema/lang-lib');

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const getAuth = type => (options.getAuthenticate ? options.getAuthenticate(type) : []);

  fastify.get(
    `${options.prefix}/lang-lib/list`,
    {
      onRequest: getAuth('langLib'),
      schema: {
        summary: '语言库词条列表',
        query: schema.listQuery
      }
    },
    async request => services.langLib.list(request.userInfo || {}, request.query)
  );

  fastify.get(
    `${options.prefix}/lang-lib/namespaces`,
    {
      onRequest: getAuth('langLib'),
      schema: {
        summary: '语言库命名空间列表'
      }
    },
    async request => services.langLib.namespaces(request.userInfo || {}, request.query)
  );

  fastify.post(
    `${options.prefix}/lang-lib/add-package`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        summary: '批量添加语言词条',
        body: schema.addPackageBody
      }
    },
    async request => services.langLib.addPackage(request.userInfo || {}, request.body)
  );

  fastify.post(
    `${options.prefix}/lang-lib/save`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        summary: '保存语言词条',
        body: schema.saveBody
      }
    },
    async request => {
      await services.langLib.save(request.userInfo || {}, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/lang-lib/remove`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        summary: '删除语言词条',
        body: schema.removeBody
      }
    },
    async request => {
      await services.langLib.remove(request.userInfo || {}, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/lang-lib/set-status`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        summary: '设置语言词条状态',
        body: schema.setStatusBody
      }
    },
    async request => {
      await services.langLib.setStatus(request.userInfo || {}, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/lang-lib/review`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        summary: '审核语言词条',
        body: schema.reviewBody
      }
    },
    async request => {
      await services.langLib.review(request.userInfo || {}, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/lang-lib/regenerate`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        summary: '重新生成待审核词条译文',
        body: schema.regenerateBody
      }
    },
    async request => {
      await services.langLib.regenerate(request.userInfo || {}, request.body);
      return {};
    }
  );

  fastify.post(
    `${options.prefix}/lang-lib/copy-to-namespace`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        summary: '复制词条到新命名空间',
        body: schema.copyToNamespaceBody
      }
    },
    async request => services.langLib.copyToNamespace(request.userInfo || {}, request.body)
  );

  fastify.get(
    `${options.prefix}/lang-lib/messages`,
    {
      // 运行时语言包：允许未登录访问
      schema: {
        summary: '运行时语言包（扁平 code→文案，无需登录）',
        query: schema.messagesQuery
      }
    },
    async request => services.langLib.messages(request.userInfo || {}, request.query)
  );

  fastify.get(
    `${options.prefix}/lang-lib/export`,
    {
      onRequest: getAuth('langLib'),
      schema: {
        summary: '导出语言库 i18n 文件',
        query: schema.exportQuery
      }
    },
    async request => services.langLib.exportI18n(request.userInfo || {}, request.query)
  );

  fastify.post(
    `${options.prefix}/lang-lib/import`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        summary: '导入语言库 i18n 文件',
        body: schema.importBody
      }
    },
    async request => services.langLib.importI18n(request.userInfo || {}, request.body)
  );
});
