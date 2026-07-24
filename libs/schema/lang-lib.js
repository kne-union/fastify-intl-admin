const listQuery = {
  type: 'object',
  properties: {
    filter: { type: 'object', default: {} },
    keyword: { type: 'string' },
    namespace: { type: 'string' },
    locale: { type: 'string' },
    reviewStatus: { type: 'string', enum: ['approved', 'pending', 'rejected'] },
    perPage: { type: 'number', default: 20 },
    currentPage: { type: 'number', default: 1 }
  }
};

const addPackageBody = {
  type: 'object',
  required: ['namespace', 'code', 'locales'],
  properties: {
    namespace: { type: 'string' },
    code: { type: 'string' },
    locales: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' }
    },
    aiGenerate: { type: 'boolean', default: false },
    sourceTarget: { type: 'string' },
    defaultLocale: { type: 'string' },
    targets: { type: 'object', additionalProperties: { type: 'string' } }
  }
};

const saveBody = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {},
    target: { type: 'string' },
    namespace: { type: 'string' },
    code: { type: 'string' },
    locale: {},
    status: { type: 'string', enum: ['open', 'closed'] }
  }
};

const removeBody = {
  type: 'object',
  properties: {
    id: {},
    ids: {
      type: 'array',
      items: {}
    }
  }
};

const setStatusBody = {
  type: 'object',
  required: ['status'],
  properties: {
    id: {},
    ids: {
      type: 'array',
      items: {}
    },
    status: { type: 'string', enum: ['open', 'closed'] }
  }
};

const reviewBody = {
  type: 'object',
  required: ['reviewStatus'],
  properties: {
    id: {},
    ids: {
      type: 'array',
      items: {}
    },
    reviewStatus: { type: 'string', enum: ['approved', 'rejected'] },
    reviewRemark: { type: 'string', maxLength: 500 }
  }
};

const regenerateBody = {
  type: 'object',
  properties: {
    id: {},
    ids: {
      type: 'array',
      items: {}
    }
  }
};

const copyToNamespaceBody = {
  type: 'object',
  required: ['namespace'],
  properties: {
    namespace: { type: 'string' },
    id: {},
    ids: {
      type: 'array',
      items: {}
    }
  }
};

const messagesQuery = {
  type: 'object',
  required: ['locale'],
  properties: {
    locale: { type: 'string' },
    namespace: { type: 'string', default: 'global' }
  }
};

const exportQuery = {
  type: 'object',
  properties: {
    namespace: { type: 'string' }
  }
};

const importFileItem = {
  type: 'object',
  required: ['filename', 'content'],
  properties: {
    filename: { type: 'string' },
    content: { type: 'string' }
  }
};

const importBody = {
  type: 'object',
  properties: {
    filename: { type: 'string' },
    content: { type: 'string' },
    files: {
      type: 'array',
      minItems: 1,
      items: importFileItem
    }
  }
};

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
  importBody
};
