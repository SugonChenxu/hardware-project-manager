import { create } from 'zustand';
import { message } from 'antd';
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

// ── 默认模板（M1~M5 里程碑）──
const DEFAULT_TEMPLATE_PHASES: PlanTemplatePhase[] = [
  { phaseGroup: 'M1预研阶段', taskName: 'L1预研', startDate: '2026-01-01', endDate: '2026-01-08', duration: 7, parallelGroup: 'L1', linked: true },
  { phaseGroup: 'M1预研阶段', taskName: 'L2详细需求', startDate: '2026-01-08', endDate: '2026-01-15', duration: 7, parallelGroup: 'L2', linked: true },
  { phaseGroup: 'M1预研阶段', taskName: 'L3立项筹备', startDate: '2026-01-15', endDate: '2026-01-22', duration: 7, parallelGroup: 'L3', linked: true },
  { phaseGroup: 'M2计划阶段', taskName: 'L4概要设计', startDate: '2026-01-22', endDate: '2026-01-29', duration: 7, parallelGroup: 'L4', linked: true },
  { phaseGroup: 'M2计划阶段', taskName: 'L5开发计划', startDate: '2026-01-22', endDate: '2026-01-29', duration: 7, parallelGroup: 'L5', linked: false },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-1主板原理图', startDate: '2026-01-29', endDate: '2026-02-18', duration: 20, parallelGroup: 'L6', linked: false, parentTaskName: 'L6并行设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-2 Layout', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'L6', linked: false, parentTaskName: 'L6并行设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-3 PCB洗板', startDate: '2026-01-29', endDate: '2026-03-05', duration: 35, parallelGroup: 'L6', linked: false, parentTaskName: 'L6并行设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-4 PCBA打板', startDate: '2026-01-29', endDate: '2026-02-05', duration: 7, parallelGroup: 'L6', linked: false, parentTaskName: 'L6并行设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-5 结构设计&投样', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'L6', linked: false, parentTaskName: 'L6并行设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-6 散热设计&投样', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'L6', linked: false, parentTaskName: 'L6并行设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-7 线缆设计&投样', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'L6', linked: false, parentTaskName: 'L6并行设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-8 BIOS详细设计', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'L6', linked: false, parentTaskName: 'L6并行设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L6-9 BMC详细设计', startDate: '2026-01-29', endDate: '2026-02-28', duration: 30, parallelGroup: 'L6', linked: false, parentTaskName: 'L6并行设计' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L7 Power On', startDate: '2026-03-05', endDate: '2026-03-10', duration: 5, parallelGroup: 'L7', linked: true },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L8 EVT', startDate: '2026-03-10', endDate: '2026-04-09', duration: 30, parallelGroup: 'L8', linked: true },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-1 组装评审', startDate: '2026-04-09', endDate: '2026-04-11', duration: 2, parallelGroup: 'L9', linked: false, parentTaskName: 'L9并行测试' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-2 PI测试', startDate: '2026-04-09', endDate: '2026-05-09', duration: 30, parallelGroup: 'L9', linked: false, parentTaskName: 'L9并行测试' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-3 SIV测试', startDate: '2026-04-09', endDate: '2026-05-09', duration: 30, parallelGroup: 'L9', linked: false, parentTaskName: 'L9并行测试' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-4 SIT测试', startDate: '2026-04-09', endDate: '2026-05-09', duration: 30, parallelGroup: 'L9', linked: false, parentTaskName: 'L9并行测试' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-5 可靠性测试', startDate: '2026-04-09', endDate: '2026-05-09', duration: 30, parallelGroup: 'L9', linked: false, parentTaskName: 'L9并行测试' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-6 散热测试', startDate: '2026-04-09', endDate: '2026-05-09', duration: 30, parallelGroup: 'L9', linked: false, parentTaskName: 'L9并行测试' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-7 A02设计', startDate: '2026-04-09', endDate: '2026-04-19', duration: 10, parallelGroup: 'L9', linked: false, parentTaskName: 'L9并行测试' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-8 A02洗板&打板', startDate: '2026-04-09', endDate: '2026-05-19', duration: 40, parallelGroup: 'L9', linked: false, parentTaskName: 'L9并行测试' },
  { phaseGroup: 'M3研发测试阶段', taskName: 'L9-9 Debug', startDate: '2026-04-09', endDate: '2026-04-23', duration: 14, parallelGroup: 'L9', linked: false, parentTaskName: 'L9并行测试' },
  { phaseGroup: 'M4试制阶段', taskName: 'L10 批量测试', startDate: '2026-05-19', endDate: '2026-06-18', duration: 30, parallelGroup: 'L10', linked: true },
  { phaseGroup: 'M5新品导入阶段', taskName: 'L11 NPI导入', startDate: '2026-06-18', endDate: '2026-07-18', duration: 30, parallelGroup: 'L11', linked: true },
  { phaseGroup: 'M5新品导入阶段', taskName: 'L12 直通率爬坡', startDate: '2026-07-18', endDate: '2026-10-16', duration: 90, parallelGroup: 'L12', linked: true },
];

