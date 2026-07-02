import { create } from 'zustand';
import { PlanPhase, PlanTemplate, PlanTemplatePhase, PlanHistory } from '../types';
import { generateId } from '../utils/storage';
import dayjs from 'dayjs';
import { dbGetPlanPhases, dbSetPlanPhases, migrateFromLocalStorage } from '../utils/db';

// ── 工具函数 ──
function daysBetween(d1: string, d2: string): number {
  return dayjs(d2).diff(dayjs(d1), 'day');
}
function fmt(d: dayjs.Dayjs): string {
  return d.format('YYYY-MM-DD');
}
export function computeStatusFull(startDate: string, endDate: string): 'completed' | 'in_progress' | 'upcoming' {
  const today = dayjs().startOf('day');
  const start = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).startOf('day');
  if (end.isBefore(today)) return 'completed';
  if (start.isBefore(today) || start.isSame(today)) return 'in_progress';
  return 'upcoming';
}

// ── Store 接口 ──
interface PlanStore {
  template: PlanTemplate | null;
  phases: PlanPhase[];
  history: PlanHistory[];
  importTemplate: (name: string, phases: PlanTemplatePhase[]) => void;
  getTemplate: () => PlanTemplate | null;
  generateFromTemplate: (projectId: string, projectStartDate: string) => void;
  getByProject: (projectId: string) => PlanPhase[];
  addPhase: (projectId: string, phase: Omit<PlanPhase, 'id' | 'sortOrder'>) => void;
  addPhaseAfter: (afterId: string) => void;
  removePhase: (id: string) => void;
  updatePhaseDate: (id: string, field: 'startDate' | 'endDate' | 'duration', value: string | number) => void;
  updatePhaseTaskName: (id: string, taskName: string) => void;
  updatePhaseDescription: (id: string, description: string) => void;
  toggleLockStart: (id: string) => void;
  toggleLockEnd: (id: string) => void;
  toggleLink: (id: string) => void;
  addPhaseGroup: (projectId: string, phaseGroupName: string) => void;
  removePhaseGroup: (projectId: string, phaseGroupName: string) => void;
  updatePhaseGroupName: (projectId: string, oldName: string, newName: string) => void;
  confirmSave: (projectId: string) => void;
  saveHistory: (projectId: string, label: string) => void;
  loadHistory: (historyId: string) => string | null;
  getHistoryByProject: (projectId: string) => PlanHistory[];
  refreshStatuses: () => void;
  detectParallelAndCritical: () => void;
  load: () => Promise<void>;
}

