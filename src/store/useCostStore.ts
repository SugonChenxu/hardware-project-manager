import { create } from 'zustand';
import { CostItem } from '../types';
import { generateId } from '../utils/storage';
import { dbGet, dbSet } from '../utils/db';

interface CostStore {
  items: CostItem[];
  load: () => Promise<void>;
  add: (data: Omit<CostItem, 'id' | 'createdAt' | 'updatedAt'>) => CostItem;
  update: (id: string, data: Partial<CostItem>) => void;
  remove: (id: string) => void;
  getByProject: (projectId: string) => CostItem[];
}

export const useCostStore = create<CostStore>((set, get) => ({
  items: [],

  load: async () => {
    try {
      const items = await dbGet<CostItem[]>('cost_items', []);
      set({ items });
    } catch (e) {
      console.error('加载费用数据失败:', e);
    }
  },

  add: (data) => {
    const now = new Date().toISOString();
    const item: CostItem = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const items = [...get().items, item];
    dbSet('cost_items', items);
    set({ items });
    return item;
  },

  update: (id, data) => {
    const items = get().items.map((i) =>
      i.id === id ? { ...i, ...data, updatedAt: new Date().toISOString() } : i
    );
    dbSet('cost_items', items);
    set({ items });
  },

  remove: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    dbSet('cost_items', items);
    set({ items });
  },

  getByProject: (projectId) => {
    return get().items.filter((i) => i.projectId === projectId);
  },
}));

// 自动保存
useCostStore.subscribe((state) => {
  dbSet('cost_items', state.items);
});
