const fp = require('fastify-plugin');
const schema = require('../schema/lang-type');
const { empty } = require('../schema/response');

const TAG = '国际化管理后台-语言类型';

module.exports = fp(async (fastify, options) => {
  const { services } = fastify[options.name];
  const getAuth = type => (options.getAuthenticate ? options.getAuthenticate(type) : []);

  fastify.get(
    `${options.prefix}/lang-type/list`,
    {
      onRequest: getAuth('langType'),
      schema: {
        tags: [TAG],
        summary: '语言类型列表',
        description: '分页查询语言类型，附带每种语言的词条数与默认语言词条数，可用于展示翻译完成度',
        query: schema.listQuery,
        response: schema.listResponse
      }
    },
    async request => services.langType.list(request.userInfo || {}, request.query)
  );

  fastify.post(
    `${options.prefix}/lang-type/create`,
    {
      onRequest: getAuth('langType:manage'),
      schema: {
        tags: [TAG],
        summary: '创建语言类型',
        description: '新增一种语言；语言编码唯一且创建后不可修改，系统中第一条语言自动成为默认语言',
        body: schema.createBody,
        response: schema.createResponse
      }
    },
    async request => services.langType.create(request.userInfo || {}, request.body)
  );

  fastify.post(
    `${options.prefix}/lang-type/save`,
    {
      onRequest: getAuth('langType:manage'),
      schema: {
        tags: [TAG],
        summary: '保存语言类型',
        description: '修改语言名称、参数提示、描述、状态；语言编码、默认标记和排序不能通过此接口修改',
        body: schema.saveBody,
        response: empty('保存成功，返回空对象')
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
        tags: [TAG],
        summary: '删除语言类型',
        description: '删除语言类型；语言库中仍有该语言的词条时报错。删除的是默认语言时，最早创建的剩余语言自动成为默认',
        body: schema.removeBody,
        response: empty('删除成功，返回空对象')
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
        tags: [TAG],
        summary: '设置语言类型状态',
        description: '启用或禁用语言；禁用的语言不能新增词条，也不能补译',
        body: schema.setStatusBody,
        response: empty('设置成功，返回空对象')
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
        tags: [TAG],
        summary: '设置默认语言',
        description: '把指定语言设为默认语言，并清除其他语言的默认标记；默认语言是 AI 翻译与补译的源语言',
        body: schema.setDefaultBody,
        response: empty('设置成功，返回空对象')
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
        tags: [TAG],
        summary: '语言类型上移/下移',
        description: '与相邻语言交换排序位置；已在首位上移或末位下移时不做修改',
        body: schema.moveBody,
        response: schema.moveResponse
      }
    },
    async request => services.langType.move(request.userInfo || {}, request.body)
  );

  fastify.post(
    `${options.prefix}/lang-type/translate-remaining`,
    {
      onRequest: getAuth('langType:manage'),
      schema: {
        tags: [TAG],
        summary: '补译目标语言缺失词条',
        description: '为目标语言补齐默认语言已有但目标语言缺失的词条：非 global 命名空间优先复用 global 同编码的目标语言译文（直接审核通过），其余一次性调用 generateTargets 生成译文（待审核）。未配置 generateTargets 且需要 AI 翻译时报错',
        body: schema.translateRemainingBody,
        response: schema.translateRemainingResponse
      }
    },
    async request => services.langType.translateRemaining(request.userInfo || {}, request.body)
  );
});