// ── 默认模板 ──
const DEFAULT_TEMPLATE_PHASES: PlanTemplatePhase[] = [
  { phaseGroup: 'M1预研阶段', taskName: 'L1预研', startDate: '2026-01-01', endDate: '2026-01-08', duration: 7, parallelGroup: 'M1预研阶段', linked: true },
  { phaseGroup: 'M1预研阶段', taskName: 'L2详细需求', startDate: '2026-01-08', endDate: '2026-01-15', duration: 7, parallelGroup: 'M1预研阶段', linked: true },
  { phaseGroup: 'M1预研阶段', taskName: 'L3立项筹备', startDate: '2026-01-15', endDate: '2026-01-22', duration: 7, parallelGroup: 'M1预研阶段', linked: true },
  { phaseGroup: 'M2计划阶段', taskName: 'L4概要设计', startDate: '2026-01-22', endDate: '2026-01-29', duration: 7, parallelGroup: 'M2计划阶段', linked: true },
  { phaseGroup: 'M2计划阶段', taskName: 'L5开发计划', startDate: '2026-01-22', endDate: '2026-01-29', duration: 7, parallelGroup: 'M2计划阶段', linked: false },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6详细设计', startDate: '2026-01-29', endDate: '2026-03-05', duration: 35, parallelGroup: 'M3研发测试阶段', linked: true },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-1主板原理图', startDate: '2026-01-29', endDate: '2026-02-18', duration: 20, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L6详细设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-2Layout', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L6详细设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-3PCB洗板', startDate: '2026-01-29', endDate: '2026-03-05', duration: 35, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L6详细设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-4PCBA打板', startDate: '2026-01-29', endDate: '2026-02-05', duration: 7, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L6详细设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-5结构设计&投样', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L6详细设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-6散热设计&投样', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L6详细设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-7线缆设计&投样', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L6详细设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-8BIOS详细设计', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L6详细设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-9BMC详细设计', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L6详细设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L7Power On', startDate: '2026-03-05', endDate: '2026-03-10', duration: 5, parallelGroup: 'M3研发测试阶段', linked: true },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L8EVT', startDate: '2026-03-10', endDate: '2026-04-09', duration: 30, parallelGroup: 'M3研发测试阶段', linked: true },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9DVT', startDate: '2026-04-09', endDate: '2026-05-19', duration: 40, parallelGroup: 'M3研发测试阶段', linked: true },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-1组装评审', startDate: '2026-04-09', endDate: '2026-04-11', duration: 2, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L9DVT' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-2PI测试', startDate: '2026-04-09', endDate: '2026-05-09', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L9DVT' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-3SIV测试', startDate: '2026-04-09', endDate: '2026-05-09', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L9DVT' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-4SIT测试', startDate: '2026-04-09', endDate: '2026-05-09', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L9DVT' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-5可靠性测试', startDate: '2026-04-09', endDate: '2026-05-09', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L9DVT' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-6散热测试', startDate: '2026-04-09', endDate: '2026-05-09', duration: 30, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L9DVT' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-7A02设计', startDate: '2026-04-09', endDate: '2026-04-19', duration: 10, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L9DVT' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-8A02洗板&打板', startDate: '2026-04-09', endDate: '2026-05-19', duration: 40, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L9DVT' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-9Debug', startDate: '2026-04-09', endDate: '2026-04-23', duration: 14, parallelGroup: 'M3研发测试阶段', linked: false, parentTaskName: 'L9DVT' },
  { phaseGroup: 'M4试制阶段', taskName: 'L10批量测试', startDate: '2026-05-19', endDate: '2026-06-18', duration: 30, parallelGroup: 'M4试制阶段', linked: true },
  { phaseGroup: 'M5新品导入阶段', taskName: 'L11NPI导入', startDate: '2026-06-18', endDate: '2026-07-18', duration: 30, parallelGroup: 'M5新品导入阶段', linked: true },
  { phaseGroup: 'M5新品导入阶段', taskName: 'L12直通率爬坡', startDate: '2026-07-18', endDate: '2026-10-16', duration: 90, parallelGroup: 'M5新品导入阶段', linked: true },
];

