// 响应 schema 只用于 OpenAPI 文档：字段可空、对象允许额外字段，避免序列化改变实际输出
const str = description => ({ type: 'string', nullable: true, description });
const num = description => ({ type: 'number', nullable: true, description });
const bool = description => ({ type: 'boolean', nullable: true, description });
// ID（BIGINT）、外键与日期可能是 number / string / Date，不声明类型，原样输出
const any = description => ({ description });
const obj = (description, properties) => ({ type: 'object', nullable: true, additionalProperties: true, description, properties });
const arr = (description, items) => ({ type: 'array', items, description });

const success = (description, schema) => ({ 200: Object.assign({}, schema || { type: 'object', additionalProperties: true }, { description }) });
const empty = description => success(description || '操作成功，返回空对象');

const STATUS = '状态：open 启用，closed 禁用';
const REVIEW_STATUS = '审核状态：approved 已通过，pending 待审核，rejected 已驳回';

const createdUser = obj('添加人（账号插件的用户记录）');

const langTypeFields = {
  id: any('语言类型 ID'),
  name: str('语言名称'),
  code: str('语言编码，如 zh-CN'),
  params: str('翻译参数提示'),
  description: str('描述'),
  status: str(STATUS),
  isDefault: bool('是否为默认语言（全局唯一）'),
  sort: num('排序，越小越靠前'),
  userId: any('添加人用户 ID'),
  createdAt: any('创建时间'),
  updatedAt: any('更新时间'),
  deletedAt: any('删除时间，未删除为 null')
};

const langType = obj('语言类型', langTypeFields);

const langTypeListItem = obj(
  '语言类型（含词条统计）',
  Object.assign({}, langTypeFields, {
    createdUser,
    entryCount: num('该语言的词条数（传 namespace 时只统计该命名空间）'),
    defaultEntryCount: num('默认语言的词条数（统计口径同 entryCount），用于计算翻译完成度')
  })
);

const langLibFields = {
  id: any('词条 ID'),
  namespace: str('命名空间'),
  code: str('词条编码'),
  locale: str('语言编码'),
  target: str('译文'),
  reviewStatus: str(REVIEW_STATUS),
  reviewRemark: str('审核备注'),
  status: str(STATUS),
  userId: any('添加人用户 ID'),
  createdAt: any('创建时间'),
  updatedAt: any('更新时间'),
  deletedAt: any('删除时间，未删除为 null')
};

const langLib = obj('语言词条', langLibFields);

const langLibListItem = obj(
  '语言词条（含默认语言源文）',
  Object.assign({}, langLibFields, {
    createdUser,
    sourceTarget: str('同命名空间、同编码的默认语言译文；当前词条即默认语言时为自身译文，未设置默认语言或无源文时为空字符串'),
    defaultLocale: str('当前默认语言编码，未设置时为空字符串')
  })
);

const importResultFields = {
  createdCount: num('新增词条数'),
  updatedCount: num('覆盖更新的已有词条数'),
  skippedCount: num('跳过的词条数')
};

module.exports = {
  str,
  num,
  bool,
  any,
  obj,
  arr,
  success,
  empty,
  STATUS,
  REVIEW_STATUS,
  langType,
  langTypeListItem,
  langLib,
  langLibListItem,
  importResultFields
};
