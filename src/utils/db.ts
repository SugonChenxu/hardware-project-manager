import { openDB, DBSchema, IDBPDatabase } from 'idb';

// 数据库 schema 定义
interface HPMDBSchema extends DBSchema {
  // 通用键值存储（替代 localStorage）
  'kv-store': {
    key: string;
    value: {
      key: string;
      value: any;
      updatedAt: number;
    };
  };
  
  // 项目计划（独立 store，支持大容量）
  'plan_phases': {
    key: string;
    value: {
      id: string;
      phases: any[];
      updatedAt: number;
    };
  };
  
  // 技术规格书
  'spec_docs': {
    key: string;
    value: {
      id: string;
      data: any;
      updatedAt: number;
    };
  };
  
  // BOM 物料清单
  'bom_items': {
    key: string;
    value: {
      id: string;
      items: any[];
      updatedAt: number;
    };
  };
  
  // 风险评估
  'risks': {
    key: string;
    value: {
      id: string;
      items: any[];
      updatedAt: number;
    };
  };
  
  // 测试结果
  'test_records': {
    key: string;
    value: {
      id: string;
      records: any[];
      updatedAt: number;
    };
  };
}

const DB_NAME = 'hpm-database';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HPMDBSchema>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<HPMDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 创建通用键值存储
        if (!db.objectStoreNames.contains('kv-store')) {
          db.createObjectStore('kv-store', { keyPath: 'key' });
        }
        // 创建项目计划存储
        if (!db.objectStoreNames.contains('plan_phases')) {
          db.createObjectStore('plan_phases', { keyPath: 'id' });
        }
        // 创建技术规格书存储
        if (!db.objectStoreNames.contains('spec_docs')) {
          db.createObjectStore('spec_docs', { keyPath: 'id' });
        }
        // 创建 BOM 存储
        if (!db.objectStoreNames.contains('bom_items')) {
          db.createObjectStore('bom_items', { keyPath: 'id' });
        }
        // 创建风险存储
        if (!db.objectStoreNames.contains('risks')) {
          db.createObjectStore('risks', { keyPath: 'id' });
        }
        // 创建测试记录存储
        if (!db.objectStoreNames.contains('test_records')) {
          db.createObjectStore('test_records', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// 通用键值操作（替代 localStorage）
export async function dbGet<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const db = await getDB();
    const record = await db.get('kv-store', key);
    if (record) {
      return record.value as T;
    }
    return defaultValue;
  } catch (e) {
    console.error('DB 读取失败:', key, e);
    return defaultValue;
  }
}

export async function dbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDB();
    await db.put('kv-store', {
      key,
      value,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error('DB 写入失败:', key, e);
  }
}

export async function dbRemove(key: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('kv-store', key);
  } catch (e) {
    console.error('DB 删除失败:', key, e);
  }
}

// 项目计划专用操作（支持大数据量）
export async function dbGetPlanPhases(defaultValue: any[] = []): Promise<any[]> {
  try {
    const db = await getDB();
    const record = await db.get('plan_phases', 'default');
    if (record) {
      return record.phases;
    }
    return defaultValue;
  } catch (e) {
    console.error('计划数据读取失败:', e);
    return defaultValue;
  }
}