// ── 创建 Store ──
export const usePlanStore = create<PlanStore>((set, get) => ({
  template: null,
  phases: [],
  history: [],

  // 从 IndexedDB 加载数据（如果为空，尝试从 localStorage 迁移）
  load: async () => {
    try {
      // 先尝试从 IndexedDB 加载
      let phases = await dbGetPlanPhases();
      
      // 如果 IndexedDB 为空，尝试从 localStorage 迁移
      if (!phases || phases.length === 0) {
        console.log('📦 IndexedDB 为空，尝试从 localStorage 迁移数据...');
        await migrateFromLocalStorage();
        phases = await dbGetPlanPhases();
      }
      
      if (phases && phases.length > 0) {
        set({ phases });
        console.log('✅ 计划数据已恢复，共', phases.length, '个任务');
      } else {
        console.log('ℹ️ 暂无计划数据');
      }
    } catch (e) {
      console.error('❌ 加载计划数据失败:', e);
    }
  },

  // 导入模板
  importTemplate: (name, phases) => {
    set({
      template: {
        name,
        phases: JSON.parse(JSON.stringify(phases)),
        importedAt: new Date().toISOString(),
      },
    });
  },

  // 获取当前模板
  getTemplate: () => {
    return get().template;
  },

  // 从模板生成计划
  generateFromTemplate: (projectId, projectStartDate) => {
    const { template } = get();
    const sourcePhases = template ? template.phases : DEFAULT_TEMPLATE_PHASES;
    const baseDate = dayjs(projectStartDate);

    const newPhases: PlanPhase[] = sourcePhases.map((tp, index) => {
      const templateStart = dayjs(tp.startDate);
      const templateEnd = dayjs(tp.endDate);
      const templateBase = dayjs('2026-01-01');
      const startOffset = templateStart.diff(templateBase, 'day');
      const duration = tp.duration;

      const startDate = fmt(baseDate.add(startOffset, 'day'));
      const endDate = fmt(baseDate.add(startOffset + duration, 'day'));

      // 查找父任务 ID
      let parentId: string | undefined = undefined;
      if (tp.parentTaskName) {
        const parentPhase = sourcePhases.find(p => p.taskName === tp.parentTaskName);
        if (parentPhase) {
          const parentIndex = sourcePhases.indexOf(parentPhase);
          // 父任务会在前面创建，所以这里先用 taskName 关联，后面再补 id
        }
      }

      return {
        id: generateId(),
        projectId,
        phaseGroup: tp.phaseGroup,
        taskName: tp.taskName,
        startDate,
        endDate,
        duration,
        lockStart: false,
        lockEnd: false,
        linked: tp.linked !== false,
        isCriticalPath: false,
        isParallel: false,
        parallelGroup: tp.parallelGroup || '',
        status: computeStatusFull(startDate, endDate),
        sortOrder: index,
        parentTaskName: tp.parentTaskName,
        description: tp.description || '',
      };
    });

    // 补上 parentId
    newPhases.forEach(phase => {
      if (phase.parentTaskName) {
        const parent = newPhases.find(p => p.taskName === phase.parentTaskName && !p.parentTaskName);
        if (parent) {
          phase.parentId = parent.id;
        }
      }
    });

    set({ phases: newPhases });
    // 自动保存
    dbSetPlanPhases(newPhases);
  },

  // 获取指定项目的计划
  getByProject: (projectId) => {
    return get().phases.filter(p => p.projectId === projectId);
  },

  // 添加新阶段
  addPhase: (projectId, phase) => {
    const { phases } = get();
    const newPhase: PlanPhase = {
      ...phase,
      id: generateId(),
      projectId,
      sortOrder: phases.length,
      isCriticalPath: false,
      isParallel: false,
      status: computeStatusFull(phase.startDate, phase.endDate),
    };
    const newPhases = [...phases, newPhase];
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 在指定任务后插入新任务（继承 parentId）
  addPhaseAfter: (afterId) => {
    const { phases } = get();
    const afterIndex = phases.findIndex(p => p.id === afterId);
    if (afterIndex === -1) return;

    const afterPhase = phases[afterIndex];
    const newPhase: PlanPhase = {
      id: generateId(),
      projectId: afterPhase.projectId,
      phaseGroup: afterPhase.phaseGroup,
      taskName: '新任务',
      startDate: afterPhase.endDate,
      endDate: fmt(dayjs(afterPhase.endDate).add(7, 'day')),
      duration: 7,
      lockStart: false,
      lockEnd: false,
      linked: true,
      isCriticalPath: false,
      isParallel: false,
      parallelGroup: afterPhase.parallelGroup,
      status: 'upcoming',
      sortOrder: afterIndex + 1,
      parentId: afterPhase.parentId, // 继承父任务 ID
      description: '',
    };

    const newPhases = [...phases];
    newPhases.splice(afterIndex + 1, 0, newPhase);
    // 重新排序
    newPhases.forEach((p, i) => p.sortOrder = i);

    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 删除阶段
  removePhase: (id) => {
    const { phases } = get();
    const newPhases = phases.filter(p => p.id !== id && p.parentId !== id);
    newPhases.forEach((p, i) => p.sortOrder = i);
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 更新阶段日期
  updatePhaseDate: (id, field, value) => {
    const { phases } = get();
    const newPhases = phases.map(p => {
      if (p.id !== id) return p;

      const updated = { ...p };
      if (field === 'startDate') {
        updated.startDate = value as string;
        if (!p.lockEnd) {
          updated.endDate = fmt(dayjs(value as string).add(p.duration, 'day'));
        }
      } else if (field === 'endDate') {
        if (!p.lockEnd) {
          updated.endDate = value as string;
          updated.duration = daysBetween(updated.startDate, value as string);
        }
      } else if (field === 'duration') {
        updated.duration = value as number;
        if (!p.lockEnd) {
          updated.endDate = fmt(dayjs(p.startDate).add(value as number, 'day'));
        }
      }
      updated.status = computeStatusFull(updated.startDate, updated.endDate);
      return updated;
    });

    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 更新任务名称
  updatePhaseTaskName: (id, taskName) => {
    const { phases } = get();
    const newPhases = phases.map(p => p.id === id ? { ...p, taskName } : p);
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 更新说明
  updatePhaseDescription: (id, description) => {
    const { phases } = get();
    const newPhases = phases.map(p => p.id === id ? { ...p, description } : p);
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 切换锁定开始日期
  toggleLockStart: (id) => {
    const { phases } = get();
    const newPhases = phases.map(p => p.id === id ? { ...p, lockStart: !p.lockStart } : p);
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 切换锁定结束日期
  toggleLockEnd: (id) => {
    const { phases } = get();
    const newPhases = phases.map(p => p.id === id ? { ...p, lockEnd: !p.lockEnd } : p);
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 切换关联
  toggleLink: (id) => {
    const { phases } = get();
    const newPhases = phases.map(p => p.id === id ? { ...p, linked: !p.linked } : p);
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 添加阶段分组
  addPhaseGroup: (projectId, phaseGroupName) => {
    const { phases } = get();
    const newPhase: PlanPhase = {
      id: generateId(),
      projectId,
      phaseGroup: phaseGroupName,
      taskName: '新任务',
      startDate: fmt(dayjs()),
      endDate: fmt(dayjs().add(7, 'day')),
      duration: 7,
      lockStart: false,
      lockEnd: false,
      linked: true,
      isCriticalPath: false,
      isParallel: false,
      parallelGroup: phaseGroupName,
      status: 'upcoming',
      sortOrder: phases.length,
      description: '',
    };
    const newPhases = [...phases, newPhase];
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 删除阶段分组
  removePhaseGroup: (projectId, phaseGroupName) => {
    const { phases } = get();
    const newPhases = phases.filter(p => !(p.projectId === projectId && p.phaseGroup === phaseGroupName));
    newPhases.forEach((p, i) => p.sortOrder = i);
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 更新阶段分组名称
  updatePhaseGroupName: (projectId, oldName, newName) => {
    const { phases } = get();
    const newPhases = phases.map(p => 
      p.projectId === projectId && p.phaseGroup === oldName 
        ? { ...p, phaseGroup: newName, parallelGroup: newName }
        : p
    );
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 保存当前计划（创建版本历史）
  confirmSave: (projectId) => {
    const { phases, history } = get();
    const projectPhases = phases.filter(p => p.projectId === projectId);
    const version = history.filter(h => h.projectId === projectId).length + 1;
    const newHistory: PlanHistory = {
      id: generateId(),
      projectId,
      version,
      label: `V${version}`,
      snapshot: JSON.parse(JSON.stringify(projectPhases)),
      createdAt: new Date().toISOString(),
    };
    const newHistoryList = [...history, newHistory];
    set({ history: newHistoryList });
  },

  // 保存历史版本
  saveHistory: (projectId, label) => {
    const { phases, history } = get();
    const projectPhases = phases.filter(p => p.projectId === projectId);
    const newHistory: PlanHistory = {
      id: generateId(),
      projectId,
      version: history.length + 1,
      label,
      snapshot: JSON.parse(JSON.stringify(projectPhases)),
      createdAt: new Date().toISOString(),
    };
    const newHistoryList = [...history, newHistory];
    set({ history: newHistoryList });
  },

  // 加载历史版本
  loadHistory: (historyId) => {
    const { history } = get();
    const record = history.find(h => h.id === historyId);
    if (!record) return null;
    return JSON.stringify(record.snapshot);
  },

  // 获取项目的历史版本
  getHistoryByProject: (projectId) => {
    return get().history.filter(h => h.projectId === projectId);
  },

  // 刷新所有任务状态
  refreshStatuses: () => {
    const { phases } = get();
    const newPhases = phases.map(p => ({
      ...p,
      status: computeStatusFull(p.startDate, p.endDate),
    }));
    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },

  // 检测并行任务和关键路径
  detectParallelAndCritical: () => {
    const { phases } = get();
    if (phases.length === 0) return;

    // 重置状态
    let newPhases = phases.map(p => ({ ...p, isParallel: false, isCriticalPath: false }));

    // 1. 检测并行任务（同一 parallelGroup 内有多个任务）
    const groupMap: Record<string, number[]> = {};
    newPhases.forEach((p, i) => {
      if (!groupMap[p.parallelGroup]) groupMap[p.parallelGroup] = [];
      groupMap[p.parallelGroup].push(i);
    });

    Object.values(groupMap).forEach(indices => {
      if (indices.length >= 2) {
        indices.forEach(i => newPhases[i].isParallel = true);
      }
    });

    // 2. 检测关键路径（使用时间窗口重叠聚类算法）
    // 找出所有 linked=true 的任务，按时间顺序连接
    const linkedPhases = newPhases.filter(p => p.linked);
    if (linkedPhases.length > 0) {
      // 按开始时间排序
      linkedPhases.sort((a, b) => dayjs(a.startDate).diff(dayjs(b.startDate)));

      // 时间窗口重叠聚类
      const clusters: number[][] = [];
      linkedPhases.forEach(lp => {
        const lpStart = dayjs(lp.startDate);
        const lpEnd = dayjs(lp.endDate);

        // 找重叠的聚类
        let overlappingCluster: number[] | null = null;
        for (const cluster of clusters) {
          const hasOverlap = cluster.some(idx => {
            const p = newPhases[idx];
            const pStart = dayjs(p.startDate);
            const pEnd = dayjs(p.endDate);
            return lpStart.isBefore(pEnd) && lpEnd.isAfter(pStart);
          });
          if (hasOverlap) {
            overlappingCluster = cluster;
            break;
          }
        }

        const lpIndex = newPhases.findIndex(p => p.id === lp.id);
        if (overlappingCluster) {
          overlappingCluster.push(lpIndex);
        } else {
          clusters.push([lpIndex]);
        }
      });

      // 每个聚类内找出耗时最长的路径作为关键路径
      clusters.forEach(cluster => {
        if (cluster.length <= 1) {
          newPhases[cluster[0]].isCriticalPath = true;
          return;
        }

        // 按开始时间排序
        cluster.sort((a, b) => dayjs(newPhases[a].startDate).diff(dayjs(newPhases[b].startDate)));

        // 找出总耗时最长的路径
        const dp: number[] = new Array(cluster.length).fill(0);
        const parent: number[] = new Array(cluster.length).fill(-1);

        for (let i = 0; i < cluster.length; i++) {
          dp[i] = newPhases[cluster[i]].duration;
        }

        for (let i = 1; i < cluster.length; i++) {
          for (let j = 0; j < i; j++) {
            const endJ = dayjs(newPhases[cluster[j]].endDate);
            const startI = dayjs(newPhases[cluster[i]].startDate);
            if (endJ.isSame(startI) || endJ.isBefore(startI)) {
              if (dp[j] + newPhases[cluster[i]].duration > dp[i]) {
                dp[i] = dp[j] + newPhases[cluster[i]].duration;
                parent[i] = j;
              }
            }
          }
        }

        // 找出瓶颈
        let maxIdx = 0;
        for (let i = 1; i < cluster.length; i++) {
          if (dp[i] > dp[maxIdx]) maxIdx = i;
        }

        // 回溯标记关键路径
        const criticalIndices = new Set<number>();
        let curr = maxIdx;
        while (curr !== -1) {
          criticalIndices.add(cluster[curr]);
          curr = parent[curr];
        }

        criticalIndices.forEach(idx => {
          newPhases[idx].isCriticalPath = true;
        });
      });
    }

    // 3. 级联更新 downstream linked 任务
    // 如果父任务结束日期变化，更新下游 linked 任务
    newPhases.forEach((phase, i) => {
      if (phase.linked && phase.parentId) {
        const parent = newPhases.find(p => p.id === phase.parentId);
        if (parent && dayjs(phase.startDate).isBefore(dayjs(parent.endDate))) {
          // 子任务开始日期跟随父任务结束日期
          newPhases[i].startDate = parent.endDate;
          newPhases[i].endDate = fmt(dayjs(parent.endDate).add(phase.duration, 'day'));
        }
      }
    });

    // 4. 级联更新 L10/L11/L12 等下游 linked 任务
    // 如果 linked=true 的任务结束日期变化，更新下一个 linked 任务
    for (let i = 0; i < newPhases.length - 1; i++) {
      const current = newPhases[i];
      const next = newPhases[i + 1];
      if (current.linked && next.linked) {
        if (dayjs(next.startDate).isBefore(dayjs(current.endDate))) {
          newPhases[i + 1].startDate = current.endDate;
          newPhases[i + 1].endDate = fmt(dayjs(current.endDate).add(next.duration, 'day'));
        }
      }
    }

    set({ phases: newPhases });
    dbSetPlanPhases(newPhases);
  },
}));

// 自动保存：每次 state 变化都写入 IndexedDB
usePlanStore.subscribe((state) => {
  if (state.phases.length > 0) {
    dbSetPlanPhases(state.phases);
  }
});
