import { create } from 'zustand';
import { Todo } from '../types';
import { generateId } from '../utils/storage';
import { dbGet, dbSet } from '../utils/db';

interface TodoStore {
  todos: Todo[];
  load: () => Promise<void>;
  add: (data: Omit<Todo, 'id' | 'createdAt'>) => Todo;
  update: (id: string, data: Partial<Todo>) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  getByDate: (date: string) => Todo[];
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],

  load: async () => {
    try {
      const todos = await dbGet<Todo[]>('todos', []);
      set({ todos });
    } catch (e) {
      console.error('加载待办数据失败:', e);
    }
  },

  add: (data) => {
    const todo: Todo = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const todos = [todo, ...get().todos];
    dbSet('todos', todos);
    set({ todos });
    return todo;
  },

  update: (id, data) => {
    const todos = get().todos.map((t) =>
      t.id === id ? { ...t, ...data } : t
    );
    dbSet('todos', todos);
    set({ todos });
  },

  remove: (id) => {
    const todos = get().todos.filter((t) => t.id !== id);
    dbSet('todos', todos);
    set({ todos });
  },

  toggle: (id) => {
    const todos = get().todos.map((t) =>
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    dbSet('todos', todos);
    set({ todos });
  },

  getByDate: (date) => {
    return get().todos.filter((t) => t.date === date);
  },
}));

// 自动保存
useTodoStore.subscribe((state) => {
  dbSet('todos', state.todos);
});
