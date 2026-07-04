import { create } from 'zustand';
import { MeetingNote } from '../types';
import { generateId } from '../utils/storage';
import { dbGet, dbSet } from '../utils/db';

interface MeetingStore {
  notes: MeetingNote[];
  load: () => Promise<void>;
  add: (data: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'>) => MeetingNote;
  update: (id: string, data: Partial<MeetingNote>) => void;
  remove: (id: string) => void;
  getByProject: (projectId: string) => MeetingNote[];
}

export const useMeetingStore = create<MeetingStore>((set, get) => ({
  notes: [],

  load: async () => {
    try {
      const notes = await dbGet<MeetingNote[]>('meeting_notes', []);
      set({ notes });
    } catch (e) {
      console.error('加载会议纪要失败:', e);
    }
  },

  add: (data) => {
    const now = new Date().toISOString();
    const note: MeetingNote = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const notes = [note, ...get().notes];
    dbSet('meeting_notes', notes);
    set({ notes });
    return note;
  },

  update: (id, data) => {
    const notes = get().notes.map((n) =>
      n.id === id ? { ...n, ...data, updatedAt: new Date().toISOString() } : n
    );
    dbSet('meeting_notes', notes);
    set({ notes });
  },

  remove: (id) => {
    const notes = get().notes.filter((n) => n.id !== id);
    dbSet('meeting_notes', notes);
    set({ notes });
  },

  getByProject: (projectId) => {
    return get().notes.filter((n) => n.projectId === projectId);
  },
}));

// 自动保存
useMeetingStore.subscribe((state) => {
  dbSet('meeting_notes', state.notes);
});
