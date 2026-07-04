import { create } from 'zustand';
import { BugItem } from '../types';
import { generateId } from '../utils/storage';
import { dbGet, dbSet } from '../utils/db';

interface BugStore {
  items: BugItem[];
  load: () => Promise<void>;
  add: (data: Omit<BugItem, 'id' | 'createdAt' | 'updatedAt'>) => BugItem;
  update: (id: string, data: Partial<BugItem>) => void;
  remove: (id: string) => void;
  getByProject: (projectId: string) => BugItem[];
}

export const useBugStore = create<BugStore>((set, get) => ({
  items: [],

  load: async () => {
    try {
      const items = await dbGet<BugItem[]>('bug_items', []);
      set({ items });
    } catch (e) {
      console.error('加载Bug数据失败:', e);
    }
  },

  add: (data) => {
    const now = new Date().toISOString();
    const item: BugItem = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const items = [...get().items, item];
    dbSet('bug_items', items);
    set({ items });
    return item;
  },

  update: (id, data) => {
    const items = get().items.map((i) =>
      i.id === id ? { ...i, ...data, updatedAt: new Date().toISOString() } : i
    );
    dbSet('bug_items', items);
    set({ items });
  },

  remove: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    dbSet('bug_items', items);
    set({ items });
  },

  getByProject: (projectId) => {
    return get().items.filter((i) => i.projectId === projectId);
  },
}));

// 自动保存
useBugStore.subscribe((state) => {
  dbSet('bug_items', state.items);
});
