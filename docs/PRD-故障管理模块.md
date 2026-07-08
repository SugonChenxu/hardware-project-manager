# PRD - 硬件项目管理工具（故障管理模块）

**版本**: v2.0  
**日期**: 2026-07-08  
**作者**: X  
**状态**: 原型设计阶段

---

## 一、模块概述

### 1.1 功能定位
故障管理模块对接内部 Mantis 缺陷管理平台（https://mantis.sugon.com/），实现缺陷数据自动化拉取、可视化展示和周报自动生成，帮助硬件项目经理实时掌握项目缺陷状态。

### 1.2 核心能力
1. **数据源对接**：通过 Mantis REST API 完成鉴权与全量数据拉取
2. **可视化图表**：DI 趋势折线图 + 缺陷分类柱状图
3. **周报自动生成**：固定模板自动填充数据，一键复制
4. **缓存机制**：降低 Mantis 平台访问频次，支持手动强制刷新
5. **异常处理**：鉴权失败、网络超时、无数据等场景的友好提示

### 1.3 技术约束
- 前端代理模式：通过 Vite proxy 转发请求到 mantis.sugon.com，解决 CORS
- 鉴权方式：Cookie（`s_issue_mgmt_v3`），通过 URL 参数 `_mc` 传递
- 数据持久化：IndexedDB 存储缓存数据
- 图表库：Recharts（已集成）

---

## 二、数据源对接

### 2.1 Mantis API 端点

| 接口 | URL | 方法 | 说明 |
|------|-----|------|------|
| 项目列表 | `/api/mantis/projects?_mc={cookie}` | GET | 获取当前账号权限下最近访问项目 |
| 缺陷统计 | `/api/mantis/analysis?action=get_analysis_data` | GET | 获取 DI 值、分类分布、趋势数据 |
| 基本统计 | `/api/mantis/analysis`（不同 view_name） | GET | 获取故障总数、已解决数 |

### 2.2 请求参数

```
GET /api/mantis/analysis/?action=get_analysis_data
  &view_name={viewName}
  &index={index}
  &proj_id_arr=["{projectId}"]
  &date_from={dateFrom}
  &date_to={dateTo}
  &ignore_privileged_projects=yes
  &_mc={cookie}
```

### 2.3 拉取数据集范围

1. **项目列表**：当前账号权限下最近访问项目列表
2. **DI 值历史时序数据**：渲染 DI 趋势折线图；DI 数值为 0 的数据点过滤不展示
3. **缺陷分类统计**：分类维度 BIOS、BMC、HW、Perf，自动生成分类柱状图；DI=0 的分类条目隐藏
4. **项目全局统计指标**：故障总数量、已解决故障数量、故障解决率（自动计算百分比）

---

## 三、可视化图表

### 3.1 DI 趋势折线图

| 属性 | 规格 |
|------|------|
| 图表类型 | LineChart（Recharts） |
| 数据源 | `DefectSummary.trend: {date, value}[]` |
| 过滤规则 | `value > 0` 才展示（DI=0 的数据点过滤） |
| 横轴 | 时间（日期） |
| 纵轴 | DI 数值 |
| 交互 | 支持缩放（Brush）、悬浮 tooltip 展示精确数值 |
| 颜色 | 红色 `#E24B4A`，线条 + 数据点 |
| 空状态 | DI 全为 0 时隐藏图表，显示"暂无 DI 数据"提示 |

### 3.2 缺陷分类柱状图

| 属性 | 规格 |
|------|------|
| 图表类型 | BarChart（Recharts） |
| 数据源 | `DefectSummary.categories` |
| 分类维度 | BIOS、BMC、HW、Perf（固定 4 类） |
| X 轴 | 缺陷分类名称 |
| Y 轴 | 缺陷条数 |
| 过滤规则 | 分类缺陷数量为 0 时不渲染对应柱子 |
| 交互 | 悬浮 tooltip 展示精确数值 |
| 颜色 | BIOS=`#E24B4A`，BMC=`#EF9F27`，HW=`#378ADD`，Perf=`#639922` |

### 3.3 图表更新规则
- 图表随 Mantis 数据刷新实时更新
- 切换不同项目看板时，同步刷新对应项目图表
- 数据更新后页面锁定当前滚动位置，不自动跳转至页面顶部

---

## 四、本周故障自动报告

### 4.1 报告模板

```
BUG情况：
项目BUG状况：当前项目DI={diValue}、BUG={totalBugs}条、已解决={resolvedBugs}条，解决率={resolutionRate}%
遗留BUG {unresolvedBugs}条：BIOS-{bios}、BMC-{bmc}、HW-{hw}、Pef-{perf}
```

