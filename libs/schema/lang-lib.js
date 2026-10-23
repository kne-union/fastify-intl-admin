const { obj, arr, str, num, success, langLib, langLibListItem, importResultFields } = require('./response');

const ID = { description: '单个词条 ID；与 ids 二选一，同时传时以非空的 ids 为准' };
const IDS = {
  type: 'array',
  items: { description: '词条 ID' },
  description: '批量操作的词条 ID 列表；非空时忽略 id'
};

const listQuery = {
  type: 'object',
  properties: {
    filter: { type: 'object', default: {}, description: '筛选条件对象，可含 keyword、namespace、locale、reviewStatus、status、code；与顶层同名字段同时传时以 filter 为准' },
    keyword: { type: 'string', description: '关键字，模糊匹配命名空间、词条编码、译文' },
    namespace: { type: 'string', description: '按命名空间精确筛选' },
    locale: { type: 'string', description: '按语言编码精确筛选' },
    reviewStatus: { type: 'string', enum: ['approved', 'pending', 'rejected'], description: '按审核状态筛选：approved 已通过，pending 待审核，rejected 已驳回' },
    status: { description: '按状态筛选：open 启用，closed 禁用' },
    code: { description: '按词条编码精确筛选' },
    perPage: { type: 'number', default: 20, description: '每页条数，非正数按 20 处理' },
    currentPage: { type: 'number', default: 1, description: '页码，从 1 开始，非正数按 1 处理' }
  }
};

const addPackageBody = {
  type: 'object',
  required: ['namespace', 'code', 'locales'],
  properties: {
    namespace: { type: 'string', description: '命名空间，去除首尾空白后不能为空' },
    code: { type: 'string', description: '词条编码，去除首尾空白后不能为空' },
    locales: {
      type: 'array',
      minItems: 1,
      items: { type: 'string', description: '语言编码' },
      description: '要创建词条的语言编码列表，须均为已启用的语言，且同命名空间同编码下不能已存在'
    },
    aiGenerate: { type: 'boolean', default: false, description: '是否调用 generateTargets 用 AI 生成非默认语言译文；AI 生成的词条为待审核' },
    sourceTarget: { type: 'string', description: '默认语言源文；aiGenerate 为 true 时必填，作为默认语言译文并作为 AI 翻译源' },
    defaultLocale: { type: 'string', description: '默认语言编码；不传使用系统默认语言' },
    targets: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: '手动填写的译文，键为语言编码、值为译文；aiGenerate 为 true 时忽略'
    }
  }
};

const saveBody = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { description: '词条 ID' },
    target: { type: 'string', description: '译文；不传保持原值。译文变化时默认语言词条直接审核通过，其他语言重置为待审核' },
    namespace: { type: 'string', description: '命名空间，不可修改，传入会被忽略' },
    code: { type: 'string', description: '词条编码，不可修改，传入会被忽略' },
    locale: { description: '语言编码，不可修改，传入会被忽略' },
    status: { type: 'string', enum: ['open', 'closed'], description: '状态：open 启用，closed 禁用；不传保持原值' }
  }
};

const removeBody = {
  type: 'object',
  properties: {
    id: ID,
    ids: IDS
  }
};

const setStatusBody = {
  type: 'object',
  required: ['status'],
  properties: {
    id: ID,
    ids: IDS,
    status: { type: 'string', enum: ['open', 'closed'], description: '目标状态：open 启用，closed 禁用' }
  }
};

const reviewBody = {
  type: 'object',
  required: ['reviewStatus'],
  properties: {
    id: ID,
    ids: IDS,
    reviewStatus: { type: 'string', enum: ['approved', 'rejected'], description: '审核结果：approved 通过，rejected 驳回' },
    reviewRemark: { type: 'string', maxLength: 500, description: '审核备注；不传保持原备注' }
  }
};

const regenerateBody = {
  type: 'object',
  properties: {
    id: ID,
    ids: IDS
  }
};

const copyToNamespaceBody = {
  type: 'object',
  required: ['namespace'],
  properties: {
    namespace: { type: 'string', description: '目标命名空间；与源命名空间相同或目标下已存在同编码同语言的词条会被跳过' },
    id: ID,
    ids: IDS
  }
};

const messagesQuery = {
  type: 'object',
  required: ['locale'],
  properties: {
    locale: { type: 'string', description: '语言编码，如 zh-CN' },
    namespace: { type: 'string', default: 'global', description: '命名空间，默认 global' }
  }
};

const exportQuery = {
  type: 'object',
  properties: {
    namespace: { type: 'string', description: '只导出该命名空间；不传导出全部' }
  }
};

const importFileItem = {
  type: 'object',
  required: ['filename', 'content'],
  description: 'i18n 文件',
  properties: {
    filename: { type: 'string', description: '文件名：namespace.locale.i18n，或 locale.i18n（命名空间为 global）' },
    content: { type: 'string', description: '文件内容，每行 code="target"，译文支持 \\" 与 \\\\ 转义，空行忽略' }
  }
};

const importBody = {
  type: 'object',
  properties: {
    filename: { type: 'string', description: '单文件导入的文件名，格式同 files[].filename；传了非空 files 时忽略' },
    content: { type: 'string', description: '单文件导入的文件内容，格式同 files[].content' },
    files: {
      type: 'array',
      minItems: 1,
      items: importFileItem,
      description: '批量导入的文件列表'
    }
  }
};

const listResponse = success('语言词条分页列表，按命名空间、编码、语言升序', {
  type: 'object',
  additionalProperties: true,
  properties: {
    pageData: arr('当前页词条', langLibListItem),
    totalCount: num('符合条件的词条总数')
  }
});

const namespacesResponse = success('全部命名空间，global 排在最前，其余按名称排序', {
  type: 'object',
  additionalProperties: true,
  properties: {
    pageData: arr('命名空间列表', obj('命名空间', { namespace: str('命名空间名称') })),
    totalCount: num('命名空间数量')
  }
});

const addPackageResponse = success('新建的词条列表，每种语言一条', arr(undefined, langLib));

const copyToNamespaceResponse = success(
  '复制结果统计',
  obj(undefined, {
    createdCount: num('新建的词条数'),
    skippedCount: num('跳过的词条数（源命名空间与目标相同，或目标下已存在）')
  })
);

const messagesResponse = success('扁平语言包：键为词条编码，值为译文；只包含已启用且审核通过的词条', {
  type: 'object',
  additionalProperties: true
});

const exportResponse = success(
  '导出的 i18n 文件列表，按命名空间 + 语言分组',
  obj(undefined, {
    pageData: arr(
      'i18n 文件',
      obj('i18n 文件', {
        filename: str('文件名：namespace.locale.i18n'),
        content: str('文件内容，每行 code="target"')
      })
    )
  })
);

const importResponse = success(
  '导入结果统计；已存在的词条会被覆盖并直接审核通过',
  obj(
    undefined,
    Object.assign({}, importResultFields, {
      pageData: arr(
        '每个文件的导入结果',
        obj(
          '单个文件导入结果',
          Object.assign(
            {
              filename: str('文件名'),
              namespace: str('解析出的命名空间'),
              locale: str('解析出的语言编码')
            },
            importResultFields
          )
        )
      )
    })
  )
);

module.exports = {
  listQuery,
  addPackageBody,
  saveBody,
  removeBody,
  setStatusBody,
  reviewBody,
  regenerateBody,
  copyToNamespaceBody,
  messagesQuery,
  exportQuery,
  importBody,
  listResponse,
  namespacesResponse,
  addPackageResponse,
  copyToNamespaceResponse,
  messagesResponse,
  exportResponse,
  importResponse
};
