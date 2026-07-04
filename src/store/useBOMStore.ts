import { create } from 'zustand';
import { BOMItem } from '../types';
import { generateId } from '../utils/storage';
import { dbGet, dbSet } from '../utils/db';

interface BOMStore {
  items: BOMItem[];
  load: () => Promise<void>;
  add: (data: Omit<BOMItem, 'id' | 'createdAt' | 'updatedAt'>) => BOMItem;
  update: (id: string, data: Partial<BOMItem>) => void;
  remove: (id: string) => void;
  getByProject: (projectId: string) => BOMItem[];
}

export const useBOMStore = create<BOMStore>((set, get) => ({
  items: [],

  load: async () => {
    try {
      const items = await dbGet<BOMItem[]>('bom_items', []);
      set({ items });
    } catch (e) {
      console.error('加载BOM数据失败:', e);
    }
  },

  add: (data) => {
    const now = new Date().toISOString();
    const item: BOMItem = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const items = [...get().items, item];
    dbSet('bom_items', items);
    set({ items });
    return item;
  },

  update: (id, data) => {
    const items = get().items.map((i) =>
      i.id === id ? { ...i, ...data, updatedAt: new Date().toISOString() } : i
    );
    dbSet('bom_items', items);
    set({ items });
  },

  remove: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    dbSet('bom_items', items);
    set({ items });
  },

  getByProject: (projectId) => {
    return get().items.filter((i) => i.projectId === projectId);
  },
}));

// 自动保存
useBOMStore.subscribe((state) => {
  dbSet('bom_items', state.items);
});
