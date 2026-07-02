// 项目
export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'planning' | 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// 子任务
export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

// 任务
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string;
  startDate: string;
  endDate: string;
  dependencies: string[]; // task ids
  textColor: string;
  completedAt: string;
  subTasks: SubTask[];
  createdAt: string;
  updatedAt: string;
}

// 每日待办
export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  priority: TaskPriority;
  projectId?: string;
  createdAt: string;
}

// 物料管理
export type MaterialStatus = '默认' | '已入库' | '已下单' | '待决策' | '高风险';

export const MATERIAL_STATUS_CONFIG: Record<MaterialStatus, { color: string; bg: string; border: string }> = {
  '默认':   { color: '#8c8c8c', bg: '#f5f5f5', border: '#d9d9d9' },
  '已入库': { color: '#fff', bg: '#52c41a', border: '#52c41a' },
  '已下单': { color: '#135200', bg: '#b7eb8f', border: '#95de64' },
  '待决策': { color: '#fff', bg: '#faad14', border: '#faad14' },
  '高风险': { color: '#fff', bg: '#ff4d4f', border: '#ff4d4f' },
};

export const MATERIAL_STATUS_LIST: MaterialStatus[] = ['默认', '已入库', '已下单', '待决策', '高风险'];

// BOMItem 别名（兼容旧代码）
export type BOMItem = MaterialItem;

export interface MaterialItem {
  id: string;
  projectId: string;
  seq: number;
  materialStatus: MaterialStatus;
  manufacturer: string;
  model: string;
  partNumber: string;
  quantityPerSet: number;
  setCount: number;
  purchaseDate: string;
  leadTime: number;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// 会议纪要
export interface MeetingNote {
  id: string;
  projectId: string;
  title: string;
  date: string;
  attendees: string[];
  content: string; // markdown
  decisions: string[];
  actionItems: ActionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee: string;
  dueDate: string;
  completed: boolean;
}

// 周报
export interface WeeklyReport {
  id: string;
  projectId: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  tasksCompleted: string[];
  tasksPlanned: string[];
  risks: string[];
  issues: string[];
  createdAt: string;
  updatedAt: string;
}

// 费用人力估算
export interface CostItem {
  id: string;
  projectId: string;
  category: 'material' | 'labor' | 'equipment' | 'outsource' | 'travel' | 'other';
  item: string;
  estimatedCost: number;
  actualCost: number;
  manHours: number; // 人时
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Bug 追踪
export type BugSeverity = 'critical' | 'major' | 'minor' | 'trivial';
export type BugStatus = 'open' | 'confirmed' | 'fixing' | 'resolved' | 'closed' | 'reopened';

export interface BugItem {
  id: string;
  projectId: string;
  bugId: string;
  title: string;
  description: string;
  severity: BugSeverity;
  status: BugStatus;
  module: string;
  assignedTo: string;
  foundDate: string;
  resolvedDate?: string;
  diValue: number;
  createdAt: string;
  updatedAt: string;
}

// 导航菜单
export interface NavItem {
  key: string;
  label: string;
  icon?: string;
  path: string;
}

// Mantis 数据快照
export interface MantisSnapshot {
  id: string;
  projectId: string;
  date: string;
  diValue: number;
  totalBugs: number;
  unresolvedBugs: number;
  resolvedBugs: number;
  resolutionRate: number; // 解决率 = resolvedBugs / totalBugs * 100
  notes: string;
  createdAt: string;
}

// 应用状态
export type ViewMode = 'kanban' | 'list' | 'gantt';

// ── 项目计划模块 ──

/** 计划阶段状态 */
export type PhaseStatus = 'completed' | 'in_progress' | 'upcoming';

/** 计划阶段节点 */
export interface PlanPhase {
  id: string;
  projectId: string;
  phaseGroup: string;      // 阶段分组（M1预研阶段/M2计划阶段/...）
  taskName: string;         // 任务名称
  startDate: string;        // 开始日期 YYYY-MM-DD
  endDate: string;          // 结束日期 YYYY-MM-DD
  duration: number;         // 周期（天）
  lockStart: boolean;       // 是否锁定开始日期（锁定后不受前置任务级联影响）
  lockEnd: boolean;         // 是否锁定结束日期（锁定后结束日期固定，周期随开始日期变化自动重算）
  linked: boolean;          // 是否与前后任务关联（默认true；false=独立节点，不参与级联）
  isCriticalPath: boolean;  // 是否关键路径
  isParallel: boolean;      // 是否为并行分支任务
  parallelGroup: string;    // 并行组标识（同一组内互为并行）
  status: PhaseStatus;      // 当前状态（根据系统日期自动判定）
  sortOrder: number;        // 排序序号
  parentId?: string;        // 父任务 ID（子任务挂在父任务下方显示）
  parentTaskName?: string;   // 父任务名称（临时字段，用于模板生成时关联父任务）
  description?: string;     // 说明（自由编辑）
}

/** 计划模板（从 Excel 导入的基准数据） */
export interface PlanTemplate {
  name: string;
  phases: PlanTemplatePhase[];
  importedAt: string;
}

/** 模板中的阶段（不含项目 ID 和运行时状态） */
export interface PlanTemplatePhase {
  phaseGroup: string;
  taskName: string;
  startDate: string;
  endDate: string;
  duration: number;
  parallelGroup: string;
  linked?: boolean;
  parentTaskName?: string;
  description?: string; // 说明
}

/** 排期配置 */
export interface ScheduleConfig {
  projectStartDate: string;  // 项目启动日期
  useTemplate: boolean;       // 是否使用模板自动排期
  templateName: string;       // 模板名称
}

/** 版本历史记录 */
export interface PlanHistory {
  id: string;
  projectId: string;
  version: number;
  label: string;
  snapshot: PlanPhase[];
  createdAt: string;
}
