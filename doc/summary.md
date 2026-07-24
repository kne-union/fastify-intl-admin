### 项目概述

`@kne/fastify-intl-admin` 是一个 Fastify 业务插件，提供国际化**语言类型（lang-type）**与**语言库词条（lang-lib）**的管理接口，对接管理端 IntlAdmin 组件。

### 核心架构与流程

```
HTTP Request
    ↓
controllers（鉴权 + schema 校验）
    ↓
services（业务逻辑）
    ↓
models（Sequelize / t_ 前缀表）
```

插件通过 `@kne/fastify-namespace` 注册为 `intl-admin` 命名空间，默认路由前缀 `/api/v1/intl-admin`。

### 核心概念详解

#### 语言类型（langType）

维护可用语言目录，如 `zh-CN`、`en-US`。字段含名称、编码、参数提示、描述与启停状态。

#### 语言库词条（langLib）

按 `namespace` + `code` + `locale` 唯一存储译文。接口 list 返回**扁平列表**，树形分组由前端组装。

#### 审核状态（reviewStatus）

| 场景 | 默认 reviewStatus |
|------|-------------------|
| 人工填写条目（`aiGenerate=false`） | `approved` |
| AI 生成条目（`aiGenerate=true`，非默认语言） | `pending` |
| 默认语言词条（含 AI 源文） | `approved` |
| 编辑非默认语言 target | 重置为 `pending` |
| 编辑默认语言 target | 保持 `approved` |

#### AI 生成扩展点

通过 `options.generateTargets` 注入：

```js
generateTargets: async ({ namespace, code, locales }) => {
  // 返回 { [locale]: targetText }
  return { 'zh-CN': '...', 'en-US': '...' };
}
```

未配置时，`aiGenerate=true` 的请求会返回 400。

### 主要特性

- 标准 CRUD：`list` / `create` / `save` / `remove` / `set-status`
- 语言库批量添加：`add-package`（多 locale）
- 单条 / 批量审核、启停、删除（`id` 或 `ids`）
- `getAuthenticate(type)` 按功能注入鉴权
- 列表筛选兼容顶层 flat 参数与 `filter` 对象

### 使用方法

```js
const fastify = require('fastify')();

await fastify.register(require('@kne/fastify-sequelize'), { /* ... */ });
await fastify.register(require('@kne/fastify-intl-admin'), {
  prefix: '/api/v1/intl-admin',
  getAuthenticate: type => {
    // 按 type 返回中间件数组，如 langType / langType:manage
    return [];
  },
  generateTargets: async ({ namespace, code, locales, sourceTarget, defaultLocale }) => {
    return Object.fromEntries(locales.map(locale => [locale, `${sourceTarget || code}@${locale}`]));
  }
});
```

> **关键设计**：数据为全局语言包（无 `tenantId`）；树形 UI 由前端把扁平 list 转为 `parentId` 树，后端只负责词条行存储与分页。
