import { create } from 'zustand';
import { MeetingNote } from '../types';
import { generateId } from '../utils/storage';
import { dbGet, dbSet } from '../utils/db';

const STORE_KEY = 'meeting_notes';

interface MeetingNoteStore {
  notes: MeetingNote[];
  load: () => Promise<void>;
  getByProject: (projectId: string) => MeetingNote[];
  addNote: (projectId: string, note: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, updates: Partial<MeetingNote>) => void;
  deleteNote: (id: string) => void;
  importFromTencentMeeting: (projectId: string, meetingId: string) => Promise<void>;
  generateWeeklyReport: (projectId: string, startDate: string, endDate: string) => string;
}

const useMeetingNoteStore = create<MeetingNoteStore>((set, get) => ({
  notes: [],

  // 从 IndexedDB 加载数据
  load: async () => {
    try {
      const notes = await dbGet<MeetingNote[]>(STORE_KEY, []);
      set({ notes });
    } catch (e) {
      console.error('加载会议纪要失败:', e);
    }
  },

  // 获取指定项目的会议记录
  getByProject: (projectId) => {
    return get().notes.filter(n => n.projectId === projectId);
  },

  // 添加会议记录
  addNote: (projectId, note) => {
    const { notes } = get();
    const now = new Date().toISOString();
    const newNote: MeetingNote = {
      ...note,
      id: generateId(),
      projectId,
      createdAt: now,
      updatedAt: now,
    };
    const newNotes = [...notes, newNote];
    set({ notes: newNotes });
    dbSet(STORE_KEY, newNotes);
  },

  // 更新会议记录
  updateNote: (id, updates) => {
    const { notes } = get();
    const newNotes = notes.map(n => 
      n.id === id 
        ? { ...n, ...updates, updatedAt: new Date().toISOString() }
        : n
    );
    set({ notes: newNotes });
    dbSet(STORE_KEY, newNotes);
  },

  // 删除会议记录
  deleteNote: (id) => {
    const { notes } = get();
    const newNotes = notes.filter(n => n.id !== id);
    set({ notes: newNotes });
    dbSet(STORE_KEY, newNotes);
  },

  // 从腾讯会议导入（模拟）
  importFromTencentMeeting: async (projectId, meetingId) => {
    // 模拟 API 调用
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 模拟数据
    const mockNote: Omit<MeetingNote, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId,
      meetingId,
      meetingUrl: `https://meeting.tencent.com/dm/${meetingId}`,
      title: `项目例会 - ${new Date().toLocaleDateString('zh-CN')}`,
      date: new Date().toISOString().split('T')[0],
      attendees: ['张三', '李四', '王五'],
      content: '',  // 兼容旧数据
      aiTranscript: `# 项目例会 - ${meetingId}\n\n## 参会人员\n- 张三（项目经理）\n- 李四（硬件工程师）\n- 王五（软件工程师）\n\n## 讨论内容\n1. 项目进度汇报\n   - M3 研发测试阶段进展顺利\n   - PCB 洗板已完成，正在进行 PCBA 打板\n2. 问题讨论\n   - 散热设计需要优化\n   - 建议提前准备 A02 设计\n3. 下一步计划\n   - 继续 EVT 测试\n   - 准备 L9 并行测试`,
      aiSummary: {
        progress: [
          'M3 研发测试阶段进展顺利',
          'PCB 洗板已完成，PCBA 打板进行中'
        ],
        issues: [
          '散热设计需要优化',
          'A02 设计需要提前准备'
        ],
        plans: [
          '继续 EVT 测试',
          '准备 L9 并行测试'
        ]
      },
      decisions: [],  // 会议决策
      actionItems: [],  // 行动项
      weeklyReport: '',
      weeklyReportGenerated: false,
    };

    get().addNote(projectId, mockNote);
  },

  // 生成周报
  generateWeeklyReport: (projectId, startDate, endDate) => {
    const notes = get().getByProject(projectId).filter(n => 
      n.date >= startDate && n.date <= endDate && n.aiSummary
    );

    if (notes.length === 0) {
      return '本周无会议记录';
    }

    // 生成周报内容
    let report = `# 项目周报（${startDate} ~ ${endDate}）\n\n`;
    report += '## 一、本周进展\n\n';
    notes.forEach(note => {
      if (note.aiSummary) {
        note.aiSummary.progress.forEach(p => {
          report += `- ${p}\n`;
        });
      }
    });

    report += '\n## 二、风险与问题\n\n';
    notes.forEach(note => {
      if (note.aiSummary) {
        note.aiSummary.issues.forEach(i => {
          report += `- ${i}\n`;
        });
      }
    });

    report += '\n## 三、下周计划\n\n';
    notes.forEach(note => {
      if (note.aiSummary) {
        note.aiSummary.plans.forEach(p => {
          report += `- ${p}\n`;
        });
      }
    });

    report += '\n## 四、会议纪要链接\n\n';
    notes.forEach(note => {
      report += `- [${note.title}](${note.meetingUrl})\n`;
    });

    // 保存到每个会议记录
    notes.forEach(note => {
      get().updateNote(note.id, {
        weeklyReport: report,
        weeklyReportGenerated: true,
      });
    });

    return report;
  },
}));

// 自动保存
useMeetingNoteStore.subscribe((state) => {
  dbSet(STORE_KEY, state.notes);
});

export default useMeetingNoteStore;
