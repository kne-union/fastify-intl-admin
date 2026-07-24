### 配置项

| 属性名 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| name | string | 否 | `intl-admin` | 命名空间名 |
| prefix | string | 否 | `/api/v1/intl-admin` | 路由前缀 |
| dbTableNamePrefix | string | 否 | `t_` | 表名前缀 |
| getAuthenticate | function | 否 | `() => []` | `(type) => middleware[]`，type 如 `langType` / `langType:manage` / `langLib` / `langLib:manage` |
| generateTargets | function | 否 | `null` | AI 生成译文回调；`aiGenerate=true` 时必填 |

### 接口

统一约定：读 `GET`，写 `POST`；list 返回 `{ pageData, totalCount }`；写操作除 create/add-package 外成功返回 `{}`。

列表筛选同时支持：

- 顶层：`keyword`、`locale`、`reviewStatus`、`perPage`、`currentPage`
- 或：`filter.keyword` 等（prompts 标准）

#### GET `/lang-type/list`

语言类型列表。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| keyword | string | 否 | - | 匹配 name / code / description |
| perPage | number | 否 | `20` | 每页条数 |
| currentPage | number | 否 | `1` | 页码 |

#### POST `/lang-type/create`

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 名称 |
| code | string | 是 | 编码（唯一） |
| params | string | 否 | 参数提示 |
| description | string | 否 | 描述 |
| status | string | 否 | `open` / `closed`，默认 `open` |

返回创建的记录。

#### POST `/lang-type/save`

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | number / string | 是 | ID |
| name | string | 否 | 名称 |
| params | string | 否 | 参数提示 |
| description | string | 否 | 描述 |

> `code` 不可修改。

#### POST `/lang-type/remove`

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | number / string | 是 | ID |

若仍有 `langLib.locale === code` 的词条则拒绝删除。

#### POST `/lang-type/set-status`

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | number / string | 是 | ID |
| status | string | 是 | `open` / `closed` |

#### POST `/lang-type/set-default`

将指定语言设为默认（全局唯一，会取消其他默认标记）。

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | number / string | 是 | ID |

> 创建时若当前无任何语言类型，自动 `isDefault=true`。删除默认语言时，会自动将剩余最早创建的一条设为默认。新建语言默认排到列表末尾（`sort` 递增）。

#### POST `/lang-type/move`

语言类型上移 / 下移（与相邻项交换 `sort`）。

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | number / string | 是 | ID |
| direction | string | 是 | `up` / `down` |

返回 `{ moved: true|false }`；已在边界时 `moved: false`。

#### GET `/lang-lib/list`

语言库**扁平**词条列表（不含虚拟父行）。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| keyword | string | 否 | - | 匹配 namespace / code / target |
| locale | string | 否 | - | 语言精确过滤 |
| reviewStatus | string | 否 | - | `approved` / `pending` / `rejected` |
| perPage | number | 否 | `20` | 每页条数 |
| currentPage | number | 否 | `1` | 页码 |

返回示例：

```json
{
  "pageData": [
    {
      "id": 1,
      "namespace": "global",
      "code": "Hello",
      "locale": "zh-CN",
      "target": "你好",
      "reviewStatus": "approved",
      "status": "open"
    }
  ],
  "totalCount": 1
}
```

#### GET `/lang-lib/messages`

运行时语言包（供 `@kne/react-intl` `apis.localeMessage` 使用）。**无需登录**。返回**扁平** `{ [code]: target }`，仅包含 `status=open` 且 `reviewStatus=approved` 的词条。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| locale | string | 是 | - | 语言 code |
| namespace | string | 否 | `global` | 命名空间 |

返回示例：

```json
{
  "Hello": "你好",
  "Save": "保存"
}
```

#### POST `/lang-lib/add-package`

批量添加同一 `namespace+code` 下多语言词条。

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| namespace | string | 是 | 命名空间 |
| code | string | 是 | 词条编码 |
| locales | string[] | 是 | 语言编码列表 |
| aiGenerate | boolean | 否 | 是否 AI 生成，默认 `false` |
| sourceTarget | string | AI 时是 | 默认语言源文案 |
| defaultLocale | string | 否 | 默认语言 code；省略时取 `langType.isDefault`；若在 locales 中则直接写入 `sourceTarget` 且 `approved` |
| targets | object | 否 | `{ [locale]: target }`，`aiGenerate=false` 时使用 |

- 各 locale 须在 langType 中存在且 `status=open`
- 人工：`reviewStatus=approved`；AI 非默认语言：`pending`；默认语言词条始终 `approved`
- 返回创建的记录数组

#### POST `/lang-lib/save`

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | number / string | 是 | ID |
| target | string | 否 | 译文；非默认语言变更后 `reviewStatus` 重置为 `pending`；默认语言保持 `approved` |

`namespace` / `code` / `locale` 不可改。

#### POST `/lang-lib/remove`

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | number / string | 否 | 单条 |
| ids | array | 否 | 批量（与 id 二选一） |

#### POST `/lang-lib/set-status`

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id / ids | number / array | 是 | 单条或批量 |
| status | string | 是 | `open` / `closed` |

#### POST `/lang-lib/review`

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id / ids | number / array | 是 | 单条或批量 |
| reviewStatus | string | 是 | 仅 `approved` / `rejected` |
| reviewRemark | string | 否 | 备注，最长 500 |

### 程序化 API

挂载于 `fastify['intl-admin'].services`：

| 方法签名 | 说明 |
| --- | --- |
| `langType.list(auth, query)` | 语言类型列表 |
| `langType.create(auth, body)` | 创建 |
| `langType.save(auth, body)` | 保存 |
| `langType.remove(auth, body)` | 删除 |
| `langType.setStatus(auth, body)` | 启停 |
| `langType.setDefault(auth, body)` | 设为默认语言 |
| `langLib.list(auth, query)` | 词条扁平列表 |
| `langLib.addPackage(auth, body)` | 批量添加 |
| `langLib.save(auth, body)` | 保存 |
| `langLib.remove(auth, body)` | 删除（id/ids） |
| `langLib.setStatus(auth, body)` | 启停（id/ids） |
| `langLib.review(auth, body)` | 审核（id/ids） |

首参 `auth` 为 `request.userInfo || {}`（本插件不做租户过滤）。

### 数据模型

#### langType（表注释：语言类型）

| 属性名 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 名称 |
| code | string | 编码（唯一） |
| params | string | 翻译参数提示 |
| description | text | 描述 |
| status | enum | `open` / `closed` |
| isDefault | boolean | 是否默认语言（全局唯一；首条创建自动为 true） |

#### langLib（表注释：语言库词条）

| 属性名 | 类型 | 说明 |
| --- | --- | --- |
| namespace | string | 命名空间 |
| code | string | 词条编码 |
| locale | string | 语言编码 |
| target | text | 译文 |
| reviewStatus | enum | `approved` / `pending` / `rejected` |
| reviewRemark | text | 审核备注 |
| status | enum | `open` / `closed` |

唯一约束：`(namespace, code, locale)`。

### 机制说明

> **列表兼容**：`normalizeListQuery` 将顶层 `keyword` 等写入 `filter`，与 prompts 的 `filter` 对象约定兼容前端 isNext 扁平 query。

> **鉴权**：默认 `getAuthenticate` 返回空数组；宿主应用可按 `langType` / `langLib` / `*:manage` 覆盖。`GET /lang-lib/messages` 固定不挂鉴权，允许未登录访问。
