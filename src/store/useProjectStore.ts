import { create } from 'zustand';
import { Project } from '../types';
import { generateId } from '../utils/storage';
import { dbGet, dbSet, migrateFromLocalStorage } from '../utils/db';

interface ProjectStore {
  projects: Project[];
  currentProjectId: string | null;
  load: () => Promise<void>;
  add: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Project;
  update: (id: string, data: Partial<Project>) => void;
  remove: (id: string) => void;
  setCurrent: (id: string | null) => void;
  getCurrent: () => Project | undefined;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,

  load: async () => {
    try {
      let projects = await dbGet<Project[]>('projects', []);
      let currentProjectId = await dbGet<string | null>('currentProjectId', null);
      
      // 如果 IndexedDB 为空，尝试从 localStorage 迁移
      if ((!projects || projects.length === 0) && !currentProjectId) {
        console.log('📦 项目数据：IndexedDB 为空，尝试从 localStorage 迁移...');
        await migrateFromLocalStorage();
        projects = await dbGet<Project[]>('projects', []);
        currentProjectId = await dbGet<string | null>('currentProjectId', null);
      }
      
      // 🔧 修复：如果 currentProjectId 无效，自动选择第一个项目
      if (projects.length > 0) {
        // 检查 currentProjectId 是否有效
        const validProject = projects.find(p => p.id === currentProjectId);
        if (!validProject) {
          currentProjectId = projects[0].id;
          console.log('📌 自动选择项目:', projects[0].name, '(ID:', currentProjectId + ')');
          // 保存选择
          await dbSet('currentProjectId', currentProjectId);
        }
      } else {
        currentProjectId = null;
      }
      
      set({ projects, currentProjectId });
      console.log('✅ 项目数据已加载，共', projects.length, '个项目，当前项目:', currentProjectId);
    } catch (e) {
      console.error('❌ 加载项目数据失败:', e);
    }
  },

  add: (data) => {
    const now = new Date().toISOString();
    const project: Project = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const projects = [...get().projects, project];
    set({ projects, currentProjectId: project.id });
    // 异步保存
    dbSet('projects', projects);
    dbSet('currentProjectId', project.id);
    return project;
  },

  update: (id, data) => {
    const projects = get().projects.map((p) =>
      p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
    );
    dbSet('projects', projects);
    set({ projects });
  },

  remove: (id) => {
    const projects = get().projects.filter((p) => p.id !== id);
    const currentProjectId = get().currentProjectId === id ? null : get().currentProjectId;
    dbSet('projects', projects);
    dbSet('currentProjectId', currentProjectId);
    set({ projects, currentProjectId });
  },

  setCurrent: (id) => {
    set({ currentProjectId: id });
    dbSet('currentProjectId', id);
  },

  getCurrent: () => {
    return get().projects.find((p) => p.id === get().currentProjectId);
  },
}));

// 自动保存：监听 state 变化
useProjectStore.subscribe((state) => {
  dbSet('projects', state.projects);
  dbSet('currentProjectId', state.currentProjectId);
});
