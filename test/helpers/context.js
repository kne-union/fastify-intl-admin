const sinon = require('sinon');

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const createTestContext = () => {
  let langTypeData = [];
  let langLibData = [];
  let langTypeIdCounter = 1;
  let langLibIdCounter = 1;

  const matchOperatorCondition = (fieldValue, condition, Op) => {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      return fieldValue === condition;
    }
    if (Object.prototype.hasOwnProperty.call(condition, Op.in)) {
      const list = condition[Op.in] || [];
      return list.includes(fieldValue);
    }
    if (Object.prototype.hasOwnProperty.call(condition, Op.ne)) {
      return fieldValue !== condition[Op.ne];
    }
    if (
      Object.prototype.hasOwnProperty.call(condition, Op.like) ||
      Object.prototype.hasOwnProperty.call(condition, Op.iLike)
    ) {
      const pattern = String(condition[Op.like] || condition[Op.iLike] || '');
      const normalized = pattern.replaceAll('%', '').toLowerCase();
      return String(fieldValue || '')
        .toLowerCase()
        .includes(normalized);
    }
    return fieldValue === condition;
  };

  const matchWhere = (item, where = {}, Op) => {
    if (!where || typeof where !== 'object') return true;
    const orBranches = Op.or != null ? where[Op.or] : undefined;
    const rest = { ...where };
    if (Op.or != null && Object.prototype.hasOwnProperty.call(rest, Op.or)) {
      delete rest[Op.or];
    }

    const matchRest = Object.entries(rest).every(([key, condition]) => {
      return matchOperatorCondition(item[key], condition, Op);
    });
    if (orBranches == null) return matchRest;

    const branches = Array.isArray(orBranches) ? orBranches : [orBranches];
    const matchOr = branches.some(branch => {
      if (branch && typeof branch === 'object' && !Array.isArray(branch)) {
        return Object.entries(branch).every(([key, condition]) => {
          return matchOperatorCondition(item[key], condition, Op);
        });
      }
      return false;
    });
    return matchRest && matchOr;
  };

  const attachRowMethods = (row, store) => {
    row.update = async function (updateData) {
      Object.assign(this, updateData);
      this.updatedAt = new Date();
      return this;
    };
    row.destroy = async function () {
      const index = store.findIndex(item => item.id === this.id);
      if (index >= 0) {
        store.splice(index, 1);
      }
    };
    row.toJSON = function () {
      return { ...this };
    };
    return row;
  };

  const createMockModel = (store, getNextId, Op) => {
    return {
      create: async data => {
        const row = attachRowMethods(
          {
            id: getNextId(),
            ...data,
            createdAt: data.createdAt || new Date(),
            updatedAt: data.updatedAt || new Date()
          },
          store
        );
        store.push(row);
        return row;
      },
      bulkCreate: async rows => {
        return Promise.all(rows.map(row => createMockModel(store, getNextId, Op).create(row)));
      },
      findByPk: async id => {
        return store.find(item => String(item.id) === String(id)) || null;
      },
      findOne: async ({ where, order } = {}) => {
        let results = store.filter(item => matchWhere(item, where, Op));
        if (order && Array.isArray(order)) {
          results = [...results].sort((a, b) => {
            for (const [key, direction] of order) {
              const aVal = a[key];
              const bVal = b[key];
              if (aVal < bVal) return direction === 'DESC' ? 1 : -1;
              if (aVal > bVal) return direction === 'DESC' ? -1 : 1;
            }
            return 0;
          });
        }
        return results[0] || null;
      },
      findAll: async ({ where, order } = {}) => {
        let results = store.filter(item => matchWhere(item, where, Op));
        if (order && Array.isArray(order)) {
          results = [...results].sort((a, b) => {
            for (const [key, direction] of order) {
              const aVal = a[key];
              const bVal = b[key];
              if (aVal < bVal) return direction === 'DESC' ? 1 : -1;
              if (aVal > bVal) return direction === 'DESC' ? -1 : 1;
            }
            return 0;
          });
        }
        return results;
      },
      findAndCountAll: async ({ where, offset = 0, limit = 20, order } = {}) => {
        let results = store.filter(item => matchWhere(item, where, Op));
        if (order && Array.isArray(order)) {
          results = [...results].sort((a, b) => {
            for (const [key, direction] of order) {
              const aVal = a[key];
              const bVal = b[key];
              if (aVal < bVal) return direction === 'DESC' ? 1 : -1;
              if (aVal > bVal) return direction === 'DESC' ? -1 : 1;
            }
            return 0;
          });
        }
        return {
          rows: results.slice(offset, offset + limit),
          count: results.length
        };
      },
      count: async ({ where } = {}) => {
        return store.filter(item => matchWhere(item, where, Op)).length;
      }
    };
  };

  const createFastify = async (pluginOptions = {}) => {
    const app = require('fastify')();
    const Op = {
      in: Symbol('in'),
      ne: Symbol('ne'),
      like: Symbol('like'),
      iLike: Symbol('iLike'),
      or: Symbol('or')
    };

    const langTypeModel = createMockModel(langTypeData, () => langTypeIdCounter++, Op);
    const langLibModel = createMockModel(langLibData, () => langLibIdCounter++, Op);

    // Fix bulkCreate to reuse same model instance methods
    langTypeModel.bulkCreate = async rows => {
      const created = [];
      for (const row of rows) {
        created.push(await langTypeModel.create(row));
      }
      return created;
    };
    langLibModel.bulkCreate = async rows => {
      const created = [];
      for (const row of rows) {
        created.push(await langLibModel.create(row));
      }
      return created;
    };

    app.decorate('sequelize', {
      Sequelize: { Op }
    });

    app.decorate('httpErrors', {
      badRequest: message => createHttpError(400, message),
      notFound: message => createHttpError(404, message)
    });

    const options = {
      dbTableNamePrefix: 't_',
      name: 'intl-admin',
      prefix: '/api/v1/intl-admin',
      getAuthenticate: () => [],
      getUserModel: () => ({ name: 'MockUser' }),
      generateTargets: null,
      ...pluginOptions
    };

    app.decorate(options.name, {
      options,
      models: {
        langType: langTypeModel,
        langLib: langLibModel
      },
      services: {},
      controllers: {}
    });

    const langTypeService = require('../../libs/services/lang-type');
    const langLibService = require('../../libs/services/lang-lib');
    await langTypeService(app, options);
    await langLibService(app, options);

    return app;
  };

  const reset = () => {
    langTypeData = [];
    langLibData = [];
    langTypeIdCounter = 1;
    langLibIdCounter = 1;
  };

  const restore = () => {
    sinon.restore();
  };

  return { createFastify, reset, restore };
};

module.exports = { createTestContext };
