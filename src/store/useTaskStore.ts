import { create } from 'zustand';
import { Task } from '../types';
import { generateId } from '../utils/storage';
import { dbGet, dbSet } from '../utils/db';

interface TaskStore {
  tasks: Task[];
  load: () => Promise<void>;
  add: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task;
  update: (id: string, data: Partial<Task>) => void;
  remove: (id: string) => void;
  addSubTask: (taskId: string, title: string) => void;
  toggleSubTask: (taskId: string, subTaskId: string) => void;
  removeSubTask: (taskId: string, subTaskId: string) => void;
  getByProject: (projectId: string) => Task[];
  getByStatus: (projectId: string, status: Task['status']) => Task[];
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],

  load: async () => {
    try {
      const tasks = await dbGet<Task[]>('tasks', []);
      set({ tasks });
    } catch (e) {
      console.error('加载任务数据失败:', e);
    }
  },

  add: (data) => {
    const now = new Date().toISOString();
    const task: Task = {
      ...data,
      id: generateId(),
      subTasks: data.subTasks || [],
      createdAt: now,
      updatedAt: now,
    };
    const tasks = [...get().tasks, task];
    dbSet('tasks', tasks);
    set({ tasks });
    return task;
  },

  update: (id, data) => {
    const tasks = get().tasks.map((t) =>
      t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
    );
    dbSet('tasks', tasks);
    set({ tasks });
  },

  remove: (id) => {
    const tasks = get().tasks.filter((t) => t.id !== id);
    dbSet('tasks', tasks);
    set({ tasks });
  },

  getByProject: (projectId) => {
    return get().tasks.filter((t) => t.projectId === projectId);
  },

  getByStatus: (projectId, status) => {
    return get().tasks.filter((t) => t.projectId === projectId && t.status === status);
  },

  addSubTask: (taskId, title) => {
    const tasks = get().tasks.map((t) => {
      if (t.id !== taskId) return t;
      const subTask = { id: generateId(), title, completed: false };
      return { ...t, subTasks: [...(t.subTasks || []), subTask], updatedAt: new Date().toISOString() };
    });
    dbSet('tasks', tasks);
    set({ tasks });
  },

  toggleSubTask: (taskId, subTaskId) => {
    const tasks = get().tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subTasks: (t.subTasks || []).map((s) =>
          s.id === subTaskId ? { ...s, completed: !s.completed } : s
        ),
        updatedAt: new Date().toISOString(),
      };
    });
    dbSet('tasks', tasks);
    set({ tasks });
  },

  removeSubTask: (taskId, subTaskId) => {
    const tasks = get().tasks.map((t) => {
      if (t.id !== taskId) return t;
      return { ...t, subTasks: (t.subTasks || []).filter((s) => s.id !== subTaskId), updatedAt: new Date().toISOString() };
    });
    dbSet('tasks', tasks);
    set({ tasks });
  },
}));

// 自动保存
useTaskStore.subscribe((state) => {
  dbSet('tasks', state.tasks);
});
