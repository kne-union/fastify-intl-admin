const DEFAULT_NAMESPACE = 'global';

/**
 * 解析 .i18n 文件名。
 * - `namespace.locale.i18n` → { namespace, locale }
 * - `locale.i18n` → { namespace: 'global', locale }
 * @param {string} filename
 * @returns {{ namespace: string, locale: string }}
 */
const parseFilename = filename => {
  const name = String(filename || '')
    .trim()
    .split(/[/\\]/)
    .pop();
  if (!name) {
    throw new Error('文件名不能为空');
  }

  const withNs = name.match(/^(.+)\.([^.]+)\.i18n$/i);
  if (withNs) {
    const namespace = withNs[1].trim();
    const locale = withNs[2].trim();
    if (!namespace || !locale) {
      throw new Error(`无效的 i18n 文件名: ${name}`);
    }
    return { namespace, locale };
  }

  const localeOnly = name.match(/^([^.]+)\.i18n$/i);
  if (localeOnly) {
    const locale = localeOnly[1].trim();
    if (!locale) {
      throw new Error(`无效的 i18n 文件名: ${name}`);
    }
    return { namespace: DEFAULT_NAMESPACE, locale };
  }

  throw new Error(`无效的 i18n 文件名: ${name}`);
};

/**
 * 构建导出文件名：`{namespace}.{locale}.i18n`
 * @param {string} namespace
 * @param {string} locale
 * @returns {string}
 */
const buildFilename = (namespace, locale) => `${namespace}.${locale}.i18n`;

const escapeTarget = target =>
  String(target == null ? '' : target)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');

const unescapeTarget = target => String(target == null ? '' : target).replace(/\\(.)/g, (_, ch) => ch);

/**
 * 解析正文：每行 `code="target"`；空行忽略；目标值支持 `\"` / `\\` 转义。
 * @param {string} content
 * @returns {Array<{ code: string, target: string }>}
 */
const parseContent = content => {
  const text = String(content == null ? '' : content);
  const entries = [];
  const linePattern = /^(.+?)="((?:\\.|[^"\\])*)"$/;

  text.split(/\r?\n/).forEach(line => {
    const raw = line.trim();
    if (!raw) {
      return;
    }
    const matched = raw.match(linePattern);
    if (!matched) {
      throw new Error(`无效的词条行: ${raw}`);
    }
    const code = matched[1].trim();
    if (!code) {
      throw new Error(`无效的词条行: ${raw}`);
    }
    entries.push({
      code,
      target: unescapeTarget(matched[2])
    });
  });
  return entries;
};

/**
 * 将词条列表序列化为正文：`code="target"`
 * @param {Array<{ code: string, target?: string }>} entries
 * @returns {string}
 */
const buildContent = (entries = []) => entries.map(item => `${item.code}="${escapeTarget(item.target)}"`).join('\n');

/**
 * 按 namespace+locale 分组为导出文件列表。
 * @param {Array<{ namespace: string, locale: string, code: string, target?: string }>} rows
 * @returns {Array<{ filename: string, content: string }>}
 */
const groupRowsToFiles = (rows = []) => {
  const groups = new Map();
  rows.forEach(row => {
    const namespace = row.namespace;
    const locale = row.locale;
    if (!namespace || !locale) {
      return;
    }
    const key = `${namespace}\0${locale}`;
    if (!groups.has(key)) {
      groups.set(key, {
        namespace,
        locale,
        entries: []
      });
    }
    groups.get(key).entries.push({
      code: row.code,
      target: row.target == null ? '' : row.target
    });
  });

  return Array.from(groups.values()).map(({ namespace, locale, entries }) => ({
    filename: buildFilename(namespace, locale),
    content: buildContent(entries)
  }));
};

module.exports = {
  DEFAULT_NAMESPACE,
  parseFilename,
  buildFilename,
  parseContent,
  buildContent,
  groupRowsToFiles
};
