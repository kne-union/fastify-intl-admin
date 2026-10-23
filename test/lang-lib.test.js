const { expect } = require('chai');
const { createTestContext } = require('./helpers/context');

describe('@kne/fastify-intl-admin - langLib', function () {
  this.timeout(10000);

  const context = createTestContext();
  let fastify;

  const createFastify = async options => {
    fastify = await context.createFastify(options);
    return fastify;
  };

  const seedLangTypes = async services => {
    await services.langType.create({}, { name: '中文', code: 'zh-CN' });
    await services.langType.create({}, { name: 'English', code: 'en-US' });
    await services.langType.create({}, { name: '日本語', code: 'ja-JP', status: 'closed' });
  };

  beforeEach(() => {
    context.reset();
  });

  afterEach(async () => {
    if (fastify) {
      await fastify.close();
      fastify = null;
    }
    context.restore();
  });

  describe('addPackage', () => {
    it('should create manual entries as approved', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好', 'en-US': 'Hello' }
        }
      );

      expect(rows).to.have.length(2);
      expect(rows.every(item => item.reviewStatus === 'approved')).to.equal(true);
      expect(rows.find(item => item.locale === 'zh-CN').target).to.equal('你好');
    });

    it('should set userId from authenticatePayload as created user', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        { id: 'user-2' },
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好' }
        }
      );

      expect(rows).to.have.length(1);
      expect(rows[0].userId).to.equal('user-2');
    });

    it('should create ai entries as pending when generateTargets is configured', async () => {
      fastify = await createFastify({
        generateTargets: async ({ locales, sourceTarget }) => {
          const result = {};
          locales.forEach(locale => {
            result[locale] = `AI-${locale}-${sourceTarget}`;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Welcome',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: true,
          sourceTarget: '你好',
          defaultLocale: 'zh-CN'
        }
      );

      expect(rows).to.have.length(2);
      const zh = rows.find(item => item.locale === 'zh-CN');
      const en = rows.find(item => item.locale === 'en-US');
      expect(zh.reviewStatus).to.equal('approved');
      expect(zh.target).to.equal('你好');
      expect(en.reviewStatus).to.equal('pending');
      expect(en.target).to.equal('AI-en-US-你好');
    });

    it('should approve default locale from langType when defaultLocale omitted', async () => {
      fastify = await createFastify({
        generateTargets: async ({ locales, sourceTarget }) => {
          const result = {};
          locales.forEach(locale => {
            result[locale] = `AI-${locale}-${sourceTarget}`;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Welcome2',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: true,
          sourceTarget: '你好'
        }
      );

      const zh = rows.find(item => item.locale === 'zh-CN');
      const en = rows.find(item => item.locale === 'en-US');
      expect(zh.reviewStatus).to.equal('approved');
      expect(zh.target).to.equal('你好');
      expect(en.reviewStatus).to.equal('pending');
    });

    it('should add default locale directly without AI when only default language selected', async () => {
      let generateCalled = false;
      fastify = await createFastify({
        generateTargets: async () => {
          generateCalled = true;
          return {};
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'OnlyZh',
          locales: ['zh-CN'],
          aiGenerate: true,
          sourceTarget: '仅中文',
          defaultLocale: 'zh-CN'
        }
      );

      expect(generateCalled).to.equal(false);
      expect(rows).to.have.length(1);
      expect(rows[0].target).to.equal('仅中文');
      expect(rows[0].reviewStatus).to.equal('approved');
    });

    it('should reject aiGenerate when sourceTarget is empty', async () => {
      fastify = await createFastify({
        generateTargets: async () => ({})
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      try {
        await services.langLib.addPackage(
          {},
          {
            namespace: 'global',
            code: 'Welcome',
            locales: ['en-US'],
            aiGenerate: true,
            sourceTarget: '',
            defaultLocale: 'zh-CN'
          }
        );
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(400);
        expect(e.message).to.include('默认值');
      }
    });

    it('should reject aiGenerate when generateTargets is missing', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      try {
        await services.langLib.addPackage(
          {},
          {
            namespace: 'global',
            code: 'Welcome',
            locales: ['zh-CN', 'en-US'],
            aiGenerate: true,
            sourceTarget: '你好',
            defaultLocale: 'zh-CN'
          }
        );
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(400);
        expect(e.message).to.include('generateTargets');
      }
    });

    it('should reject closed or missing locale', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      try {
        await services.langLib.addPackage(
          {},
          {
            namespace: 'global',
            code: 'Hello',
            locales: ['ja-JP'],
            aiGenerate: false,
            targets: { 'ja-JP': 'こんにちは' }
          }
        );
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(400);
        expect(e.message).to.include('未启用');
      }
    });

    it('should reject duplicate namespace+code+locale', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好' }
        }
      );

      try {
        await services.langLib.addPackage(
          {},
          {
            namespace: 'global',
            code: 'Hello',
            locales: ['zh-CN'],
            aiGenerate: false,
            targets: { 'zh-CN': '你好呀' }
          }
        );
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(400);
        expect(e.message).to.include('已存在');
      }
    });
  });

  describe('list', () => {
    it('should return flat paginated list with filters', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好', 'en-US': 'Hello' }
        }
      );
      await services.langLib.addPackage(
        {},
        {
          namespace: 'admin',
          code: 'Save',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '保存' }
        }
      );

      const all = await services.langLib.list({}, { perPage: 10, currentPage: 1 });
      expect(all.totalCount).to.equal(3);
      expect(all.pageData.every(item => item.locale)).to.equal(true);
      expect(all.pageData.every(item => item.parentId == null)).to.equal(true);

      const byLocale = await services.langLib.list({}, { locale: 'en-US' });
      expect(byLocale.totalCount).to.equal(1);

      const byNamespace = await services.langLib.list({}, { namespace: 'admin' });
      expect(byNamespace.totalCount).to.equal(1);
      expect(byNamespace.pageData[0].code).to.equal('Save');

      const byKeyword = await services.langLib.list({}, { keyword: 'admin' });
      expect(byKeyword.totalCount).to.equal(1);
      expect(byKeyword.pageData[0].namespace).to.equal('admin');

      const namespaceList = await services.langLib.namespaces();
      expect(namespaceList.pageData.map(item => item.namespace)).to.deep.equal(['global', 'admin']);
    });

    it('should attach sourceTarget from default locale for list items', async () => {
      fastify = await createFastify({
        generateTargets: async ({ locales, sourceTarget }) => {
          const result = {};
          locales.forEach(locale => {
            result[locale] = `AI-${locale}-${sourceTarget}`;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: true,
          sourceTarget: '你好'
        }
      );

      const pending = await services.langLib.list({}, { reviewStatus: 'pending', perPage: 20, currentPage: 1 });
      expect(pending.totalCount).to.be.at.least(1);
      const en = pending.pageData.find(item => item.locale === 'en-US' && item.code === 'Hello');
      expect(en).to.exist;
      expect(en.sourceTarget).to.equal('你好');
      expect(en.defaultLocale).to.equal('zh-CN');
      expect(en.target).to.equal('AI-en-US-你好');
    });
  });

  describe('save', () => {
    it('should keep default locale approved when target changes', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const [row] = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好' }
        }
      );
      expect(row.reviewStatus).to.equal('approved');

      await services.langLib.save({}, { id: row.id, target: '您好' });
      const detail = await services.langLib.detail({}, { id: row.id });
      expect(detail.target).to.equal('您好');
      expect(detail.reviewStatus).to.equal('approved');
    });

    it('should reset non-default locale to pending when target changes', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const [row] = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['en-US'],
          aiGenerate: false,
          targets: { 'en-US': 'Hello' }
        }
      );
      expect(row.reviewStatus).to.equal('approved');

      await services.langLib.save({}, { id: row.id, target: 'Hi' });
      const detail = await services.langLib.detail({}, { id: row.id });
      expect(detail.target).to.equal('Hi');
      expect(detail.reviewStatus).to.equal('pending');
    });

    it('POST /lang-lib/save should ignore undeclared fields but save target and status', async () => {
      fastify = await createFastify();
      fastify.register(require('../libs/controllers/lang-lib'), fastify['intl-admin'].options);
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const [row] = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['en-US'],
          aiGenerate: false,
          targets: { 'en-US': 'Hello' }
        }
      );

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/intl-admin/lang-lib/save',
        payload: {
          id: row.id,
          target: 'Hi',
          status: 'closed',
          userId: 'attacker',
          deletedAt: '2000-01-01T00:00:00.000Z',
          reviewStatus: 'approved'
        }
      });
      expect(response.statusCode).to.equal(200);

      const detail = await services.langLib.detail({}, { id: row.id });
      expect(detail.target).to.equal('Hi');
      expect(detail.status).to.equal('closed');
      expect(detail.reviewStatus).to.equal('pending');
      expect(detail.userId).to.not.equal('attacker');
      expect(detail.deletedAt).to.equal(undefined);
    });
  });

  describe('setStatus / remove / review', () => {
    it('should support single and batch setStatus', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好', 'en-US': 'Hello' }
        }
      );

      await services.langLib.setStatus({}, { id: rows[0].id, status: 'closed' });
      expect((await services.langLib.detail({}, { id: rows[0].id })).status).to.equal('closed');

      await services.langLib.setStatus({}, { ids: rows.map(item => item.id), status: 'open' });
      expect((await services.langLib.detail({}, { id: rows[1].id })).status).to.equal('open');
    });

    it('should support single and batch remove', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好', 'en-US': 'Hello' }
        }
      );

      await services.langLib.remove({}, { id: rows[0].id });
      try {
        await services.langLib.detail({}, { id: rows[0].id });
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(404);
      }

      await services.langLib.remove({}, { ids: [rows[1].id] });
      const list = await services.langLib.list({}, {});
      expect(list.totalCount).to.equal(0);
    });

    it('should support single and batch review', async () => {
      fastify = await createFastify({
        generateTargets: async ({ locales }) => {
          const result = {};
          locales.forEach(locale => {
            result[locale] = `AI-${locale}`;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Welcome',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: true,
          sourceTarget: '欢迎',
          defaultLocale: 'zh-CN'
        }
      );

      await services.langLib.review({}, { id: rows[0].id, reviewStatus: 'approved', reviewRemark: 'ok' });
      expect((await services.langLib.detail({}, { id: rows[0].id })).reviewStatus).to.equal('approved');

      await services.langLib.review({}, { ids: [rows[1].id], reviewStatus: 'rejected', reviewRemark: 'bad' });
      expect((await services.langLib.detail({}, { id: rows[1].id })).reviewStatus).to.equal('rejected');
    });

    it('should reject invalid reviewStatus', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const [row] = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好' }
        }
      );

      try {
        await services.langLib.review({}, { id: row.id, reviewStatus: 'pending' });
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(400);
        expect(e.message).to.include('审核状态不合法');
      }
    });

    it('should regenerate pending entry from default locale source', async () => {
      let callCount = 0;
      fastify = await createFastify({
        generateTargets: async ({ locales, sourceTarget }) => {
          callCount += 1;
          const result = {};
          locales.forEach(locale => {
            result[locale] = `Regen-${locale}-${sourceTarget}-${callCount}`;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Delete',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: true,
          sourceTarget: '删除',
          defaultLocale: 'zh-CN'
        }
      );
      const pending = rows.find(item => item.locale === 'en-US');
      expect(pending.reviewStatus).to.equal('pending');

      await services.langLib.regenerate({}, { id: pending.id });
      const updated = await services.langLib.detail({}, { id: pending.id });
      expect(updated.target).to.equal('Regen-en-US-删除-2');
      expect(updated.reviewStatus).to.equal('pending');
      expect(updated.reviewRemark).to.equal(null);
    });

    it('should regenerate approved entry from default locale source', async () => {
      let callCount = 0;
      fastify = await createFastify({
        generateTargets: async ({ locales, sourceTarget }) => {
          callCount += 1;
          const result = {};
          locales.forEach(locale => {
            result[locale] = `RegenApproved-${locale}-${sourceTarget}-${callCount}`;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Save',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: true,
          sourceTarget: '保存',
          defaultLocale: 'zh-CN'
        }
      );
      const pending = rows.find(item => item.locale === 'en-US');
      await services.langLib.review({}, { id: pending.id, reviewStatus: 'approved' });

      await services.langLib.regenerate({}, { id: pending.id });
      const updated = await services.langLib.detail({}, { id: pending.id });
      expect(updated.target).to.equal('RegenApproved-en-US-保存-2');
      expect(updated.reviewStatus).to.equal('pending');
      expect(updated.reviewRemark).to.equal(null);
    });

    it('should reject regenerate for default locale entry', async () => {
      fastify = await createFastify({
        generateTargets: async ({ locales }) => {
          const result = {};
          locales.forEach(locale => {
            result[locale] = `AI-${locale}`;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Delete',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: true,
          sourceTarget: '删除',
          defaultLocale: 'zh-CN'
        }
      );
      const defaultEntry = rows.find(item => item.locale === 'zh-CN');

      try {
        await services.langLib.regenerate({}, { id: defaultEntry.id });
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(400);
        expect(e.message).to.include('默认语言');
      }
    });

    it('should copy entries to a new namespace', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const rows = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好', 'en-US': 'Hello' }
        }
      );

      const result = await services.langLib.copyToNamespace(
        { id: 'user-9' },
        { ids: rows.map(item => item.id), namespace: 'app' }
      );
      expect(result.createdCount).to.equal(2);
      expect(result.skippedCount).to.equal(0);

      const copied = await services.langLib.list({}, { namespace: 'app', perPage: 20, currentPage: 1 });
      expect(copied.totalCount).to.equal(2);
      expect(copied.pageData.every(item => item.userId === 'user-9')).to.equal(true);
      expect(copied.pageData.find(item => item.locale === 'zh-CN').target).to.equal('你好');
    });

    it('should skip existing target namespace entries when copying', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const source = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好', 'en-US': 'Hello' }
        }
      );
      await services.langLib.addPackage(
        {},
        {
          namespace: 'app',
          code: 'Hello',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '已有' }
        }
      );

      const result = await services.langLib.copyToNamespace(
        {},
        { ids: source.map(item => item.id), namespace: 'app' }
      );
      expect(result.createdCount).to.equal(1);
      expect(result.skippedCount).to.equal(1);

      const appList = await services.langLib.list({}, { namespace: 'app', perPage: 20, currentPage: 1 });
      expect(appList.totalCount).to.equal(2);
      expect(appList.pageData.find(item => item.locale === 'zh-CN').target).to.equal('已有');
      expect(appList.pageData.find(item => item.locale === 'en-US').target).to.equal('Hello');
    });
  });

  describe('messages', () => {
    it('should return flat code→target map for open approved entries', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好', 'en-US': 'Hello' }
        }
      );
      await services.langLib.addPackage(
        {},
        {
          namespace: 'app',
          code: 'Title',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '标题' }
        }
      );

      const zh = await services.langLib.messages({}, { locale: 'zh-CN', namespace: 'global' });
      expect(zh).to.deep.equal({ Hello: '你好' });

      const en = await services.langLib.messages({}, { locale: 'en-US' });
      expect(en).to.deep.equal({ Hello: 'Hello' });

      const app = await services.langLib.messages({}, { locale: 'zh-CN', namespace: 'app' });
      expect(app).to.deep.equal({ Title: '标题' });
    });

    it('should exclude closed or non-approved entries', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const [row] = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好' }
        }
      );
      await services.langLib.setStatus({}, { id: row.id, status: 'closed' });

      const result = await services.langLib.messages({}, { locale: 'zh-CN', namespace: 'global' });
      expect(result).to.deep.equal({});
    });

    it('should require locale', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      try {
        await services.langLib.messages({}, {});
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(400);
        expect(e.message).to.include('locale');
      }
    });
  });

  describe('exportI18n', () => {
    it('should export all namespaces grouped by namespace+locale', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好', 'en-US': 'Hello' }
        }
      );
      await services.langLib.addPackage(
        {},
        {
          namespace: 'app',
          code: 'Title',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '标题' }
        }
      );

      const result = await services.langLib.exportI18n({}, {});
      expect(result.pageData.map(item => item.filename).sort()).to.deep.equal([
        'app.zh-CN.i18n',
        'global.en-US.i18n',
        'global.zh-CN.i18n'
      ]);
      expect(result.pageData.find(item => item.filename === 'global.zh-CN.i18n').content).to.equal('Hello="你好"');
    });

    it('should filter by namespace when provided', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好' }
        }
      );
      await services.langLib.addPackage(
        {},
        {
          namespace: 'app',
          code: 'Title',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '标题' }
        }
      );

      const result = await services.langLib.exportI18n({}, { namespace: 'app' });
      expect(result.pageData).to.have.length(1);
      expect(result.pageData[0].filename).to.equal('app.zh-CN.i18n');
    });
  });

  describe('importI18n', () => {
    it('should create entries as open and approved', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      const result = await services.langLib.importI18n(
        { id: 'user-import' },
        {
          filename: 'zh-CN.i18n',
          content: 'Hello="你好"\nBye="再见"'
        }
      );

      expect(result.createdCount).to.equal(2);
      expect(result.updatedCount).to.equal(0);
      expect(result.pageData[0].namespace).to.equal('global');
      expect(result.pageData[0].locale).to.equal('zh-CN');

      const list = await services.langLib.list({}, { namespace: 'global', locale: 'zh-CN', perPage: 20, currentPage: 1 });
      expect(list.totalCount).to.equal(2);
      expect(list.pageData.every(item => item.status === 'open')).to.equal(true);
      expect(list.pageData.every(item => item.reviewStatus === 'approved')).to.equal(true);
      expect(list.pageData.every(item => item.userId === 'user-import')).to.equal(true);
    });

    it('should upsert existing entries and set open+approved', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      await seedLangTypes(services);

      const [row] = await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '旧值' }
        }
      );
      await services.langLib.setStatus({}, { id: row.id, status: 'closed' });
      await services.langLib.review({}, { id: row.id, reviewStatus: 'rejected', reviewRemark: 'bad' });

      const result = await services.langLib.importI18n(
        {},
        {
          filename: 'global.zh-CN.i18n',
          content: 'Hello="新值"\nNew="新增"'
        }
      );

      expect(result.createdCount).to.equal(1);
      expect(result.updatedCount).to.equal(1);

      const list = await services.langLib.list({}, { namespace: 'global', locale: 'zh-CN', perPage: 20, currentPage: 1 });
      const hello = list.pageData.find(item => item.code === 'Hello');
      const created = list.pageData.find(item => item.code === 'New');
      expect(hello.target).to.equal('新值');
      expect(hello.status).to.equal('open');
      expect(hello.reviewStatus).to.equal('approved');
      expect(created.target).to.equal('新增');
    });

    it('should import multiple files in one request', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      const result = await services.langLib.importI18n(
        {},
        {
          files: [
            { filename: 'app.zh-CN.i18n', content: 'A="1"' },
            { filename: 'en-US.i18n', content: 'B="2"' }
          ]
        }
      );

      expect(result.createdCount).to.equal(2);
      expect(result.pageData).to.have.length(2);
    });
  });
});
