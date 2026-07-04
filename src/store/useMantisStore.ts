import { create } from 'zustand';
import { dbGet, dbSet } from '../utils/db';
import { generateId } from '../utils/storage';

export interface MantisProject {
  id: string;
  name: string;
}

interface MantisStore {
  cookie: string;
  projectId: string;          // alias for currentProjectId（兼容旧代码）
  projects: MantisProject[];  // 已保存的项目列表（含手动添加 + 远程拉取）
  dateFrom: string;
  dateTo: string;
  remoteProjects: MantisProject[]; // 从 Mantis 远程拉取的项目列表（仅内存，不持久化）

  load: () => Promise<void>;
  setCookie: (v: string) => void;
  setProjectId: (v: string) => void;
  addProject: (id: string, name: string) => void;
  removeProject: (id: string) => void;
  setDateRange: (from: string, to: string) => void;
  /** 合并远程项目到本地项目列表 */
  mergeRemoteProjects: (remote: MantisProject[]) => void;
  setRemoteProjects: (list: MantisProject[]) => void;
}

export const useMantisStore = create<MantisStore>((set, get) => ({
  cookie: '',
  projectId: '',
  projects: [],
  dateFrom: '',
  dateTo: '',
  remoteProjects: [],

  load: async () => {
    try {
      const config = await dbGet('mantis_config', { cookie: '', projectId: '', dateFrom: '', dateTo: '' });
      const projects = await dbGet<MantisProject[]>('mantis_projects', []);
      set({ ...config, projects });

      // 如果已保存项目但 projectId 为空，自动选第一个
      if (!config.projectId && projects.length > 0) {
        const first = projects[0];
        set({ projectId: first.id });
        dbSet('mantis_config', { ...config, projectId: first.id });
      }
    } catch (e) {
      console.error('加载 Mantis 配置失败:', e);
    }
  },

  setCookie: (cookie: string) => {
    const { projectId, dateFrom, dateTo } = get();
    dbSet('mantis_config', { cookie, projectId, dateFrom, dateTo });
    set({ cookie });
  },

  setProjectId: (projectId: string) => {
    const { cookie, dateFrom, dateTo } = get();
    dbSet('mantis_config', { cookie, projectId, dateFrom, dateTo });
    set({ projectId });
  },

  addProject: (id: string, name: string) => {
    const { projects } = get();
    const exists = projects.find((p) => p.id === id);
    if (exists) return; // 已存在

    const updated = [...projects, { id, name }];
    dbSet('mantis_projects', updated);
    set({ projects: updated, projectId: id });
    const { cookie, dateFrom, dateTo } = get();
    dbSet('mantis_config', { cookie, projectId: id, dateFrom, dateTo });
  },

  removeProject: (id: string) => {
    const { projects, projectId } = get();
    const updated = projects.filter((p) => p.id !== id);
    dbSet('mantis_projects', updated);

    const nextId = projectId === id
      ? (updated.length > 0 ? updated[0].id : '')
      : projectId;

    set({ projects: updated, projectId: nextId });
    const { cookie, dateFrom, dateTo } = get();
    dbSet('mantis_config', { cookie, projectId: nextId, dateFrom, dateTo });
  },

  setDateRange: (dateFrom: string, dateTo: string) => {
    const { cookie, projectId } = get();
    dbSet('mantis_config', { cookie, projectId, dateFrom, dateTo });
    set({ dateFrom, dateTo });
  },

  setRemoteProjects: (list: MantisProject[]) => {
    set({ remoteProjects: list });
  },

  /** 将远程项目合并到本地持久化列表（按 id 去重，保留已有名称） */
  mergeRemoteProjects: (remote: MantisProject[]) => {
    const { projects, projectId } = get();
    const existing = new Map(projects.map((p) => [p.id, p]));
    let added = false;

    for (const rp of remote) {
      if (!existing.has(rp.id)) {
        existing.set(rp.id, rp);
        added = true;
      }
    }

    if (!added) return; // 没有新项目

    const merged = Array.from(existing.values());
    dbSet('mantis_projects', merged);

    // 如果之前没有选中项目，自动选第一个
    const nextId = projectId || merged[0]?.id || '';
    set({ projects: merged, projectId: nextId, remoteProjects: remote });
    if (!projectId && nextId) {
      const { cookie, dateFrom, dateTo } = get();
      dbSet('mantis_config', { cookie, projectId: nextId, dateFrom, dateTo });
    }
  },
}));
