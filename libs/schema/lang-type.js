const { obj, arr, num, bool, success, langType, langTypeListItem } = require('./response');

const ID = { description: '语言类型 ID' };

const listQuery = {
  type: 'object',
  properties: {
    filter: { type: 'object', default: {}, description: '筛选条件对象，可含 keyword、status、isDefault、namespace；与顶层同名字段同时传时以 filter 为准' },
    keyword: { type: 'string', description: '关键字，模糊匹配语言名称、编码、描述' },
    status: { description: '按状态筛选：open 启用，closed 禁用' },
    namespace: { type: 'string', description: '命名空间；只影响 entryCount / defaultEntryCount 的统计范围，不过滤语言类型' },
    isDefault: { type: 'boolean', description: '按是否默认语言筛选' },
    perPage: { type: 'number', default: 20, description: '每页条数，非正数按 20 处理' },
    currentPage: { type: 'number', default: 1, description: '页码，从 1 开始，非正数按 1 处理' }
  }
};

const createBody = {
  type: 'object',
  required: ['name', 'code'],
  properties: {
    name: { type: 'string', description: '语言名称，如 中文（简体）' },
    code: { type: 'string', description: '语言编码，如 zh-CN；去除首尾空白后不能为空且不能与已有语言重复，创建后不可修改' },
    params: { type: 'string', description: '翻译参数提示，供 AI 翻译时参考' },
    description: { type: 'string', description: '描述' },
    status: { type: 'string', enum: ['open', 'closed'], description: '状态：open 启用，closed 禁用；不传为 open' }
  }
};

const saveBody = {
  type: 'object',
  required: ['id'],
  properties: {
    id: ID,
    name: { type: 'string', description: '语言名称；不传保持原值' },
    params: { type: 'string', description: '翻译参数提示；不传保持原值' },
    description: { type: 'string', description: '描述；不传保持原值' },
    status: { type: 'string', enum: ['open', 'closed'], description: '状态：open 启用，closed 禁用；不传保持原值' }
  }
};

const removeBody = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { description: '语言类型 ID；仍有关联词条时不能删除，删除默认语言后最早创建的语言自动成为默认' }
  }
};

const setStatusBody = {
  type: 'object',
  required: ['id', 'status'],
  properties: {
    id: ID,
    status: { type: 'string', enum: ['open', 'closed'], description: '目标状态：open 启用，closed 禁用' }
  }
};

const setDefaultBody = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { description: '要设为默认的语言类型 ID；其他语言的默认标记会被清除' }
  }
};

const moveBody = {
  type: 'object',
  required: ['id', 'direction'],
  properties: {
    id: ID,
    direction: { type: 'string', enum: ['up', 'down'], description: '移动方向：up 上移，down 下移（与相邻项交换排序）' }
  }
};

const translateRemainingBody = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { description: '目标语言类型 ID，须为已启用的非默认语言' },
    namespace: { type: 'string', description: '只补译该命名空间的缺失词条；不传补译全部命名空间' },
    limit: { type: 'integer', minimum: 1, maximum: 500, description: '本次最多处理的词条数，用于分批补译；不传一次处理全部' }
  }
};

const listResponse = success('语言类型分页列表，按排序、创建时间升序', {
  type: 'object',
  additionalProperties: true,
  properties: {
    pageData: arr('当前页语言类型', langTypeListItem),
    totalCount: num('符合条件的语言类型总数')
  }
});

const createResponse = success('新建的语言类型；系统第一条语言自动设为默认，新建语言排在最后', langType);

const moveResponse = success('移动结果', obj(undefined, { moved: bool('是否发生了移动；已在首位上移或末位下移时为 false') }));

const translateRemainingResponse = success(
  '补译结果统计',
  obj(undefined, {
    createdCount: num('本次新建的目标语言词条数'),
    copiedCount: num('非 global 命名空间词条直接复用 global 同编码译文的条数（直接审核通过）'),
    generatedCount: num('调用 generateTargets 生成译文的条数（待审核）'),
    remainingCount: num('因 limit 限制本次未处理、仍可继续补译的条数'),
    remainingSkipped: num('默认语言源文为空而跳过的缺失词条数'),
    totalProcessable: num('本次调用前可补译的缺失词条总数')
  })
);

module.exports = {
  listQuery,
  createBody,
  saveBody,
  removeBody,
  setStatusBody,
  setDefaultBody,
  moveBody,
  translateRemainingBody,
  listResponse,
  createResponse,
  moveResponse,
  translateRemainingResponse
};