### 4.2 功能要求
1. 页面增加**一键复制**按钮，点击自动复制完整报告文本至剪贴板
2. 支持多项目切换，分别生成独立报告
3. 切换不同项目看板时，同步刷新对应项目报告内容
4. 复制成功后显示 `message.success('已复制到剪贴板')` 提示

### 4.3 数据映射

| 模板变量 | 数据来源 |
|----------|----------|
| `{diValue}` | `DefectSummary.diValue` |
| `{totalBugs}` | `BasicStats.totalBugs` |
| `{resolvedBugs}` | `BasicStats.resolvedBugs` |
| `{resolutionRate}` | `BasicStats.resolutionRate` |
| `{unresolvedBugs}` | `BasicStats.unresolvedBugs` |
| `{bios}` | categories 中 name=BIOS 的 di 值 |
| `{bmc}` | categories 中 name=BMC 的 di 值 |
| `{hw}` | categories 中 name=HW 的 di 值 |
| `{perf}` | categories 中 name=Perf 的 di 值 |

---

## 五、全局开发规范约束

### 5.1 缓存机制

| 属性 | 规格 |
|------|------|
| 缓存 Key | `projectId` |
| 缓存 TTL | 5 分钟 |
| 存储方式 | IndexedDB |
| 缓存命中 | 直接渲染，不请求 API |
| 缓存过期 | 请求 API 并更新缓存 |
| 手动刷新 | 强制拉取最新数据，忽略缓存 |

**缓存状态指示器**：
- 绿色圆点：缓存有效（5 分钟内数据）
- 橙色圆点：缓存过期（需要刷新）
- 红色圆点：缓存缺失（首次加载）

### 5.2 滚动位置锁定
- 数据更新前记录 `scrollTop`
- React re-render 后在 `useEffect` 中恢复 `scrollTop`
- 实现：`useRef` 保存 → `setState` 触发 → `window.scrollTo(0, savedScrollTop)`

### 5.3 版本管理
- 功能开发完成后同步推送代码至 GitHub
- 生成版本变更记录（CHANGELOG）
- 更新对应模块细分 PRD

### 5.4 异常处理

| 异常场景 | 处理方式 |
|----------|----------|
| Mantis 鉴权失败 | 提示"Cookie 已过期，请重新获取"，显示"重新配置"按钮，不阻塞其他项目 |
| 网络超时（>15s） | 自动重试 1 次，显示"重试"按钮，保留上次缓存数据 |
| 无项目数据 | 显示空状态插画，引导配置项目 |
| DI 全为 0 | 隐藏 DI 趋势图，显示"暂无 DI 数据"提示文案 |

---

## 六、组件架构

### 6.1 组件树

```
BugTracker.tsx (页面入口)
├── HeaderToolbar
│   ├── 项目选择器 (Select)
│   ├── 缓存状态指示器 (CacheIndicator)
│   └── 刷新按钮 (Button)
├── StatCards
│   ├── StatCard (故障总数量)
│   ├── StatCard (已解决故障)
│   └── StatCard (故障解决率)
├── DITrendChart (DI 趋势折线图)
├── DefectBarChart (缺陷分类柱状图)
├── WeeklyReport (周报区域)
│   ├── 报告文本 (Typography.Paragraph)
│   └── 一键复制按钮 (Button)
└── ErrorStates (异常状态)
    ├── 鉴权失败提示
    ├── 网络超时提示
    ├── 无数据空状态
    └── DI=0 提示
```

### 6.2 Store 层

**useMantisStore**：
```typescript
interface MantisStore {
  cookie: string;
  projectId: string;
  projects: MantisProject[];
  cache: Map<string, CacheData>;  // key: projectId
  lastFetch: number;
  cacheTTL: number;  // 5 * 60 * 1000
  // actions
  setCookie: (v: string) => void;
  setProjectId: (id: string) => void;
  load: () => void;
  addProject: (id: string, name: string) => void;
  removeProject: (id: string) => void;
  mergeRemoteProjects: (projects: MantisProject[]) => void;
}
```

**CacheData 结构**：
```typescript
interface CacheData {
  defectSummary: DefectSummary;
  basicStats: BasicStats;
  timestamp: number;  // 缓存写入时间
}
```

### 6.3 数据模型

**DefectSummary**：
```typescript
interface DefectSummary {
  diValue: number;
  totalDi: number;
  unresolvedDi: number;
  resolvedDi: number;
  resolutionRate: number;
  categories: {
    name: string;       // BIOS / BMC / HW / Perf
    di: number;
    unresolved: number;
    resolved: number;
  }[];
  trend: {
    date: string;       // YYYY-MM-DD
    value: number;       // DI 值（=0 的过滤不展示）
  }[];
}
```

**BasicStats**：
```typescript
interface BasicStats {
  totalBugs: number;
  unresolvedBugs: number;
  resolvedBugs: number;
  resolutionRate: number;  // 自动计算：resolvedBugs / totalBugs * 100
}
```

