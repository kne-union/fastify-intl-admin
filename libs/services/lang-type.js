const fp = require('fastify-plugin');
const omit = require('lodash/omit');
const { normalizeListQuery } = require('../utils/list-query');

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;
  const { ensureHttpErrors } = require('../utils/http-errors');
  const httpErrors = ensureHttpErrors(fastify);

  const createdUserInclude = () => ({
    model: options.getUserModel(),
    as: 'createdUser'
  });

  const detail = async (authenticatePayload, { id }) => {
    const record = await models.langType.findByPk(id);
    if (!record) {
      throw httpErrors.notFound('语言类型不存在');
    }
    return record;
  };

  const clearDefaultFlags = async excludeId => {
    const defaults = await models.langType.findAll({
      where: Object.assign({ isDefault: true }, excludeId != null ? { id: { [Op.ne]: excludeId } } : {})
    });
    for (const item of defaults) {
      await item.update({ isDefault: false });
    }
  };

  const create = async (authenticatePayload, data) => {
    const code = String(data.code || '').trim();
    if (!code) {
      throw httpErrors.badRequest('语言编码不能为空');
    }
    const existing = await models.langType.findOne({ where: { code } });
    if (existing) {
      throw httpErrors.badRequest('语言编码已存在');
    }
    const count = await models.langType.count();
    // 第一条自动设为默认
    const isDefault = count === 0;
    // 新建默认排到最后
    const last = await models.langType.findOne({
      order: [
        ['sort', 'DESC'],
        ['id', 'DESC']
      ],
      attributes: ['sort']
    });
    const sort = last == null ? 0 : (Number(last.sort) || 0) + 1;
    return models.langType.create({
      name: data.name,
      code,
      params: data.params,
      description: data.description,
      status: data.status || 'open',
      sort,
      isDefault,
      userId: authenticatePayload && authenticatePayload.id
    });
  };

  const save = async (authenticatePayload, { id, ...data }) => {
    const record = await detail(authenticatePayload, { id });
    const payload = omit(data, ['code', 'createdAt', 'updatedAt', 'id', 'isDefault', 'sort']);
    await record.update(payload);
    return record;
  };

  const remove = async (authenticatePayload, { id }) => {
    const record = await detail(authenticatePayload, { id });
    const relatedCount = await models.langLib.count({
      where: { locale: record.code }
    });
    if (relatedCount > 0) {
      throw httpErrors.badRequest('该语言类型仍有关联词条，无法删除');
    }
    const wasDefault = !!record.isDefault;
    await record.destroy();
    if (wasDefault) {
      const next = await models.langType.findOne({
        order: [['createdAt', 'ASC']]
      });
      if (next) {
        await next.update({ isDefault: true });
      }
    }
  };

  const setStatus = async (authenticatePayload, { id, status }) => {
    const record = await detail(authenticatePayload, { id });
    await record.update({ status });
  };

  const setDefault = async (authenticatePayload, { id }) => {
    const record = await detail(authenticatePayload, { id });
    if (record.isDefault) {
      return;
    }
    await clearDefaultFlags(record.id);
    await record.update({ isDefault: true });
  };

  const listOrder = [
    ['sort', 'ASC'],
    ['createdAt', 'ASC'],
    ['id', 'ASC']
  ];

  /** direction: 'up' | 'down'，与相邻项交换 sort */
  const move = async (authenticatePayload, { id, direction }) => {
    const dir = String(direction || '').toLowerCase();
    if (dir !== 'up' && dir !== 'down') {
      throw httpErrors.badRequest('direction 必须为 up 或 down');
    }
    const record = await detail(authenticatePayload, { id });
    const rows = await models.langType.findAll({
      order: listOrder,
      attributes: ['id', 'sort']
    });
    const index = rows.findIndex(item => String(item.id) === String(record.id));
    if (index < 0) {
      throw httpErrors.notFound('语言类型不存在');
    }
    const targetIndex = dir === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) {
      return { moved: false };
    }
    const neighbor = rows[targetIndex];
    const currentSort = Number(record.sort) || 0;
    const neighborSort = Number(neighbor.sort) || 0;
    if (currentSort === neighborSort) {
      await record.update({ sort: targetIndex });
      await neighbor.update({ sort: index });
    } else {
      await record.update({ sort: neighborSort });
      await neighbor.update({ sort: currentSort });
    }
    return { moved: true };
  };

  const getDefaultLocaleCode = async () => {
    const record = await models.langType.findOne({ where: { isDefault: true } });
    return record ? record.code : '';
  };

  const translateRemaining = async (authenticatePayload, { id, namespace, limit }) => {
    const targetLang = await detail(authenticatePayload, { id });
    if (targetLang.status !== 'open') {
      throw httpErrors.badRequest('目标语言未启用，无法补译');
    }
    if (targetLang.isDefault) {
      throw httpErrors.badRequest('默认语言无需补译');
    }

    const defaultLocale = await getDefaultLocaleCode();
    if (!defaultLocale) {
      throw httpErrors.badRequest('未设置默认语言，无法补译');
    }
    if (targetLang.code === defaultLocale) {
      throw httpErrors.badRequest('默认语言无需补译');
    }

    const scopedNamespace = namespace != null ? String(namespace).trim() : '';
    const defaultWhere = { locale: defaultLocale };
    const targetWhere = { locale: targetLang.code };
    if (scopedNamespace) {
      defaultWhere.namespace = scopedNamespace;
      targetWhere.namespace = scopedNamespace;
    }

    const defaultEntries = await models.langLib.findAll({
      where: defaultWhere
    });
    if (defaultEntries.length === 0) {
      throw httpErrors.badRequest(scopedNamespace ? `命名空间 ${scopedNamespace} 下默认语言暂无词条，无法补译` : '默认语言暂无词条，无法补译');
    }

    const existingTarget = await models.langLib.findAll({
      where: targetWhere,
      attributes: ['namespace', 'code']
    });
    const existingKeys = new Set(existingTarget.map(item => `${item.namespace}::${item.code}`));
    const missingEntries = defaultEntries.filter(item => !existingKeys.has(`${item.namespace}::${item.code}`));
    if (missingEntries.length === 0) {
      throw httpErrors.badRequest(scopedNamespace ? `命名空间 ${scopedNamespace} 下该语言词条已全部翻译完成` : '该语言词条已全部翻译完成');
    }

    const userId = authenticatePayload && authenticatePayload.id;
    const GLOBAL_NS = 'global';
    const batchLimit = limit != null && Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.floor(Number(limit)) : null;

    // 非 global 命名空间：优先从 global 同 code + 目标语言拉取
    const needGlobalLookup = missingEntries.some(item => item.namespace !== GLOBAL_NS);
    const globalTargetByCode = new Map();
    if (needGlobalLookup) {
      const codes = [...new Set(missingEntries.filter(item => item.namespace !== GLOBAL_NS).map(item => item.code))];
      if (codes.length > 0) {
        const globalTargets = await models.langLib.findAll({
          where: {
            namespace: GLOBAL_NS,
            locale: targetLang.code,
            code: { [Op.in]: codes }
          }
        });
        globalTargets.forEach(item => {
          const target = item.target != null ? String(item.target) : '';
          if (target.trim()) {
            globalTargetByCode.set(item.code, target);
          }
        });
      }
    }

    const processable = [];
    for (const source of missingEntries) {
      const sourceTarget = source.target != null ? String(source.target) : '';
      if (!sourceTarget.trim()) {
        continue;
      }
      processable.push(source);
    }

    if (processable.length === 0) {
      throw httpErrors.badRequest('没有可补译的默认语言源文案');
    }

    const batchSources = batchLimit ? processable.slice(0, batchLimit) : processable;
    const remainingCount = processable.length - batchSources.length;

    const copiedRows = [];
    const llmSources = [];
    const texts = {};

    for (const source of batchSources) {
      const sourceTarget = String(source.target);
      const key = `${source.namespace}::${source.code}`;

      if (source.namespace !== GLOBAL_NS && globalTargetByCode.has(source.code)) {
        copiedRows.push({
          namespace: source.namespace,
          code: source.code,
          locale: targetLang.code,
          target: globalTargetByCode.get(source.code),
          reviewStatus: 'approved',
          reviewRemark: null,
          status: 'open',
          userId
        });
        continue;
      }

      texts[key] = sourceTarget;
      llmSources.push({
        key,
        namespace: source.namespace,
        code: source.code
      });
    }

    const llmRows = [];
    if (llmSources.length > 0) {
      if (typeof options.generateTargets !== 'function') {
        throw httpErrors.badRequest('未配置 generateTargets，无法补译');
      }
      const generated =
        (await options.generateTargets({
          locales: [targetLang.code],
          defaultLocale,
          texts
        })) || {};
      const translatedMap = generated[targetLang.code] && typeof generated[targetLang.code] === 'object' ? generated[targetLang.code] : {};

      llmSources.forEach(item => {
        llmRows.push({
          namespace: item.namespace,
          code: item.code,
          locale: targetLang.code,
          target: translatedMap[item.key] != null ? String(translatedMap[item.key]) : '',
          reviewStatus: 'pending',
          reviewRemark: null,
          status: 'open',
          userId
        });
      });
    }

    const rows = copiedRows.concat(llmRows);

    let created;
    if (typeof models.langLib.bulkCreate === 'function') {
      created = await models.langLib.bulkCreate(rows);
    } else {
      created = [];
      for (const row of rows) {
        created.push(await models.langLib.create(row));
      }
    }

    return {
      createdCount: created.length,
      copiedCount: copiedRows.length,
      generatedCount: llmRows.length,
      remainingCount,
      remainingSkipped: missingEntries.length - processable.length,
      totalProcessable: processable.length
    };
  };

  const list = async (authenticatePayload, query) => {
    const { filter, perPage, currentPage } = normalizeListQuery(query);
    const where = {};
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.isDefault === true || filter.isDefault === 'true') {
      where.isDefault = true;
    }
    if (filter.isDefault === false || filter.isDefault === 'false') {
      where.isDefault = false;
    }
    if (filter.keyword) {
      const keyword = `%${filter.keyword}%`;
      where[Op.or] = [{ name: { [Op.iLike]: keyword } }, { code: { [Op.iLike]: keyword } }, { description: { [Op.iLike]: keyword } }];
    }
    const { rows, count } = await models.langType.findAndCountAll({
      where,
      include: [createdUserInclude()],
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: listOrder
    });

    const localeWhere = {};
    if (filter.namespace) {
      localeWhere.namespace = filter.namespace;
    }
    const localeRows = await models.langLib.findAll({
      where: localeWhere,
      attributes: ['locale']
    });
    const entryCountByLocale = {};
    for (const item of localeRows) {
      const locale = item.locale;
      entryCountByLocale[locale] = (entryCountByLocale[locale] || 0) + 1;
    }
    const defaultLang = rows.find(item => item.isDefault) || (await models.langType.findOne({ where: { isDefault: true } }));
    const defaultLocale = defaultLang ? defaultLang.code : '';
    const defaultEntryCount = defaultLocale ? entryCountByLocale[defaultLocale] || 0 : 0;

    const pageData = rows.map(row => {
      const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
      return Object.assign(json, {
        entryCount: entryCountByLocale[row.code] || 0,
        defaultEntryCount
      });
    });

    return {
      pageData,
      totalCount: count
    };
  };

  Object.assign(fastify[options.name].services, {
    langType: {
      create,
      detail,
      save,
      remove,
      setStatus,
      setDefault,
      move,
      translateRemaining,
      list
    }
  });
});
