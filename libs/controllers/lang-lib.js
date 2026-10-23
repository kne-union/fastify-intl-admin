const fp = require('fastify-plugin');
const schema = require('../schema/lang-lib');
const { empty } = require('../schema/response');

const TAG = '国际化管理后台-语言库';
const RUNTIME_TAG = '国际化-运行时';

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const getAuth = type => (options.getAuthenticate ? options.getAuthenticate(type) : []);

  fastify.get(
    `${options.prefix}/lang-lib/list`,
    {
      onRequest: getAuth('langLib'),
      schema: {
        tags: [TAG],
        summary: '语言库词条列表',
        description: '分页查询语言词条，每条附带默认语言源文（sourceTarget）便于对照翻译',
        query: schema.listQuery,
        response: schema.listResponse
      }
    },
    async request => services.langLib.list(request.userInfo || {}, request.query)
  );

  fastify.get(
    `${options.prefix}/lang-lib/namespaces`,
    {
      onRequest: getAuth('langLib'),
      schema: {
        tags: [TAG],
        summary: '语言库命名空间列表',
        description: '列出语言库中已有词条的全部命名空间（去重）',
        response: schema.namespacesResponse
      }
    },
    async request => services.langLib.namespaces(request.userInfo || {}, request.query)
  );

  fastify.post(
    `${options.prefix}/lang-lib/add-package`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        tags: [TAG],
        summary: '批量添加语言词条',
        description: '为同一命名空间 + 编码一次创建多种语言的词条。手动模式用 targets 填译文，均直接审核通过；aiGenerate 模式由 generateTargets 生成非默认语言译文，默认语言词条直接通过，其他语言为待审核',
        body: schema.addPackageBody,
        response: schema.addPackageResponse
      }
    },
    async request => services.langLib.addPackage(request.userInfo || {}, request.body)
  );

  fastify.post(
    `${options.prefix}/lang-lib/save`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        tags: [TAG],
        summary: '保存语言词条',
        description: '修改词条译文与状态；命名空间、编码、语言不可修改。译文变化时默认语言词条直接审核通过，其他语言重置为待审核并清空审核备注',
        body: schema.saveBody,
        response: empty('保存成功，返回空对象')
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
        tags: [TAG],
        summary: '删除语言词条',
        description: '按 id 或 ids 删除词条，均不存在时报错',
        body: schema.removeBody,
        response: empty('删除成功，返回空对象')
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
        tags: [TAG],
        summary: '设置语言词条状态',
        description: '按 id 或 ids 批量启用或禁用词条；禁用的词条不出现在运行时语言包中',
        body: schema.setStatusBody,
        response: empty('设置成功，返回空对象')
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
        tags: [TAG],
        summary: '审核语言词条',
        description: '按 id 或 ids 批量审核词条；只有审核通过的词条会出现在运行时语言包中',
        body: schema.reviewBody,
        response: empty('审核成功，返回空对象')
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
        tags: [TAG],
        summary: '重新生成待审核词条译文',
        description: '对待审核或已通过的非默认语言词条，按默认语言源文重新调用 generateTargets 生成译文，结果重置为待审核；未配置 generateTargets、缺少源文或包含默认语言词条时报错',
        body: schema.regenerateBody,
        response: empty('重新生成成功，返回空对象')
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
        tags: [TAG],
        summary: '复制词条到新命名空间',
        description: '把选中的词条（含译文、审核状态、启用状态）复制到目标命名空间；目标下已存在同编码同语言的词条会被跳过，全部跳过时报错',
        body: schema.copyToNamespaceBody,
        response: schema.copyToNamespaceResponse
      }
    },
    async request => services.langLib.copyToNamespace(request.userInfo || {}, request.body)
  );

  fastify.get(
    `${options.prefix}/lang-lib/messages`,
    {
      // 运行时语言包：允许未登录访问
      schema: {
        tags: [RUNTIME_TAG],
        summary: '运行时语言包（扁平 code→文案，无需登录）',
        description: '前端运行时拉取语言包，返回 { code: 译文 }，可直接给 @kne/react-intl 使用；只包含已启用且审核通过的词条，无需登录',
        query: schema.messagesQuery,
        response: schema.messagesResponse
      }
    },
    async request => services.langLib.messages(request.userInfo || {}, request.query)
  );

  fastify.get(
    `${options.prefix}/lang-lib/export`,
    {
      onRequest: getAuth('langLib'),
      schema: {
        tags: [TAG],
        summary: '导出语言库 i18n 文件',
        description: '按命名空间 + 语言分组导出 i18n 文件内容（JSON 返回文件名与正文，不是文件下载），包含全部状态的词条',
        query: schema.exportQuery,
        response: schema.exportResponse
      }
    },
    async request => services.langLib.exportI18n(request.userInfo || {}, request.query)
  );

  fastify.post(
    `${options.prefix}/lang-lib/import`,
    {
      onRequest: getAuth('langLib:manage'),
      schema: {
        tags: [TAG],
        summary: '导入语言库 i18n 文件',
        description: '导入一个或多个 i18n 文件；已存在的词条覆盖译文，新词条直接创建，导入的词条均为启用且审核通过',
        body: schema.importBody,
        response: schema.importResponse
      }
    },
    async request => services.langLib.importI18n(request.userInfo || {}, request.body)
  );
});
