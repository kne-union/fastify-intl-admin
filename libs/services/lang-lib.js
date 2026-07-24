const fp = require('fastify-plugin');
const omit = require('lodash/omit');
const { normalizeListQuery, normalizeIds } = require('../utils/list-query');
const { parseFilename, parseContent, groupRowsToFiles } = require('../utils/i18n-file');

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
    const record = await models.langLib.findByPk(id);
    if (!record) {
      throw httpErrors.notFound('语言词条不存在');
    }
    return record;
  };

  const assertOpenLocales = async locales => {
    const langTypes = await models.langType.findAll({
      where: {
        code: { [Op.in]: locales },
        status: 'open'
      }
    });
    const openCodes = new Set(langTypes.map(item => item.code));
    const invalid = locales.filter(code => !openCodes.has(code));
    if (invalid.length > 0) {
      throw httpErrors.badRequest(`以下语言未启用或不存在: ${invalid.join(', ')}`);
    }
  };

  const getDefaultLocaleCode = async () => {
    const record = await models.langType.findOne({ where: { isDefault: true } });
    return record ? record.code : '';
  };

  const attachSourceTargets = async rows => {
    const list = Array.isArray(rows) ? rows : [];
    if (list.length === 0) {
      return [];
    }
    const defaultLocale = await getDefaultLocaleCode();
    const toJson = row => (typeof row.toJSON === 'function' ? row.toJSON() : Object.assign({}, row));

    if (!defaultLocale) {
      return list.map(row => Object.assign(toJson(row), { sourceTarget: '', defaultLocale: '' }));
    }

    const keyMap = new Map();
    list.forEach(row => {
      const namespace = row.namespace;
      const code = row.code;
      if (!namespace || !code) {
        return;
      }
      const key = `${namespace}::${code}`;
      if (!keyMap.has(key)) {
        keyMap.set(key, { namespace, code });
      }
    });

    const sourceMap = new Map();
    const pairs = Array.from(keyMap.values());
    if (pairs.length > 0) {
      const namespaces = [...new Set(pairs.map(item => item.namespace))];
      const codes = [...new Set(pairs.map(item => item.code))];
      // 用 in 查询再按 namespace+code 精确匹配，避免 Op.or 复合条件在部分环境下不生效
      const sources = await models.langLib.findAll({
        where: {
          locale: defaultLocale,
          namespace: { [Op.in]: namespaces },
          code: { [Op.in]: codes }
        },
        attributes: ['namespace', 'code', 'target']
      });
      sources.forEach(item => {
        const key = `${item.namespace}::${item.code}`;
        if (keyMap.has(key)) {
          sourceMap.set(key, item.target != null ? String(item.target) : '');
        }
      });
    }

    return list.map(row => {
      const json = toJson(row);
      const key = `${json.namespace}::${json.code}`;
      const sourceTarget = json.locale === defaultLocale ? (json.target != null ? String(json.target) : '') : sourceMap.get(key) || '';
      return Object.assign(json, { sourceTarget, defaultLocale });
    });
  };

  const list = async (authenticatePayload, query) => {
    const { filter, perPage, currentPage } = normalizeListQuery(query);
    const where = {};
    if (filter.locale) {
      where.locale = filter.locale;
    }
    if (filter.reviewStatus) {
      where.reviewStatus = filter.reviewStatus;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.namespace) {
      where.namespace = filter.namespace;
    }
    if (filter.code) {
      where.code = filter.code;
    }
    if (filter.keyword) {
      const keyword = `%${filter.keyword}%`;
      where[Op.or] = [{ namespace: { [Op.iLike]: keyword } }, { code: { [Op.iLike]: keyword } }, { target: { [Op.iLike]: keyword } }];
    }
    const { rows, count } = await models.langLib.findAndCountAll({
      where,
      include: [createdUserInclude()],
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [
        ['namespace', 'ASC'],
        ['code', 'ASC'],
        ['locale', 'ASC']
      ]
    });
    return {
      pageData: await attachSourceTargets(rows),
      totalCount: count
    };
  };

  const namespaces = async () => {
    const rows = await models.langLib.findAll({
      attributes: ['namespace'],
      order: [['namespace', 'ASC']]
    });
    const seen = new Set();
    const pageData = [];
    for (const item of rows) {
      const namespace = item.namespace;
      if (!namespace || seen.has(namespace)) {
        continue;
      }
      seen.add(namespace);
      pageData.push({ namespace });
    }
    pageData.sort((a, b) => {
      if (a.namespace === 'global') {
        return -1;
      }
      if (b.namespace === 'global') {
        return 1;
      }
      return String(a.namespace).localeCompare(String(b.namespace));
    });
    return {
      pageData,
      totalCount: pageData.length
    };
  };

  const addPackage = async (authenticatePayload, body) => {
    const namespace = String(body.namespace || '').trim();
    const code = String(body.code || '').trim();
    const locales = Array.isArray(body.locales) ? body.locales.map(item => String(item).trim()).filter(Boolean) : [];
    const aiGenerate = !!body.aiGenerate;
    const targets = body.targets || {};
    const sourceTarget = body.sourceTarget != null ? String(body.sourceTarget) : '';
    const defaultLocale = (body.defaultLocale ? String(body.defaultLocale).trim() : '') || (await getDefaultLocaleCode());

    if (!namespace) {
      throw httpErrors.badRequest('命名空间不能为空');
    }
    if (!code) {
      throw httpErrors.badRequest('词条编码不能为空');
    }
    if (locales.length === 0) {
      throw httpErrors.badRequest('至少选择一种语言');
    }
    if (aiGenerate && !sourceTarget.trim()) {
      throw httpErrors.badRequest('AI 生成时默认值不能为空');
    }

    await assertOpenLocales(locales);

    const existing = await models.langLib.findAll({
      where: {
        namespace,
        code,
        locale: { [Op.in]: locales }
      }
    });
    if (existing.length > 0) {
      const existsLocales = existing.map(item => item.locale).join(', ');
      throw httpErrors.badRequest(`以下语言词条已存在: ${existsLocales}`);
    }

    let resolvedTargets = Object.assign({}, targets);
    if (aiGenerate) {
      const aiLocales = defaultLocale ? locales.filter(item => item !== defaultLocale) : locales;
      // 仅默认语言：直接写入，不走 AI
      if (aiLocales.length === 0) {
        resolvedTargets = {};
        locales.forEach(locale => {
          resolvedTargets[locale] = sourceTarget;
        });
      } else {
        if (typeof options.generateTargets !== 'function') {
          throw httpErrors.badRequest('未配置 generateTargets，无法使用 AI 生成');
        }
        const generated =
          (await options.generateTargets({
            namespace,
            code,
            locales: aiLocales,
            sourceTarget,
            defaultLocale
          })) || {};
        resolvedTargets = Object.assign({}, generated);
        if (defaultLocale && locales.includes(defaultLocale)) {
          resolvedTargets[defaultLocale] = sourceTarget;
        }
      }
    }

    const userId = authenticatePayload && authenticatePayload.id;
    const rows = locales.map(locale => {
      // 默认语言词条（含 AI 源文）直接通过，无需审核
      const isDefaultLocale = !!(defaultLocale && locale === defaultLocale);
      const onlyDefaultLocales = aiGenerate && defaultLocale && locales.every(item => item === defaultLocale);
      return {
        namespace,
        code,
        locale,
        target: resolvedTargets[locale] != null ? String(resolvedTargets[locale]) : '',
        reviewStatus: aiGenerate && !isDefaultLocale && !onlyDefaultLocales ? 'pending' : 'approved',
        reviewRemark: null,
        status: 'open',
        userId
      };
    });

    if (typeof models.langLib.bulkCreate === 'function') {
      return models.langLib.bulkCreate(rows);
    }
    const created = [];
    for (const row of rows) {
      created.push(await models.langLib.create(row));
    }
    return created;
  };

  const save = async (authenticatePayload, { id, ...data }) => {
    const record = await detail(authenticatePayload, { id });
    const payload = omit(data, ['namespace', 'code', 'locale', 'createdAt', 'updatedAt', 'id', 'reviewStatus', 'reviewRemark']);
    if (Object.prototype.hasOwnProperty.call(data, 'target') && data.target !== record.target) {
      payload.target = data.target;
      const defaultLocale = await getDefaultLocaleCode();
      // 默认语言改文无需审核，直接通过；其他语言改文重置为待审
      if (defaultLocale && record.locale === defaultLocale) {
        payload.reviewStatus = 'approved';
        payload.reviewRemark = null;
      } else {
        payload.reviewStatus = 'pending';
        payload.reviewRemark = null;
      }
    }
    await record.update(payload);
    return record;
  };

  const remove = async (authenticatePayload, body) => {
    const ids = normalizeIds(body);
    if (ids.length === 0) {
      throw httpErrors.badRequest('请指定要删除的词条');
    }
    const records = await models.langLib.findAll({
      where: { id: { [Op.in]: ids } }
    });
    if (records.length === 0) {
      throw httpErrors.notFound('语言词条不存在');
    }
    for (const record of records) {
      await record.destroy();
    }
  };

  const setStatus = async (authenticatePayload, body) => {
    const ids = normalizeIds(body);
    if (ids.length === 0) {
      throw httpErrors.badRequest('请指定要更新的词条');
    }
    if (!['open', 'closed'].includes(body.status)) {
      throw httpErrors.badRequest('状态不合法');
    }
    const records = await models.langLib.findAll({
      where: { id: { [Op.in]: ids } }
    });
    if (records.length === 0) {
      throw httpErrors.notFound('语言词条不存在');
    }
    for (const record of records) {
      await record.update({ status: body.status });
    }
  };

  const review = async (authenticatePayload, body) => {
    const ids = normalizeIds(body);
    if (ids.length === 0) {
      throw httpErrors.badRequest('请指定要审核的词条');
    }
    if (!['approved', 'rejected'].includes(body.reviewStatus)) {
      throw httpErrors.badRequest('审核状态不合法');
    }
    const records = await models.langLib.findAll({
      where: { id: { [Op.in]: ids } }
    });
    if (records.length === 0) {
      throw httpErrors.notFound('语言词条不存在');
    }
    for (const record of records) {
      await record.update({
        reviewStatus: body.reviewStatus,
        reviewRemark: body.reviewRemark != null ? String(body.reviewRemark) : record.reviewRemark
      });
    }
  };

  const regenerate = async (authenticatePayload, body) => {
    const ids = normalizeIds(body);
    if (ids.length === 0) {
      throw httpErrors.badRequest('请指定要重新生成的词条');
    }
    if (typeof options.generateTargets !== 'function') {
      throw httpErrors.badRequest('未配置 generateTargets，无法重新生成');
    }

    const records = await models.langLib.findAll({
      where: { id: { [Op.in]: ids } }
    });
    if (records.length === 0) {
      throw httpErrors.notFound('语言词条不存在');
    }

    const regeneratableRecords = records.filter(item => item.reviewStatus === 'pending' || item.reviewStatus === 'approved');
    if (regeneratableRecords.length === 0) {
      throw httpErrors.badRequest('仅待审核或已通过词条支持重新生成');
    }

    const defaultLocale = await getDefaultLocaleCode();
    if (!defaultLocale) {
      throw httpErrors.badRequest('未设置默认语言，无法重新生成');
    }

    const groups = new Map();
    for (const record of regeneratableRecords) {
      if (record.locale === defaultLocale) {
        throw httpErrors.badRequest('默认语言词条不支持重新生成');
      }
      const key = `${record.namespace}::${record.code}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(record);
    }

    for (const groupRecords of groups.values()) {
      const { namespace, code } = groupRecords[0];
      const source = await models.langLib.findOne({
        where: { namespace, code, locale: defaultLocale }
      });
      const sourceTarget = source && source.target != null ? String(source.target) : '';
      if (!sourceTarget.trim()) {
        throw httpErrors.badRequest(`缺少默认语言源文案: ${namespace}/${code}`);
      }

      const locales = groupRecords.map(item => item.locale);
      const generated =
        (await options.generateTargets({
          namespace,
          code,
          locales,
          sourceTarget,
          defaultLocale
        })) || {};

      for (const record of groupRecords) {
        await record.update({
          target: generated[record.locale] != null ? String(generated[record.locale]) : '',
          reviewStatus: 'pending',
          reviewRemark: null
        });
      }
    }
  };

  const copyToNamespace = async (authenticatePayload, body) => {
    const ids = normalizeIds(body);
    const namespace = String(body.namespace || '').trim();
    if (!namespace) {
      throw httpErrors.badRequest('目标命名空间不能为空');
    }
    if (ids.length === 0) {
      throw httpErrors.badRequest('请指定要复制的词条');
    }

    const records = await models.langLib.findAll({
      where: { id: { [Op.in]: ids } }
    });
    if (records.length === 0) {
      throw httpErrors.notFound('语言词条不存在');
    }

    const userId = authenticatePayload && authenticatePayload.id;
    const candidates = records.filter(item => item.namespace !== namespace);
    if (candidates.length === 0) {
      throw httpErrors.badRequest('目标命名空间与源命名空间相同，无需复制');
    }

    const existing = await models.langLib.findAll({
      where: {
        namespace,
        code: { [Op.in]: [...new Set(candidates.map(item => item.code))] }
      }
    });
    const existingKeys = new Set(existing.map(item => `${item.code}::${item.locale}`));

    const rows = [];
    let skippedCount = records.length - candidates.length;
    for (const item of candidates) {
      const key = `${item.code}::${item.locale}`;
      if (existingKeys.has(key)) {
        skippedCount += 1;
        continue;
      }
      rows.push({
        namespace,
        code: item.code,
        locale: item.locale,
        target: item.target,
        reviewStatus: item.reviewStatus,
        reviewRemark: item.reviewRemark,
        status: item.status,
        userId
      });
      existingKeys.add(key);
    }

    if (rows.length === 0) {
      throw httpErrors.badRequest('目标命名空间下词条已存在，没有可复制项');
    }

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
      skippedCount
    };
  };

  /**
   * 运行时语言包：返回扁平 { [code]: target }，供 @kne/react-intl Fetch 直接使用。
   * 仅包含开启且审核通过的词条。
   */
  const messages = async (authenticatePayload, query = {}) => {
    const locale = query.locale != null ? String(query.locale).trim() : '';
    const namespace = query.namespace != null ? String(query.namespace).trim() : 'global';
    if (!locale) {
      throw httpErrors.badRequest('locale 不能为空');
    }
    if (!namespace) {
      throw httpErrors.badRequest('namespace 不能为空');
    }
    const rows = await models.langLib.findAll({
      where: {
        locale,
        namespace,
        status: 'open',
        reviewStatus: 'approved'
      },
      attributes: ['code', 'target'],
      order: [['code', 'ASC']]
    });
    const result = {};
    for (const row of rows) {
      if (row.code == null || row.code === '') {
        continue;
      }
      result[row.code] = row.target != null ? String(row.target) : '';
    }
    return result;
  };

  const exportI18n = async (authenticatePayload, query = {}) => {
    const namespace = query.namespace != null ? String(query.namespace).trim() : '';
    const where = {};
    if (namespace) {
      where.namespace = namespace;
    }
    const rows = await models.langLib.findAll({
      where,
      order: [
        ['namespace', 'ASC'],
        ['locale', 'ASC'],
        ['code', 'ASC']
      ]
    });
    return {
      pageData: groupRowsToFiles(rows)
    };
  };

  const importOneFile = async (authenticatePayload, { filename, content }) => {
    let namespace;
    let locale;
    let entries;
    try {
      ({ namespace, locale } = parseFilename(filename));
      entries = parseContent(content);
    } catch (e) {
      throw httpErrors.badRequest(e.message || 'i18n 文件解析失败');
    }

    const userId = authenticatePayload && authenticatePayload.id;
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const { code, target } of entries) {
      const existing = await models.langLib.findOne({
        where: { namespace, locale, code }
      });
      if (existing) {
        await existing.update({
          target,
          status: 'open',
          reviewStatus: 'approved',
          reviewRemark: null
        });
        updatedCount += 1;
      } else {
        await models.langLib.create({
          namespace,
          code,
          locale,
          target,
          status: 'open',
          reviewStatus: 'approved',
          reviewRemark: null,
          userId
        });
        createdCount += 1;
      }
    }

    return {
      filename,
      namespace,
      locale,
      createdCount,
      updatedCount,
      skippedCount
    };
  };

  const importI18n = async (authenticatePayload, body = {}) => {
    const files = Array.isArray(body.files) && body.files.length > 0 ? body.files : body.filename != null ? [{ filename: body.filename, content: body.content }] : [];

    if (files.length === 0) {
      throw httpErrors.badRequest('请上传至少一个 i18n 文件');
    }

    const results = [];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      const result = await importOneFile(authenticatePayload, file);
      results.push(result);
      createdCount += result.createdCount;
      updatedCount += result.updatedCount;
      skippedCount += result.skippedCount;
    }

    return {
      createdCount,
      updatedCount,
      skippedCount,
      pageData: results
    };
  };

  Object.assign(fastify[options.name].services, {
    langLib: {
      list,
      namespaces,
      detail,
      addPackage,
      save,
      remove,
      setStatus,
      review,
      regenerate,
      copyToNamespace,
      messages,
      exportI18n,
      importI18n
    }
  });
});
