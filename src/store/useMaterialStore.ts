import { create } from 'zustand';
import { MaterialItem, MaterialStatus } from '../types';
import { generateId } from '../utils/storage';
import { dbGet, dbSet } from '../utils/db';

interface ImportSnapshot {
  ids: string[];
  timestamp: number;
}

interface MaterialStore {
  items: MaterialItem[];
  lastImportIds: string[];
  load: () => Promise<void>;
  add: (data: Omit<MaterialItem, 'id' | 'createdAt' | 'updatedAt'>) => MaterialItem;
  batchAdd: (dataList: Omit<MaterialItem, 'id' | 'createdAt' | 'updatedAt'>[]) => MaterialItem[];
  undoImport: () => number;
  update: (id: string, data: Partial<MaterialItem>) => void;
  remove: (id: string) => void;
  batchRemove: (ids: string[]) => void;
  batchUpdate: (ids: string[], data: Partial<MaterialItem>) => void;
  getByProject: (projectId: string) => MaterialItem[];
}

export const useMaterialStore = create<MaterialStore>((set, get) => ({
  items: [],
  lastImportIds: [],

  load: async () => {
    try {
      const items = await dbGet<MaterialItem[]>('material_items', []);
      const snapshot = await dbGet<ImportSnapshot>('material_import_snapshot', { ids: [], timestamp: 0 });
      // 只保留 5 分钟内的撤销快照
      const validSnapshot = Date.now() - snapshot.timestamp < 5 * 60 * 1000
        ? snapshot.ids : [];
      set({ items, lastImportIds: validSnapshot });
    } catch (e) {
      console.error('[物料] 加载数据失败:', e);
      set({ items: [], lastImportIds: [] });
    }
  },

  add: (data) => {
    const now = new Date().toISOString();
    const item: MaterialItem = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const items = [...get().items, item];
    dbSet('material_items', items);
    set({ items });
    return item;
  },

  batchAdd: (dataList) => {
    const now = new Date().toISOString();
    const newItems: MaterialItem[] = dataList.map((data) => ({
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }));
    const items = [...get().items, ...newItems];
    dbSet('material_items', items);
    // 记录导入快照，用于撤销
    const snapshot: ImportSnapshot = { ids: newItems.map((i) => i.id), timestamp: Date.now() };
    dbSet('material_import_snapshot', snapshot);
    set({ items, lastImportIds: newItems.map((i) => i.id) });
    console.log(`[物料] 已导入 ${newItems.length} 条，总计 ${items.length} 条`);
    return newItems;
  },

  undoImport: () => {
    const { lastImportIds } = get();
    if (lastImportIds.length === 0) return 0;
    const idSet = new Set(lastImportIds);
    const items = get().items.filter((i) => !idSet.has(i.id));
    const removedCount = get().items.length - items.length;
    dbSet('material_items', items);
    dbSet('material_import_snapshot', { ids: [], timestamp: 0 });
    set({ items, lastImportIds: [] });
    console.log(`[物料] 撤销导入 ${removedCount} 条，剩余 ${items.length} 条`);
    return removedCount;
  },

  update: (id, data) => {
    const items = get().items.map((i) =>
      i.id === id ? { ...i, ...data, updatedAt: new Date().toISOString() } : i
    );
    dbSet('material_items', items);
    set({ items });
  },

  remove: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    dbSet('material_items', items);
    set({ items });
  },

  batchRemove: (ids) => {
    const idSet = new Set(ids);
    const items = get().items.filter((i) => !idSet.has(i.id));
    dbSet('material_items', items);
    set({ items });
  },

  batchUpdate: (ids, data) => {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const items = get().items.map((i) =>
      idSet.has(i.id) ? { ...i, ...data, updatedAt: now } : i
    );
    dbSet('material_items', items);
    set({ items });
  },

  getByProject: (projectId) => {
    return get().items.filter((i) => i.projectId === projectId);
  },
}));

// 自动保存
useMaterialStore.subscribe((state) => {
  dbSet('material_items', state.items);
  dbSet('material_import_snapshot', { ids: state.lastImportIds, timestamp: Date.now() });
});
