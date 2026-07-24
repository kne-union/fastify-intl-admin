const { expect } = require('chai');
const {
  DEFAULT_NAMESPACE,
  parseFilename,
  buildFilename,
  parseContent,
  buildContent,
  groupRowsToFiles
} = require('../libs/utils/i18n-file');

describe('libs/utils/i18n-file', () => {
  describe('parseFilename', () => {
    it('should parse namespace.locale.i18n', () => {
      expect(parseFilename('global.zh-CN.i18n')).to.deep.equal({
        namespace: 'global',
        locale: 'zh-CN'
      });
      expect(parseFilename('app.module.en-US.i18n')).to.deep.equal({
        namespace: 'app.module',
        locale: 'en-US'
      });
    });

    it('should default namespace to global for locale.i18n', () => {
      expect(parseFilename('zh-CN.i18n')).to.deep.equal({
        namespace: DEFAULT_NAMESPACE,
        locale: 'zh-CN'
      });
    });

    it('should use basename when path is provided', () => {
      expect(parseFilename('/tmp/upload/global.en-US.i18n')).to.deep.equal({
        namespace: 'global',
        locale: 'en-US'
      });
    });

    it('should throw on invalid filename', () => {
      expect(() => parseFilename('')).to.throw('文件名不能为空');
      expect(() => parseFilename('plain.txt')).to.throw('无效的 i18n 文件名');
    });
  });

  describe('parseContent / buildContent', () => {
    it('should parse code="target" lines and keep special chars in target', () => {
      const entries = parseContent('Hello="你好"\nUrl="https://a.com/x?a=1"\n\nBye="再见"');
      expect(entries).to.deep.equal([
        { code: 'Hello', target: '你好' },
        { code: 'Url', target: 'https://a.com/x?a=1' },
        { code: 'Bye', target: '再见' }
      ]);
    });

    it('should support escaped quotes in target', () => {
      const entries = parseContent('Quote="say \\"hi\\""');
      expect(entries).to.deep.equal([{ code: 'Quote', target: 'say "hi"' }]);
      expect(buildContent(entries)).to.equal('Quote="say \\"hi\\""');
    });

    it('should round-trip with buildContent', () => {
      const entries = [
        { code: 'A', target: '1' },
        { code: 'B', target: 'x=y' },
        { code: 'C', target: 'say "hi"' }
      ];
      expect(parseContent(buildContent(entries))).to.deep.equal(entries);
    });

    it('should throw on invalid line', () => {
      expect(() => parseContent('="no-code"')).to.throw('无效的词条行');
      expect(() => parseContent('no-quote')).to.throw('无效的词条行');
      expect(() => parseContent('Hello:你好')).to.throw('无效的词条行');
    });
  });

  describe('groupRowsToFiles', () => {
    it('should group by namespace+locale and build filenames', () => {
      const files = groupRowsToFiles([
        { namespace: 'global', locale: 'zh-CN', code: 'A', target: '甲' },
        { namespace: 'global', locale: 'zh-CN', code: 'B', target: '乙' },
        { namespace: 'global', locale: 'en-US', code: 'A', target: 'A' },
        { namespace: 'app', locale: 'zh-CN', code: 'A', target: '应用' }
      ]);
      expect(files).to.have.length(3);
      expect(files.map(item => item.filename).sort()).to.deep.equal([
        'app.zh-CN.i18n',
        'global.en-US.i18n',
        'global.zh-CN.i18n'
      ]);
      const globalZh = files.find(item => item.filename === 'global.zh-CN.i18n');
      expect(globalZh.content).to.equal('A="甲"\nB="乙"');
    });

    it('should buildFilename consistently', () => {
      expect(buildFilename('global', 'zh-CN')).to.equal('global.zh-CN.i18n');
    });
  });
});
