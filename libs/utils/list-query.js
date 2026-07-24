const FLAT_FILTER_KEYS = ['keyword', 'locale', 'reviewStatus', 'status', 'code', 'namespace', 'isDefault'];

/**
 * 归一化列表查询：兼容顶层 flat 字段与 filter 对象。
 * @param {object} query
 * @returns {{ filter: object, perPage: number, currentPage: number }}
 */
const normalizeListQuery = (query = {}) => {
  const filter = Object.assign({}, query.filter || {});
  FLAT_FILTER_KEYS.forEach(key => {
    if (query[key] !== undefined && query[key] !== null && query[key] !== '' && filter[key] === undefined) {
      filter[key] = query[key];
    }
  });
  const perPage = Number(query.perPage) > 0 ? Number(query.perPage) : 20;
  const currentPage = Number(query.currentPage) > 0 ? Number(query.currentPage) : 1;
  return { filter, perPage, currentPage };
};

/**
 * 将 body 中的 id / ids 归一为 id 数组。
 * @param {{ id?: string|number, ids?: Array<string|number> }} body
 * @returns {Array<string|number>}
 */
const normalizeIds = ({ id, ids } = {}) => {
  if (Array.isArray(ids) && ids.length > 0) {
    return ids;
  }
  if (id !== undefined && id !== null && id !== '') {
    return [id];
  }
  return [];
};

/**
 * 从可能为对象的 locale 字段取出语言 code。
 * @param {string|{id?: string, value?: string, name?: string}|null} locale
 * @returns {string|null}
 */
const normalizeLocaleValue = locale => {
  if (locale == null) {
    return null;
  }
  if (typeof locale === 'string') {
    return locale;
  }
  if (typeof locale === 'object') {
    return locale.value || locale.id || locale.name || null;
  }
  return String(locale);
};

module.exports = {
  normalizeListQuery,
  normalizeIds,
  normalizeLocaleValue,
  FLAT_FILTER_KEYS
};
