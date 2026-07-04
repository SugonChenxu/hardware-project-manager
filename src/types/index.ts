// 项目类型
export interface Project {
  id: string;
  name: string;
  code: string;
  manager: string;
  level: 'A' | 'B' | 'C';
  status: 'planning' | 'DVT' | 'pilot' | 'closed';
  createdAt: string;
}

// 计划阶段状态
export type PhaseStatus = 'completed' | 'in_progress' | 'upcoming';

// 任务层级
export type TaskLevel = 'phase' | 'parent' | 'child' | 'grandchild';

// 计划阶段
export interface PlanPhase {
  id: string;
  projectId: string;
  phaseGroup: string;      // M1预研阶段 / M2计划阶段 / ...
  taskName: string;
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  duration: number;         // 天数
  lockStart: boolean;
  lockEnd: boolean;
  linked: boolean;         // 默认 true
  isCriticalPath: boolean;
  isParallel: boolean;
  parallelGroup: string;
  status: PhaseStatus;
  sortOrder: number;
  
  // 新增：层级关系
  level: TaskLevel;        // 任务层级
  parentId?: string;       // 父任务ID（子任务/孙任务用）
  children?: string[];     // 子任务ID列表（父任务用）
  isParentWithChildren: boolean; // 是否是带子任务的父任务
}

// 模板阶段
export interface PlanTemplatePhase {
  phaseGroup: string;
  taskName: string;
  duration: number;
  parallelGroup: string;
  level: TaskLevel;
  parentName?: string;     // 父任务名称（子任务用）
}

// 模板
export interface PlanTemplate {
  name: string;
  phases: PlanTemplatePhase[];
  importedAt: string;
}

// 计划历史快照
export interface PlanHistory {
  id: string;
  projectId: string;
  version: number;
  label: string;
  snapshot: PlanPhase[];
  createdAt: string;
}