// ── Store 接口 ──
interface PlanStore {
  template: PlanTemplate | null;
  phases: PlanPhase[];
  history: PlanHistory[];
  isDirty: boolean;
  savedPhases: PlanPhase[];
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
  discardChanges: () => void;
  saveHistory: (projectId: string, label: string) => void;
  loadHistory: (historyId: string) => string | null;
  getHistoryByProject: (projectId: string) => PlanHistory[];
  refreshStatuses: () => void;
  detectParallelAndCritical: () => void;
  load: () => Promise<void>;
  debug: () => void;
}

const usePlanStore = create<PlanStore>((set, get) => ({
  template: null,
  phases: [],
  history: [],
  isDirty: false,
  savedPhases: [],

  // 导入模板
  importTemplate: (name, phases) => {
    set({ 
      template: { name, phases, importedAt: new Date().toISOString() },
      isDirty: true 
    });
  },

  // 获取模板
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

    set({ phases: newPhases, isDirty: true });
    // 不自动保存，等待用户点击"确认保存"
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
    set({ phases: newPhases, isDirty: true });
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
      parentId: afterPhase.parentId,
      description: '',
    };

    const newPhases = [...phases];
    newPhases.splice(afterIndex + 1, 0, newPhase);
    newPhases.forEach((p, i) => p.sortOrder = i);

    set({ phases: newPhases, isDirty: true });
  },

  // 删除阶段
  removePhase: (id) => {
    const { phases } = get();
    const phaseToRemove = phases.find(p => p.id === id);
    if (phaseToRemove?.lockEnd) {
      message.warning('该任务已锁定，无法删除');
      return;
    }
    const newPhases = phases.filter(p => p.id !== id && p.parentId !== id);
    newPhases.forEach((p, i) => p.sortOrder = i);
    set({ phases: newPhases, isDirty: true });
  },

  // 更新阶段日期
  updatePhaseDate: (id, field, value) => {
    const { phases } = get();
    let newPhases = phases.map(p => {
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
        if (!p.lockEnd) {
          updated.duration = value as number;
          updated.endDate = fmt(dayjs(p.startDate).add(value as number, 'day'));
        }
      }
      updated.status = computeStatusFull(updated.startDate, updated.endDate);
      return updated;
    });
    
    // 智能日期推算：如果当前任务是父任务，自动更新子任务的开始日期
    const updatedPhase = newPhases.find(p => p.id === id);
    if (updatedPhase && field === 'startDate') {
      // 找到所有子任务（parentId === id）
      newPhases = newPhases.map(p => {
        if (p.parentId === id) {
          // 子任务开始日期与父任务一致
          const newStart = updatedPhase.startDate;
          let newEnd = p.endDate;
          if (!p.lockEnd) {
            newEnd = fmt(dayjs(newStart).add(p.duration, 'day'));
          }
          return {
            ...p,
            startDate: newStart,
            endDate: newEnd,
            status: computeStatusFull(newStart, newEnd),
          };
        }
        return p;
      });
    }
    
    set({ phases: newPhases, isDirty: true });
  },

  // 更新任务名称
  updatePhaseTaskName: (id, taskName) => {
    const { phases } = get();
    const newPhases = phases.map(p => p.id === id ? { ...p, taskName } : p);
    set({ phases: newPhases, isDirty: true });
  },

  // 更新说明
  updatePhaseDescription: (id, description) => {
    const { phases } = get();
    const newPhases = phases.map(p => p.id === id ? { ...p, description } : p);
    set({ phases: newPhases, isDirty: true });
  },

  // 切换开始日期锁定
  toggleLockStart: (id) => {
    const { phases } = get();
    const newPhases = phases.map(p => p.id === id ? { ...p, lockStart: !p.lockStart } : p);
    set({ phases: newPhases, isDirty: true });
  },

  // 切换结束日期锁定
  toggleLockEnd: (id) => {
    const { phases } = get();
    const newPhases = phases.map(p => p.id === id ? { ...p, lockEnd: !p.lockEnd } : p);
    set({ phases: newPhases, isDirty: true });
  },

  // 切换任务关联
  toggleLink: (id) => {
    const { phases } = get();
    const newPhases = phases.map(p => p.id === id ? { ...p, linked: !p.linked } : p);
    set({ phases: newPhases, isDirty: true });
  },

  // 添加大阶段
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
    set({ phases: [...phases, newPhase], isDirty: true });
  },

  // 删除大阶段
  removePhaseGroup: (projectId, phaseGroupName) => {
    const { phases } = get();
    const newPhases = phases.filter(p => !(p.projectId === projectId && p.phaseGroup === phaseGroupName));
    set({ phases: newPhases, isDirty: true });
  },

  // 重命名大阶段
  updatePhaseGroupName: (projectId, oldName, newName) => {
    const { phases } = get();
    const newPhases = phases.map(p => 
      p.projectId === projectId && p.phaseGroup === oldName 
        ? { ...p, phaseGroup: newName } 
        : p
    );
    set({ phases: newPhases, isDirty: true });
  },

  // 确认保存
  confirmSave: (projectId) => {
    const { phases, saveHistory } = get();
    console.log('💾 confirmSave() 被调用');
    console.log('💾 当前 phases:', phases.length, '个任务');
    console.log('💾 projectId:', projectId);
    
    // 创建历史版本
    saveHistory(projectId, `版本 ${new Date().toLocaleString('zh-CN')}`);
    
    // 保存到 IndexedDB
    console.log('💾 正在调用 dbSetPlanPhases...');
    dbSetPlanPhases(phases).then(() => {
      console.log('✅ dbSetPlanPhases 完成');
    }).catch(e => {
      console.error('❌ dbSetPlanPhases 失败:', e);
    });
    
    // 标记干净
    set({ isDirty: false, savedPhases: JSON.parse(JSON.stringify(phases)) });
    message.success('保存成功');
    console.log('✅ confirmSave() 完成，isDirty = false');
  },

  // 丢弃修改
  discardChanges: () => {
    const { savedPhases } = get();
    if (savedPhases.length > 0) {
      set({ phases: JSON.parse(JSON.stringify(savedPhases)), isDirty: false });
      message.info('已撤销修改');
    }
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
    set({ phases: newPhases, isDirty: true });
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

    // 2. 检测关键路径（同级任务中，结束时间最晚的标记为关键路径）
    // 按 parallelGroup 分组，找出每个组中结束时间最晚的任务
    Object.values(groupMap).forEach(indices => {
      if (indices.length < 2) {
        // 只有一个任务，标记为关键路径
        newPhases[indices[0]].isCriticalPath = true;
        return;
      }
      
      // 找出结束时间最晚的任务
      let maxIdx = indices[0];
      for (const i of indices) {
        if (dayjs(newPhases[i].endDate).isAfter(dayjs(newPhases[maxIdx].endDate))) {
          maxIdx = i;
        } else if (dayjs(newPhases[i].endDate).isSame(dayjs(newPhases[maxIdx].endDate))) {
          // 结束时间相同，选择周期最长的
          if (newPhases[i].duration > newPhases[maxIdx].duration) {
            maxIdx = i;
          }
        }
      }
      newPhases[maxIdx].isCriticalPath = true;
    });

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

    set({ phases: newPhases, isDirty: true });
  },

  // 从 IndexedDB 加载数据
  load: async () => {
    try {
      console.log('📖 usePlanStore.load() 开始加载...');
      
      // 先尝试从 localStorage 迁移
      await migrateFromLocalStorage();
      
      // 从 IndexedDB 加载
      const phases = await dbGetPlanPhases();
      console.log('📖 dbGetPlanPhases 返回:', phases ? phases.length + '个任务' : '无数据');
      
      if (phases && phases.length > 0) {
        set({ phases, savedPhases: JSON.parse(JSON.stringify(phases)), isDirty: false });
        console.log('✅ 计划数据已从 IndexedDB 恢复，共', phases.length, '个任务');
        console.log('✅ 数据详情:', phases);
        console.log('✅ 所有任务的 projectId:', [...new Set(phases.map(p => p.projectId))]);
      } else {
        console.log('⚠️ 计划数据为空，保持默认状态');
      }
    } catch (e) {
      console.error('❌ 加载计划数据失败:', e);
    }
  },

  // 调试函数：打印当前状态
  debug: () => {
    const state = get();
    console.log('🔍 ===== 计划Store调试信息 =====');
    console.log('📦 phases (全部):', state.phases.length, '个任务');
    console.log('📦 savedPhases:', state.savedPhases.length, '个任务');
    console.log('📦 isDirty:', state.isDirty);
    console.log('📦 所有任务的 projectId:', [...new Set(state.phases.map(p => p.projectId))]);
    console.log('🔍 ===========================');
  },
}));

// 自动保存：每次 state 变化都写入 IndexedDB（带防抖）
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
usePlanStore.subscribe((state) => {
  if (state.phases.length > 0) {
    // 防抖：延迟 500ms 保存，避免频繁写入
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      dbSetPlanPhases(state.phases).then(() => {
        console.log('💾 自动保存完成，共', state.phases.length, '个任务');
      }).catch(e => {
        console.error('❌ 自动保存失败:', e);
      });
    }, 500);
  }
});

export default usePlanStore;
