import { create } from 'zustand';
import { PlanPhase, PlanTemplate, PlanHistory, TaskLevel } from '@/types';
import dayjs from 'dayjs';

// 默认模板（M1~M5 标准里程碑，含父子任务）
const DEFAULT_TEMPLATE: PlanTemplate = {
  name: 'M1~M5 标准里程碑模板',
  importedAt: dayjs().format('YYYY-MM-DD'),
  phases: [
    // M1 预研阶段
    { phaseGroup: 'M1预研阶段', taskName: 'L1预研', duration: 7, parallelGroup: '', level: 'parent' },
    { phaseGroup: 'M1预研阶段', taskName: 'L1.1 需求分析', duration: 3, parallelGroup: '', level: 'child', parentName: 'L1预研' },
    { phaseGroup: 'M1预研阶段', taskName: 'L1.2 可行性研究', duration: 4, parallelGroup: '', level: 'child', parentName: 'L1预研' },
    { phaseGroup: 'M1预研阶段', taskName: 'L2详细需求', duration: 7, parallelGroup: '', level: 'parent' },
    { phaseGroup: 'M1预研阶段', taskName: 'L3立项筹备', duration: 7, parallelGroup: '', level: 'parent' },
    
    // M2 计划阶段
    { phaseGroup: 'M2计划阶段', taskName: 'L4概要设计', duration: 7, parallelGroup: '', level: 'parent' },
    { phaseGroup: 'M2计划阶段', taskName: 'L5开发计划', duration: 7, parallelGroup: 'M2', level: 'parent' },
    
    // M3 研发测试阶段 - L6 有子任务
    { phaseGroup: 'M3研发测试阶段', taskName: 'L6 详细设计', duration: 35, parallelGroup: 'L6', level: 'parent', parentName: '' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L6-1 主板原理图', duration: 20, parallelGroup: 'L6', level: 'child', parentName: 'L6 详细设计' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L6-2 Layout', duration: 30, parallelGroup: 'L6', level: 'child', parentName: 'L6 详细设计' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L6-3 PCB洗板', duration: 35, parallelGroup: 'L6', level: 'child', parentName: 'L6 详细设计' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L6-4 PCBA打板', duration: 7, parallelGroup: 'L6', level: 'child', parentName: 'L6 详细设计' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L6-5 结构设计&投样', duration: 30, parallelGroup: 'L6', level: 'child', parentName: 'L6 详细设计' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L6-6 散热设计&投样', duration: 30, parallelGroup: 'L6', level: 'child', parentName: 'L6 详细设计' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L6-7 线缆设计&投样', duration: 30, parallelGroup: 'L6', level: 'child', parentName: 'L6 详细设计' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L6-8 BIOS详细设计', duration: 30, parallelGroup: 'L6', level: 'child', parentName: 'L6 详细设计' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L6-9 BMC详细设计', duration: 30, parallelGroup: 'L6', level: 'child', parentName: 'L6 详细设计' },
    
    { phaseGroup: 'M3研发测试阶段', taskName: 'L7 Power On', duration: 5, parallelGroup: '', level: 'parent' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L8 EVT', duration: 30, parallelGroup: '', level: 'parent' },
    
    // L9 有子任务
    { phaseGroup: 'M3研发测试阶段', taskName: 'L9 验证测试', duration: 40, parallelGroup: 'L9', level: 'parent' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L9-1 组装评审', duration: 2, parallelGroup: 'L9', level: 'child', parentName: 'L9 验证测试' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L9-2 PI测试', duration: 30, parallelGroup: 'L9', level: 'child', parentName: 'L9 验证测试' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L9-3 SIV测试', duration: 30, parallelGroup: 'L9', level: 'child', parentName: 'L9 验证测试' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L9-4 SIT测试', duration: 30, parallelGroup: 'L9', level: 'child', parentName: 'L9 验证测试' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L9-5 可靠性测试', duration: 30, parallelGroup: 'L9', level: 'child', parentName: 'L9 验证测试' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L9-6 散热测试', duration: 30, parallelGroup: 'L9', level: 'child', parentName: 'L9 验证测试' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L9-7 A02设计', duration: 10, parallelGroup: 'L9', level: 'child', parentName: 'L9 验证测试' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L9-8 A02洗板&打板', duration: 40, parallelGroup: 'L9', level: 'child', parentName: 'L9 验证测试' },
    { phaseGroup: 'M3研发测试阶段', taskName: 'L9-9 Debug', duration: 14, parallelGroup: 'L9', level: 'child', parentName: 'L9 验证测试' },
    
    // M4 试制阶段
    { phaseGroup: 'M4试制阶段', taskName: 'L10 批量测试', duration: 30, parallelGroup: '', level: 'parent' },
    
    // M5 新品导入阶段
    { phaseGroup: 'M5新品导入阶段', taskName: 'L11 NPI导入', duration: 30, parallelGroup: '', level: 'parent' },
    { phaseGroup: 'M5新品导入阶段', taskName: 'L12 直通率爬坡', duration: 90, parallelGroup: '', level: 'parent' },
  ],
};

interface PlanStore {
  phases: PlanPhase[];
  template: PlanTemplate;
  history: PlanHistory[];
  isDirty: boolean;
  currentProjectId: string | null;

  setCurrentProject: (projectId: string) => void;
  createPlan: (projectId: string) => void;
  addPhase: (phaseGroup: string, parentId?: string) => void;
  updatePhase: (id: string, updates: Partial<PlanPhase>) => void;
  deletePhase: (id: string) => void;
  insertPhase: (afterId: string) => void;
  toggleLockStart: (id: string) => void;
  toggleLockEnd: (id: string) => void;
  toggleLinked: (id: string) => void;
  save: () => void;
  undo: () => void;
  loadFromHistory: (historyId: string) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const calculateStatus = (startDate: string, endDate: string): PlanPhase['status'] => {
  const today = dayjs().format('YYYY-MM-DD');
  if (endDate < today) return 'completed';
  if (startDate <= today && today <= endDate) return 'in_progress';
  return 'upcoming';
};

// 从 localStorage 加载
const loadPhases = (): PlanPhase[] => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('plan_phases');
  return saved ? JSON.parse(saved) : [];
};

const loadTemplate = (): PlanTemplate => {
  if (typeof window === 'undefined') return DEFAULT_TEMPLATE;
  const saved = localStorage.getItem('plan_template');
  return saved ? JSON.parse(saved) : DEFAULT_TEMPLATE;
};

const loadHistory = (): PlanHistory[] => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('plan_history');
  return saved ? JSON.parse(saved) : [];
};

export const usePlanStore = create<PlanStore>((set, get) => ({
  phases: loadPhases(),
  template: loadTemplate(),
  history: loadHistory(),
  isDirty: false,
  currentProjectId: null,

  setCurrentProject: (projectId) => {
    set({ currentProjectId: projectId });
    const saved = localStorage.getItem(`plan_phases_${projectId}`);
    if (saved) {
      set({ phases: JSON.parse(saved) });
    }
  },

  createPlan: (projectId) => {
    const { template } = get();
    const today = dayjs();
    const phases: PlanPhase[] = [];
    let currentDate = today;
    let parentStack: { [key: string]: PlanPhase } = {};

    template.phases.forEach((templatePhase, index) => {
      if (templatePhase.level === 'parent') {
        // 父任务
        const startDate = currentDate.format('YYYY-MM-DD');
        const endDate = currentDate.add(templatePhase.duration, 'day').format('YYYY-MM-DD');
        
        const phase: PlanPhase = {
          id: generateId(),
          projectId,
          phaseGroup: templatePhase.phaseGroup,
          taskName: templatePhase.taskName,
          startDate,
          endDate,
          duration: templatePhase.duration,
          lockStart: false,
          lockEnd: false,
          linked: true,
          isCriticalPath: false,
          isParallel: !!templatePhase.parallelGroup,
          parallelGroup: templatePhase.parallelGroup,
          status: calculateStatus(startDate, endDate),
          sortOrder: index,
          level: 'parent',
          isParentWithChildren: false, // 暂时，后面会更新
          children: [],
        };
        
        phases.push(phase);
        parentStack[templatePhase.taskName] = phase;
        
        // 如果不是并行任务，更新 currentDate
        if (!templatePhase.parallelGroup) {
          currentDate = currentDate.add(templatePhase.duration, 'day');
        }
      } else if (templatePhase.level === 'child') {
        // 子任务
        const parent = parentStack[templatePhase.parentName || ''];
        const startDate = currentDate.format('YYYY-MM-DD');
        const endDate = currentDate.add(templatePhase.duration, 'day').format('YYYY-MM-DD');
        
        const phase: PlanPhase = {
          id: generateId(),
          projectId,
          phaseGroup: templatePhase.phaseGroup,
          taskName: templatePhase.taskName,
          startDate,
          endDate,
          duration: templatePhase.duration,
          lockStart: false,
          lockEnd: false,
          linked: false, // 子任务默认独立
          isCriticalPath: false,
          isParallel: !!templatePhase.parallelGroup,
          parallelGroup: templatePhase.parallelGroup,
          status: calculateStatus(startDate, endDate),
          sortOrder: index,
          level: 'child',
          parentId: parent?.id,
        };
        
        phases.push(phase);
        
        // 更新父任务的 children 列表
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(phase.id);
          parent.isParentWithChildren = true;
        }
        
        // 如果是并行组内最后一个任务，更新 currentDate
        if (templatePhase.parallelGroup) {
          const groupTasks = template.phases.filter(p => p.parallelGroup === templatePhase.parallelGroup);
          const lastTask = groupTasks[groupTasks.length - 1];
          if (templatePhase === lastTask) {
            // 找到组内最晚结束的日期
            const groupPhases = phases.filter(p => p.parallelGroup === templatePhase.parallelGroup);
            const latestEndDate = groupPhases.reduce((latest, p) => 
              dayjs(p.endDate).isAfter(dayjs(latest)) ? p.endDate : latest, 
              groupPhases[0].endDate
            );
            currentDate = dayjs(latestEndDate);
          }
        } else {
          currentDate = currentDate.add(templatePhase.duration, 'day');
        }
      }
    });

    set({ phases, isDirty: true, currentProjectId: projectId });
  },

  addPhase: (phaseGroup, parentId) => {
    set((state) => {
      const newPhase: PlanPhase = {
        id: generateId(),
        projectId: state.currentProjectId || '',
        phaseGroup,
        taskName: '新任务',
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
        duration: 7,
        lockStart: false,
        lockEnd: false,
        linked: !parentId,
        isCriticalPath: false,
        isParallel: false,
        parallelGroup: '',
        status: 'upcoming',
        sortOrder: state.phases.length,
        level: parentId ? 'child' : 'parent',
        parentId,
      };
      
      const newPhases = [...state.phases, newPhase];
      
      // 如果添加到父任务下，更新父任务的 children
      if (parentId) {
        const parentIndex = newPhases.findIndex(p => p.id === parentId);
        if (parentIndex !== -1) {
          if (!newPhases[parentIndex].children) newPhases[parentIndex].children = [];
          newPhases[parentIndex].children!.push(newPhase.id);
          newPhases[parentIndex].isParentWithChildren = true;
        }
      }
      
      return { phases: newPhases, isDirty: true };
    });
  },

  updatePhase: (id, updates) => {
    set((state) => {
      let newPhases = [...state.phases];
      const phaseIndex = newPhases.findIndex(p => p.id === id);
      if (phaseIndex === -1) return state;
      
      let phase = { ...newPhases[phaseIndex] };
      
      // 如果任务被锁定，拒绝修改
      if (updates.startDate !== undefined && phase.lockStart) {
        alert('开始日期已锁定，无法修改');
        return state;
      }
      if (updates.endDate !== undefined && phase.lockEnd) {
        alert('结束日期已锁定，无法修改');
        return state;
      }
      
      // 处理日期逻辑
      if (updates.startDate !== undefined) {
        // 修改开始日期：周期不变，结束日期 = 开始日期 + 周期
        phase.startDate = updates.startDate;
        phase.endDate = dayjs(updates.startDate).add(phase.duration, 'day').format('YYYY-MM-DD');
        updates.endDate = phase.endDate;
      } else if (updates.endDate !== undefined) {
        // 修改结束日期：开始日期不变，周期 = 结束日期 - 开始日期
        phase.endDate = updates.endDate;
        phase.duration = dayjs(updates.endDate).diff(dayjs(phase.startDate), 'day');
        updates.duration = phase.duration;
      } else if (updates.duration !== undefined) {
        // 修改周期：开始日期不变，结束日期 = 开始日期 + 新周期
        phase.duration = updates.duration;
        phase.endDate = dayjs(phase.startDate).add(updates.duration, 'day').format('YYYY-MM-DD');
        updates.endDate = phase.endDate;
      }
      
      // 应用更新
      newPhases[phaseIndex] = { ...phase, ...updates };
      
      // 级联更新后续关联任务
      if (updates.startDate !== undefined || updates.endDate !== undefined || updates.duration !== undefined) {
        newPhases = cascadeUpdate(newPhases, phaseIndex);
      }
      
      // 更新父任务的日期（如果有子任务）
      newPhases = updateParentDates(newPhases);
      
      // 重新计算状态
      newPhases = newPhases.map(p => ({
        ...p,
        status: calculateStatus(p.startDate, p.endDate),
      }));
      
      return { phases: newPhases, isDirty: true };
    });
  },

  deletePhase: (id) => {
    set((state) => {
      const phase = state.phases.find(p => p.id === id);
      if (!phase) return state;
      
      // 检查是否可以删除
      if (phase.lockEnd) {
        alert('结束日期已锁定，无法删除');
        return state;
      }
      
      let newPhases = state.phases.filter(p => p.id !== id);
      
      // 如果是父任务，也删除所有子任务
      if (phase.children) {
        newPhases = newPhases.filter(p => !phase.children!.includes(p.id));
      }
      
      // 如果删除的是子任务，更新父任务的 children
      if (phase.parentId) {
        const parentIndex = newPhases.findIndex(p => p.id === phase.parentId);
        if (parentIndex !== -1) {
          newPhases[parentIndex].children = newPhases[parentIndex].children!.filter(cid => cid !== id);
          if (newPhases[parentIndex].children!.length === 0) {
            newPhases[parentIndex].isParentWithChildren = false;
          }
        }
      }
      
      return { phases: newPhases, isDirty: true };
    });
  },

  insertPhase: (afterId) => {
    set((state) => {
      const afterIndex = state.phases.findIndex(p => p.id === afterId);
      const afterPhase = state.phases[afterIndex];
      
      const newPhase: PlanPhase = {
        id: generateId(),
        projectId: state.currentProjectId || '',
        phaseGroup: afterPhase.phaseGroup,
        taskName: '新任务',
        startDate: afterPhase.endDate,
        endDate: dayjs(afterPhase.endDate).add(7, 'day').format('YYYY-MM-DD'),
        duration: 7,
        lockStart: false,
        lockEnd: false,
        linked: true,
        isCriticalPath: false,
        isParallel: false,
        parallelGroup: '',
        status: 'upcoming',
        sortOrder: afterIndex + 1,
        level: 'parent',
      };
      
      const newPhases = [...state.phases];
      newPhases.splice(afterIndex + 1, 0, newPhase);
      newPhases.forEach((p, idx) => { p.sortOrder = idx; });
      
      return { phases: newPhases, isDirty: true };
    });
  },

  toggleLockStart: (id) => {
    set((state) => ({
      phases: state.phases.map(p => 
        p.id === id ? { ...p, lockStart: !p.lockStart } : p
      ),
      isDirty: true,
    }));
  },

  toggleLockEnd: (id) => {
    set((state) => ({
      phases: state.phases.map(p => 
        p.id === id ? { ...p, lockEnd: !p.lockEnd } : p
      ),
      isDirty: true,
    }));
  },

  toggleLinked: (id) => {
    set((state) => ({
      phases: state.phases.map(p => 
        p.id === id ? { ...p, linked: !p.linked } : p
      ),
      isDirty: true,
    }));
  },

  save: () => {
    const { phases, currentProjectId, history } = get();
    if (currentProjectId) {
      localStorage.setItem(`plan_phases_${currentProjectId}`, JSON.stringify(phases));
    }
    localStorage.setItem('plan_phases', JSON.stringify(phases));
    
    const newHistory: PlanHistory = {
      id: generateId(),
      projectId: currentProjectId || '',
      version: history.length + 1,
      label: `版本 ${history.length + 1} - ${dayjs().format('YYYY-MM-DD HH:mm')}`,
      snapshot: JSON.parse(JSON.stringify(phases)),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    };
    const newHistories = [...history, newHistory];
    localStorage.setItem('plan_history', JSON.stringify(newHistories));
    
    set({ isDirty: false, history: newHistories });
  },

  undo: () => {
    const saved = localStorage.getItem('plan_phases');
    if (saved) {
      set({ phases: JSON.parse(saved), isDirty: false });
    }
  },

  loadFromHistory: (historyId) => {
    const { history } = get();
    const target = history.find(h => h.id === historyId);
    if (target) {
      set({ phases: target.snapshot, isDirty: true });
    }
  },
}));

