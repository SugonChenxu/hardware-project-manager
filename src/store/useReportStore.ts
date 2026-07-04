import { create } from 'zustand';
import { WeeklyReport } from '../types';
import { generateId } from '../utils/storage';
import { dbGet, dbSet } from '../utils/db';

interface ReportStore {
  reports: WeeklyReport[];
  load: () => Promise<void>;
  add: (data: Omit<WeeklyReport, 'id' | 'createdAt' | 'updatedAt'>) => WeeklyReport;
  update: (id: string, data: Partial<WeeklyReport>) => void;
  remove: (id: string) => void;
  getByProject: (projectId: string) => WeeklyReport[];
}

export const useReportStore = create<ReportStore>((set, get) => ({
  reports: [],

  load: async () => {
    try {
      const reports = await dbGet<WeeklyReport[]>('weekly_reports', []);
      set({ reports });
    } catch (e) {
      console.error('加载周报数据失败:', e);
    }
  },

  add: (data) => {
    const now = new Date().toISOString();
    const report: WeeklyReport = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const reports = [report, ...get().reports];
    dbSet('weekly_reports', reports);
    set({ reports });
    return report;
  },

  update: (id, data) => {
    const reports = get().reports.map((r) =>
      r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
    );
    dbSet('weekly_reports', reports);
    set({ reports });
  },

  remove: (id) => {
    const reports = get().reports.filter((r) => r.id !== id);
    dbSet('weekly_reports', reports);
    set({ reports });
  },

  getByProject: (projectId) => {
    return get().reports.filter((r) => r.projectId === projectId);
  },
}));

// 自动保存
useReportStore.subscribe((state) => {
  dbSet('weekly_reports', state.reports);
});