export async function dbSetPlanPhases(phases: any[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('plan_phases', {
      id: 'default',
      phases,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error('计划数据写入失败:', e);
  }
}

// 技术规格书专用操作
export async function dbGetSpecDocs(defaultValue: any[] = []): Promise<any[]> {
  try {
    const db = await getDB();
    const record = await db.get('spec_docs', 'default');
    if (record) {
      return record.data;
    }
    return defaultValue;
  } catch (e) {
    console.error('规格书读取失败:', e);
    return defaultValue;
  }
}

export async function dbSetSpecDocs(data: any[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('spec_docs', {
      id: 'default',
      data,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error('规格书写入失败:', e);
  }
}

// BOM 物料清单专用操作
export async function dbGetBomItems(defaultValue: any[] = []): Promise<any[]> {
  try {
    const db = await getDB();
    const record = await db.get('bom_items', 'default');
    if (record) {
      return record.items;
    }
    return defaultValue;
  } catch (e) {
    console.error('BOM 读取失败:', e);
    return defaultValue;
  }
}

export async function dbSetBomItems(items: any[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('bom_items', {
      id: 'default',
      items,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error('BOM 写入失败:', e);
  }
}

// 风险评估专用操作
export async function dbGetRisks(defaultValue: any[] = []): Promise<any[]> {
  try {
    const db = await getDB();
    const record = await db.get('risks', 'default');
    if (record) {
      return record.items;
    }
    return defaultValue;
  } catch (e) {
    console.error('风险数据读取失败:', e);
    return defaultValue;
  }
}

export async function dbSetRisks(items: any[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('risks', {
      id: 'default',
      items,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error('风险数据写入失败:', e);
  }
}

// 测试结果专用操作
export async function dbGetTestRecords(defaultValue: any[] = []): Promise<any[]> {
  try {
    const db = await getDB();
    const record = await db.get('test_records', 'default');
    if (record) {
      return record.records;
    }
    return defaultValue;
  } catch (e) {
    console.error('测试记录读取失败:', e);
    return defaultValue;
  }
}

export async function dbSetTestRecords(records: any[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('test_records', {
      id: 'default',
      records,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.error('测试记录写入失败:', e);
  }
}

// 清除所有数据
export async function dbClearAll(): Promise<void> {
  try {
    const db = await getDB();
    const storeNames: string[] = ['kv-store', 'plan_phases', 'spec_docs', 'bom_items', 'risks', 'test_records'];
    for (const storeName of storeNames) {
      await db.clear(storeName as any);
    }
    console.log('✅ 所有数据已清除');
  } catch (e) {
    console.error('清除数据失败:', e);
  }
}

// 获取数据库信息（用于调试）
export async function dbGetInfo() {
  try {
    const db = await getDB();
    const info: Record<string, number> = {};
    const storeNames: string[] = ['kv-store', 'plan_phases', 'spec_docs', 'bom_items', 'risks', 'test_records'];
    for (const storeName of storeNames) {
      info[storeName] = await db.count(storeName as any);
    }
    return info;
  } catch (e) {
    console.error('获取数据库信息失败:', e);
    return {};
  }
}

// 从 localStorage 迁移数据到 IndexedDB（一次性迁移）
export async function migrateFromLocalStorage(): Promise<void> {
  try {
    console.log('🔄 开始从 localStorage 迁移数据到 IndexedDB...');
    
    // 迁移计划数据
    const planData = localStorage.getItem('hpm_plan_phases');
    if (planData) {
      const phases = JSON.parse(planData);
      await dbSetPlanPhases(phases);
      console.log('✅ 计划数据已迁移，共', phases.length, '个任务');
    }
    
    // 迁移项目数据
    const projectsData = localStorage.getItem('hpm_projects');
    if (projectsData) {
      const projects = JSON.parse(projectsData);
      await dbSet('projects', projects);
      console.log('✅ 项目数据已迁移，共', projects.length, '个项目');
    }
    
    const currentProjectId = localStorage.getItem('hpm_currentProjectId');
    if (currentProjectId) {
      await dbSet('currentProjectId', currentProjectId);
      console.log('✅ 当前项目 ID 已迁移:', currentProjectId);
    }
    
    // 迁移其他 store 数据
    const storeKeys = [
      'hpm_tasks', 'hpm_todos', 'hpm_bom', 'hpm_meetings',
      'hpm_reports', 'hpm_bugs', 'hpm_costs', 'hpm_materials',
      'hpm_mantis_config', 'hpm_mantis_snapshots'
    ];
    
    for (const key of storeKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        const storeKey = key.replace('hpm_', '');
        await dbSet(storeKey, JSON.parse(data));
        console.log('✅', key, '数据已迁移');
      }
    }
    
    console.log('🎉 数据迁移完成！');
  } catch (e) {
    console.error('❌ 数据迁移失败:', e);
  }
}

export default getDB;