// 级联更新后续关联任务
function cascadeUpdate(phases: PlanPhase[], changedIndex: number): PlanPhase[] {
  const changedPhase = phases[changedIndex];
  if (!changedPhase) return phases;
  
  // 找到下一个关联的任务
  for (let i = changedIndex + 1; i < phases.length; i++) {
    const nextPhase = phases[i];
    
    // 如果下一个任务关联，更新其开始日期
    if (nextPhase.linked && !nextPhase.lockStart) {
      nextPhase.startDate = changedPhase.endDate;
      nextPhase.endDate = dayjs(nextPhase.startDate).add(nextPhase.duration, 'day').format('YYYY-MM-DD');
      
      // 继续级联
      changedPhase.endDate = nextPhase.endDate;
      phases = cascadeUpdate(phases, i);
    } else {
      // 不关联或已锁定，停止级联
      break;
    }
  }
  
  return phases;
}

// 更新父任务的日期（基于子任务）
function updateParentDates(phases: PlanPhase[]): PlanPhase[] {
  phases.forEach(phase => {
    if (phase.level === 'parent' && phase.children && phase.children.length > 0) {
      const children = phases.filter(p => phase.children!.includes(p.id));
      if (children.length > 0) {
        const earliestStart = children.reduce((earliest, c) => 
          dayjs(c.startDate).isBefore(dayjs(earliest)) ? c.startDate : earliest,
          children[0].startDate
        );
        const latestEnd = children.reduce((latest, c) => 
          dayjs(c.endDate).isAfter(dayjs(latest)) ? c.endDate : latest,
          children[0].endDate
        );
        
        phase.startDate = earliestStart;
        phase.endDate = latestEnd;
        phase.duration = dayjs(latestEnd).diff(dayjs(earliestStart), 'day');
      }
    }
  });
  
  return phases;
}
