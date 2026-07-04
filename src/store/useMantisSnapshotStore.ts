import { create } from 'zustand';
import { dbGet, dbSet } from '../utils/db';
import { generateId } from '../utils/storage';
import { MantisSnapshot } from '../types';

interface MantisSnapshotStore {
  snapshots: MantisSnapshot[];
  load: () => Promise<void>;
  add: (data: Omit<MantisSnapshot, 'id' | 'createdAt' | 'resolutionRate'>) => MantisSnapshot;
  remove: (id: string) => void;
  getByProject: (projectId: string) => MantisSnapshot[];
}

export const useMantisSnapshotStore = create<MantisSnapshotStore>((set, get) => ({
  snapshots: [],

  load: async () => {
    try {
      const snapshots = await dbGet<MantisSnapshot[]>('mantis_snapshots', []);
      set({ snapshots });
    } catch {
      set({ snapshots: [] });
    }
  },

  add: (data) => {
    const now = new Date().toISOString();
    const rate = data.totalBugs > 0
      ? Math.round((data.resolvedBugs / data.totalBugs) * 1000) / 10
      : 0;
    const snapshot: MantisSnapshot = {
      ...data,
      id: generateId(),
      resolutionRate: rate,
      createdAt: now,
    };
    const snapshots = [snapshot, ...get().snapshots];
    dbSet('mantis_snapshots', snapshots);
    set({ snapshots });
    return snapshot;
  },

  remove: (id) => {
    const snapshots = get().snapshots.filter((s) => s.id !== id);
    dbSet('mantis_snapshots', snapshots);
    set({ snapshots });
  },

  getByProject: (projectId) => {
    return get().snapshots.filter((s) => s.projectId === projectId);
  },
}));

// 自动保存
useMantisSnapshotStore.subscribe((state) => {
  dbSet('mantis_snapshots', state.snapshots);
});
