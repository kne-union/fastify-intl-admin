const { expect } = require('chai');
const { createTestContext } = require('./helpers/context');

describe('@kne/fastify-intl-admin - langType', function () {
  this.timeout(10000);

  const context = createTestContext();
  let fastify;

  const createFastify = async options => {
    fastify = await context.createFastify(options);
    return fastify;
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

  describe('create', () => {
    it('should create lang type successfully', async () => {
      fastify = await createFastify();
      await fastify.ready();

      const record = await fastify['intl-admin'].services.langType.create(
        {},
        {
          name: '中文（简体）',
          code: 'zh-CN',
          params: 'count',
          description: '简体中文'
        }
      );

      expect(record).to.exist;
      expect(record.code).to.equal('zh-CN');
      expect(record.status).to.equal('open');
      expect(record.isDefault).to.equal(true);
    });

    it('should set userId from authenticatePayload as created user', async () => {
      fastify = await createFastify();
      await fastify.ready();

      const record = await fastify['intl-admin'].services.langType.create(
        { id: 'user-1' },
        {
          name: '中文（简体）',
          code: 'zh-CN'
        }
      );

      expect(record.userId).to.equal('user-1');
    });

    it('should set first lang type as default and later ones not', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      const first = await langType.create({}, { name: '中文', code: 'zh-CN' });
      const second = await langType.create({}, { name: 'English', code: 'en-US' });

      expect(first.isDefault).to.equal(true);
      expect(second.isDefault).to.equal(false);
    });

    it('should reject duplicate code', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      await langType.create({}, { name: '中文', code: 'zh-CN' });
      try {
        await langType.create({}, { name: '中文2', code: 'zh-CN' });
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(400);
        expect(e.message).to.include('已存在');
      }
    });
  });

  describe('list', () => {
    it('should return paginated list and filter by keyword', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      await langType.create({}, { name: '中文（简体）', code: 'zh-CN' });
      await langType.create({}, { name: 'English', code: 'en-US' });

      const all = await langType.list({}, { perPage: 10, currentPage: 1 });
      expect(all.totalCount).to.equal(2);
      expect(all.pageData).to.have.length(2);

      const filtered = await langType.list({}, { keyword: 'en' });
      expect(filtered.totalCount).to.equal(1);
      expect(filtered.pageData[0].code).to.equal('en-US');
    });

    it('should order by sort ascending', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      const zh = await langType.create({}, { name: '中文', code: 'zh-CN' });
      const en = await langType.create({}, { name: 'English', code: 'en-US' });
      const ja = await langType.create({}, { name: '日本語', code: 'ja-JP' });

      expect(zh.sort).to.equal(0);
      expect(en.sort).to.equal(1);
      expect(ja.sort).to.equal(2);

      const { pageData } = await langType.list({}, { perPage: 10, currentPage: 1 });
      expect(pageData.map(item => item.code)).to.deep.equal(['zh-CN', 'en-US', 'ja-JP']);
    });

    it('should move up and down', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      const zh = await langType.create({}, { name: '中文', code: 'zh-CN' });
      const en = await langType.create({}, { name: 'English', code: 'en-US' });
      await langType.create({}, { name: '日本語', code: 'ja-JP' });

      await langType.move({}, { id: en.id, direction: 'up' });
      let { pageData } = await langType.list({}, { perPage: 10, currentPage: 1 });
      expect(pageData.map(item => item.code)).to.deep.equal(['en-US', 'zh-CN', 'ja-JP']);

      await langType.move({}, { id: zh.id, direction: 'down' });
      ({ pageData } = await langType.list({}, { perPage: 10, currentPage: 1 }));
      expect(pageData.map(item => item.code)).to.deep.equal(['en-US', 'ja-JP', 'zh-CN']);

      const edge = await langType.move({}, { id: en.id, direction: 'up' });
      expect(edge.moved).to.equal(false);
    });

    it('should include entryCount and defaultEntryCount', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      await services.langType.create({}, { name: '中文', code: 'zh-CN' });
      await services.langType.create({}, { name: 'English', code: 'en-US' });
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
          namespace: 'global',
          code: 'Bye',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '再见' }
        }
      );

      const { pageData } = await services.langType.list({}, { perPage: 10, currentPage: 1 });
      const zh = pageData.find(item => item.code === 'zh-CN');
      const en = pageData.find(item => item.code === 'en-US');
      expect(zh.entryCount).to.equal(2);
      expect(zh.defaultEntryCount).to.equal(2);
      expect(en.entryCount).to.equal(1);
      expect(en.defaultEntryCount).to.equal(2);
    });

    it('should scope entryCount by namespace when provided', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      await services.langType.create({}, { name: '中文', code: 'zh-CN' });
      await services.langType.create({}, { name: 'English', code: 'en-US' });
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

      const { pageData } = await services.langType.list({}, { namespace: 'app', perPage: 10, currentPage: 1 });
      const zh = pageData.find(item => item.code === 'zh-CN');
      const en = pageData.find(item => item.code === 'en-US');
      expect(zh.entryCount).to.equal(1);
      expect(zh.defaultEntryCount).to.equal(1);
      expect(en.entryCount).to.equal(0);
      expect(en.defaultEntryCount).to.equal(1);
    });
  });

  describe('save', () => {
    it('should update fields but ignore code change', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      const created = await langType.create({}, { name: '中文', code: 'zh-CN' });
      await langType.save(
        {},
        {
          id: created.id,
          name: '简体中文',
          code: 'zh-TW',
          description: 'updated'
        }
      );

      const detail = await langType.detail({}, { id: created.id });
      expect(detail.name).to.equal('简体中文');
      expect(detail.code).to.equal('zh-CN');
      expect(detail.description).to.equal('updated');
    });

    it('POST /lang-type/save should ignore undeclared fields but save declared ones', async () => {
      fastify = await createFastify();
      fastify.register(require('../libs/controllers/lang-type'), fastify['intl-admin'].options);
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      const created = await langType.create({ id: 'owner' }, { name: '中文', code: 'zh-CN' });
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/intl-admin/lang-type/save',
        payload: {
          id: created.id,
          name: '简体中文',
          params: 'count',
          description: 'updated',
          status: 'closed',
          userId: 'attacker',
          deletedAt: '2000-01-01T00:00:00.000Z'
        }
      });
      expect(response.statusCode).to.equal(200);

      const detail = await langType.detail({}, { id: created.id });
      expect(detail).to.include({ name: '简体中文', params: 'count', description: 'updated', status: 'closed' });
      expect(detail.userId).to.equal('owner');
      expect(detail.deletedAt).to.equal(undefined);
    });
  });

  describe('setStatus', () => {
    it('should set status to closed and open', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      const created = await langType.create({}, { name: 'English', code: 'en-US' });
      await langType.setStatus({}, { id: created.id, status: 'closed' });
      expect((await langType.detail({}, { id: created.id })).status).to.equal('closed');

      await langType.setStatus({}, { id: created.id, status: 'open' });
      expect((await langType.detail({}, { id: created.id })).status).to.equal('open');
    });
  });

  describe('setDefault', () => {
    it('should switch default language', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      const first = await langType.create({}, { name: '中文', code: 'zh-CN' });
      const second = await langType.create({}, { name: 'English', code: 'en-US' });

      await langType.setDefault({}, { id: second.id });

      expect((await langType.detail({}, { id: first.id })).isDefault).to.equal(false);
      expect((await langType.detail({}, { id: second.id })).isDefault).to.equal(true);
    });
  });

  describe('remove', () => {
    it('should promote another default when removing default lang type', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      const first = await langType.create({}, { name: '中文', code: 'zh-CN' });
      const second = await langType.create({}, { name: 'English', code: 'en-US' });
      await langType.remove({}, { id: first.id });

      expect((await langType.detail({}, { id: second.id })).isDefault).to.equal(true);
    });

    it('should remove lang type when no related lang lib', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const { langType } = fastify['intl-admin'].services;

      const created = await langType.create({}, { name: 'English', code: 'en-US' });
      await langType.remove({}, { id: created.id });

      try {
        await langType.detail({}, { id: created.id });
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(404);
      }
    });

    it('should reject remove when lang lib references locale', async () => {
      fastify = await createFastify();
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      const created = await services.langType.create({}, { name: '中文', code: 'zh-CN' });
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
        await services.langType.remove({}, { id: created.id });
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(400);
        expect(e.message).to.include('关联词条');
      }
    });
  });

  describe('translateRemaining', () => {
    it('should translate missing entries for target locale', async () => {
      fastify = await createFastify({
        generateTargets: async ({ locales, sourceTarget, texts }) => {
          const result = {};
          locales.forEach(locale => {
            if (texts) {
              const byKey = {};
              Object.entries(texts).forEach(([key, value]) => {
                byKey[key] = `AI-${locale}-${value}`;
              });
              result[locale] = byKey;
              return;
            }
            result[locale] = `AI-${locale}-${sourceTarget}`;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      const zh = await services.langType.create({}, { name: '中文', code: 'zh-CN' });
      const en = await services.langType.create({}, { name: 'English', code: 'en-US' });
      expect(zh.isDefault).to.equal(true);

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
          namespace: 'global',
          code: 'Bye',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '再见' }
        }
      );

      const result = await services.langType.translateRemaining({ id: 'user-1' }, { id: en.id });
      expect(result.createdCount).to.equal(1);

      const list = await services.langLib.list({}, { locale: 'en-US', perPage: 20, currentPage: 1 });
      expect(list.totalCount).to.equal(2);
      const bye = list.pageData.find(item => item.code === 'Bye');
      expect(bye.target).to.equal('AI-en-US-再见');
      expect(bye.reviewStatus).to.equal('pending');
      expect(bye.userId).to.equal('user-1');
    });

    it('should pass all missing texts to generateTargets in one batch call', async () => {
      let receivedTexts = null;
      let callCount = 0;
      fastify = await createFastify({
        generateTargets: async ({ locales, texts }) => {
          callCount += 1;
          receivedTexts = texts;
          const result = {};
          locales.forEach(locale => {
            const byKey = {};
            Object.entries(texts || {}).forEach(([key, value]) => {
              byKey[key] = `${value}@${locale}`;
            });
            result[locale] = byKey;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      await services.langType.create({}, { name: '中文', code: 'zh-CN' });
      const en = await services.langType.create({}, { name: 'English', code: 'en-US' });
      await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'A',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '甲' }
        }
      );
      await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'B',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '乙' }
        }
      );

      await services.langType.translateRemaining({}, { id: en.id });
      expect(callCount).to.equal(1);
      expect(receivedTexts).to.deep.equal({
        'global::A': '甲',
        'global::B': '乙'
      });
    });

    it('should honor limit and report remainingCount for batched补译', async () => {
      const receivedSizes = [];
      fastify = await createFastify({
        generateTargets: async ({ locales, texts }) => {
          receivedSizes.push(Object.keys(texts || {}).length);
          const result = {};
          locales.forEach(locale => {
            const byKey = {};
            Object.entries(texts || {}).forEach(([key, value]) => {
              byKey[key] = `${value}@${locale}`;
            });
            result[locale] = byKey;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      await services.langType.create({}, { name: '中文', code: 'zh-CN' });
      const en = await services.langType.create({}, { name: 'English', code: 'en-US' });
      for (const [code, target] of [
        ['A', '甲'],
        ['B', '乙'],
        ['C', '丙']
      ]) {
        await services.langLib.addPackage(
          {},
          {
            namespace: 'global',
            code,
            locales: ['zh-CN'],
            aiGenerate: false,
            targets: { 'zh-CN': target }
          }
        );
      }

      const first = await services.langType.translateRemaining({}, { id: en.id, limit: 2 });
      expect(first.createdCount).to.equal(2);
      expect(first.remainingCount).to.equal(1);
      expect(first.totalProcessable).to.equal(3);
      expect(receivedSizes).to.deep.equal([2]);

      const second = await services.langType.translateRemaining({}, { id: en.id, limit: 2 });
      expect(second.createdCount).to.equal(1);
      expect(second.remainingCount).to.equal(0);
      expect(receivedSizes).to.deep.equal([2, 1]);
    });

    it('should reject when target is default locale', async () => {
      fastify = await createFastify({
        generateTargets: async () => ({})
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;
      const zh = await services.langType.create({}, { name: '中文', code: 'zh-CN' });

      try {
        await services.langType.translateRemaining({}, { id: zh.id });
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e.statusCode).to.equal(400);
        expect(e.message).to.include('默认语言');
      }
    });

    it('should only translate remaining entries in the given namespace', async () => {
      fastify = await createFastify({
        generateTargets: async ({ locales, texts }) => {
          const result = {};
          locales.forEach(locale => {
            const byKey = {};
            Object.entries(texts || {}).forEach(([key, value]) => {
              byKey[key] = `AI-${value}`;
            });
            result[locale] = byKey;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      await services.langType.create({}, { name: '中文', code: 'zh-CN' });
      const en = await services.langType.create({}, { name: 'English', code: 'en-US' });
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

      const result = await services.langType.translateRemaining({}, { id: en.id, namespace: 'app' });
      expect(result.createdCount).to.equal(1);

      const list = await services.langLib.list({}, { locale: 'en-US', perPage: 20, currentPage: 1 });
      expect(list.totalCount).to.equal(1);
      expect(list.pageData[0].namespace).to.equal('app');
      expect(list.pageData[0].code).to.equal('Title');
      expect(list.pageData[0].target).to.equal('AI-标题');
    });

    it('should prefer global target locale for non-global namespace and LLM the rest', async () => {
      let receivedTexts = null;
      let callCount = 0;
      fastify = await createFastify({
        generateTargets: async ({ locales, texts }) => {
          callCount += 1;
          receivedTexts = texts;
          const result = {};
          locales.forEach(locale => {
            const byKey = {};
            Object.entries(texts || {}).forEach(([key, value]) => {
              byKey[key] = `AI-${value}`;
            });
            result[locale] = byKey;
          });
          return result;
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      await services.langType.create({}, { name: '中文', code: 'zh-CN' });
      const en = await services.langType.create({}, { name: 'English', code: 'en-US' });

      // global 已有 Hello 的 en-US，app 缺 Hello / OnlyApp 的 en-US
      await services.langLib.addPackage(
        {},
        {
          namespace: 'global',
          code: 'Hello',
          locales: ['zh-CN', 'en-US'],
          aiGenerate: false,
          targets: { 'zh-CN': '你好', 'en-US': 'Hello from global' }
        }
      );
      await services.langLib.addPackage(
        {},
        {
          namespace: 'app',
          code: 'Hello',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '应用你好' }
        }
      );
      await services.langLib.addPackage(
        {},
        {
          namespace: 'app',
          code: 'OnlyApp',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '仅应用' }
        }
      );

      const result = await services.langType.translateRemaining({}, { id: en.id, namespace: 'app' });
      expect(result.createdCount).to.equal(2);
      expect(result.copiedCount).to.equal(1);
      expect(result.generatedCount).to.equal(1);
      expect(callCount).to.equal(1);
      expect(receivedTexts).to.deep.equal({
        'app::OnlyApp': '仅应用'
      });

      const list = await services.langLib.list({}, { namespace: 'app', locale: 'en-US', perPage: 20, currentPage: 1 });
      expect(list.totalCount).to.equal(2);
      const hello = list.pageData.find(item => item.code === 'Hello');
      const onlyApp = list.pageData.find(item => item.code === 'OnlyApp');
      expect(hello.target).to.equal('Hello from global');
      expect(hello.reviewStatus).to.equal('approved');
      expect(onlyApp.target).to.equal('AI-仅应用');
      expect(onlyApp.reviewStatus).to.equal('pending');
    });

    it('should skip LLM when all non-global missing entries exist in global', async () => {
      let callCount = 0;
      fastify = await createFastify({
        generateTargets: async () => {
          callCount += 1;
          return {};
        }
      });
      await fastify.ready();
      const services = fastify['intl-admin'].services;

      await services.langType.create({}, { name: '中文', code: 'zh-CN' });
      const en = await services.langType.create({}, { name: 'English', code: 'en-US' });
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
          code: 'Hello',
          locales: ['zh-CN'],
          aiGenerate: false,
          targets: { 'zh-CN': '应用你好' }
        }
      );

      const result = await services.langType.translateRemaining({}, { id: en.id, namespace: 'app' });
      expect(result.createdCount).to.equal(1);
      expect(result.copiedCount).to.equal(1);
      expect(result.generatedCount).to.equal(0);
      expect(callCount).to.equal(0);
    });
  });
});
