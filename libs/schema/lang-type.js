const listQuery = {
  type: 'object',
  properties: {
    filter: { type: 'object', default: {} },
    keyword: { type: 'string' },
    namespace: { type: 'string' },
    isDefault: { type: 'boolean' },
    perPage: { type: 'number', default: 20 },
    currentPage: { type: 'number', default: 1 }
  }
};

const createBody = {
  type: 'object',
  required: ['name', 'code'],
  properties: {
    name: { type: 'string' },
    code: { type: 'string' },
    params: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string', enum: ['open', 'closed'] }
  }
};

const saveBody = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {},
    name: { type: 'string' },
    params: { type: 'string' },
    description: { type: 'string' },
    status: { type: 'string', enum: ['open', 'closed'] }
  }
};

const removeBody = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {}
  }
};

const setStatusBody = {
  type: 'object',
  required: ['id', 'status'],
  properties: {
    id: {},
    status: { type: 'string', enum: ['open', 'closed'] }
  }
};

const setDefaultBody = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {}
  }
};

const moveBody = {
  type: 'object',
  required: ['id', 'direction'],
  properties: {
    id: {},
    direction: { type: 'string', enum: ['up', 'down'] }
  }
};

const translateRemainingBody = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {},
    namespace: { type: 'string' },
    limit: { type: 'integer', minimum: 1, maximum: 500 }
  }
};

module.exports = {
  listQuery,
  createBody,
  saveBody,
  removeBody,
  setStatusBody,
  setDefaultBody,
  moveBody,
  translateRemainingBody
};