---

## 七、页面布局

### 7.1 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                      │
│  故障管理          [选择项目 ▾] [缓存●] [刷新]              │
├─────────────────────────────────────────────────────────────┤
│ 统计卡片区域                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ 故障总数  │  │ 已解决   │  │ 解决率   │                 │
│  │   156    │  │   98     │  │  62.8%   │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
├─────────────────────────────────────────────────────────────┤
│ 图表区域                                                     │
│  ┌────────────────────┐  ┌────────────────────────┐        │
│  │ DI 趋势图         │  │ 缺陷分类分布           │        │
│  │ (折线图, DI>0)    │  │ (柱状图, 0值隐藏)      │        │
│  │                    │  │                        │        │
│  └────────────────────┘  └────────────────────────┘        │
├─────────────────────────────────────────────────────────────┤
│ 本周故障报告                               [一键复制]       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ BUG情况：                                            │ │
│  │ 项目BUG状况：当前项目DI=42.5、BUG=156条、已解决=98条  │ │
│  │ ，解决率=62.8%                                       │ │
│  │ 遗留BUG 58条：BIOS-15、BMC-20、HW-18、Pef-5          │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 UI 规范

| 元素 | 样式 |
|------|------|
| 统计卡片 | 背景 `#F1EFE8`，无边框，圆角 8px，数字 24px/500 |
| 图表卡片 | 白色背景，0.5px 边框 `#D3D1C7`，圆角 8px |
| 周报文本 | 背景 `#F1EFE8`，圆角 6px，等宽字体，行高 2 |
| 复制按钮 | 蓝色 `#185FA5`，白色文字，圆角 4px |
| 缓存指示 | 绿/橙/红 圆点，5px |
| 故障总数 | 蓝色 `#185FA5` |
| 已解决 | 绿色 `#3B6D11` |
| 解决率 | >=80% 绿色，>=50% 橙色，<50% 红色 |

---

## 八、数据拉取流程

```
用户操作（刷新/切换项目）
  ↓
缓存检查（Key: projectId, TTL: 5min）
  ├─ 缓存命中 → 直接渲染（不请求 API）
  └─ 缓存未命中 → 请求 Mantis API
       ↓
    Mantis API 请求（代理模式）
       ├─ 成功 → 数据处理 → 写入缓存 → 渲染更新
       └─ 失败 → 异常处理
            ├─ 鉴权失败 → 提示重新配置 Cookie
            ├─ 网络超时 → 自动重试 1 次 → 显示重试按钮
            └─ 其他错误 → 显示错误提示
```

---

## 九、测试场景

### 9.1 正常流程

| 场景 | 操作 | 预期结果 |
|------|------|----------|
| 首次拉取 | 配置 Cookie → 选择项目 → 点击刷新 | 统计卡片、图表、周报全部渲染 |
| 缓存命中 | 5 分钟内再次刷新 | 直接渲染，不发送 API 请求 |
| 缓存过期 | 5 分钟后刷新 | 重新请求 API 并更新缓存 |
| 手动刷新 | 点击刷新按钮 | 强制拉取最新数据，忽略缓存 |
| 切换项目 | 选择不同项目 | 图表和周报同步刷新 |
| 复制周报 | 点击一键复制 | 文本复制到剪贴板，显示成功提示 |

### 9.2 异常场景

| 场景 | 操作 | 预期结果 |
|------|------|----------|
| Cookie 过期 | 使用过期 Cookie 拉取 | 显示"Cookie 已过期"提示，显示重新配置按钮 |
| 网络超时 | 模拟网络延迟 | 15s 后自动重试，重试失败显示重试按钮 |
| 无项目数据 | 账号下无项目 | 显示空状态，引导配置 |
| DI 全为 0 | 项目本周无缺陷 | 隐藏 DI 趋势图，显示"暂无 DI 数据" |
| 分类为 0 | 某分类无缺陷 | 柱状图隐藏对应柱子 |

---

## 十、文件结构

```
project-manager/src/
├── pages/
│   └── BugTracker.tsx          # 故障管理页面（主组件）
├── store/
│   ├── useMantisStore.ts       # Mantis 连接配置 + 缓存管理
│   ├── useBugStore.ts          # Bug 数据存储
│   └── useMantisSnapshotStore.ts # 快照存储
├── utils/
│   └── mantis.ts               # Mantis API 请求封装
└── types/
    └── index.ts                # 类型定义（BugItem, DefectSummary, BasicStats）
```

---

## 十一、版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-07-03 | 初版：Cookie 鉴权 + DI 趋势 + 分类柱状图 + 周报 |
| v2.0 | 2026-07-08 | 原型重构：缓存机制 + 异常处理 + 滚动锁定 + 多项目切换 |

---

**文档结束**
