#!/usr/bin/env python3
"""
重写 usePlanStore.ts：
- 用 persist 中间件（最简单配置，不自定义 storage）
- 保留所有核心业务逻辑
- 正确 TypeScript 类型
"""
import textwrap

content = '''
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PlanPhase, PlanTemplate, PlanTemplatePhase, PlanHistory } from '../types';
import { generateId } from '../utils/storage';
import dayjs from 'dayjs';

// ── 工具函数 ──
function daysBetween(d1: string, d2: string): number {
  return dayjs(d2).diff(dayjs(d1), 'day');
}

function fmt(d: dayjs.Dayjs): string {
  return d.format('YYYY-MM-DD');
}

export function computeStatusFull(startDate: string, endDate: string): 'completed' | 'in_progress' | 'upcoming' {
  const today = dayjs().startOf('day');
  const start = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).startOf('day');
  if (end.isBefore(today)) return 'completed';
  if (start.isBefore(today) || start.isSame(today)) return 'in_progress';
  return 'upcoming';
}

// ── Store 接口 ──
interface PlanStore {
  template: PlanTemplate | null;
  phases: PlanPhase[];
  history: PlanHistory[];
  importTemplate: (name: string, phases: PlanTemplatePhase[]) => void;
  getTemplate: () => PlanTemplate | null;
  generateFromTemplate: (projectId: string, projectStartDate: string) => void;
  getByProject: (projectId: string) => PlanPhase[];
  addPhase: (projectId: string, phase: Omit<PlanPhase, 'id' | 'sortOrder'>) => void;
  addPhaseAfter: (afterId: string) => void;
  removePhase: (id: string) => void;
  updatePhaseDate: (id: string, field: 'startDate' | 'endDate' | 'duration', value: string | number) => void;
  updatePhaseTaskName: (id: string, taskName: string) => void;
  updatePhaseDescription: (id: string, description: string) => void;
  toggleLockStart: (id: string) => void;
  toggleLockEnd: (id: string) => void;
  toggleLink: (id: string) => void;
  addPhaseGroup: (projectId: string, phaseGroupName: string) => void;
  removePhaseGroup: (projectId: string, phaseGroupName: string) => void;
  updatePhaseGroupName: (projectId: string, oldName: string, newName: string) => void;
  confirmSave: (projectId: string) => void;
  saveHistory: (projectId: string, label: string) => void;
  loadHistory: (historyId: string) => string | null;
  getHistoryByProject: (projectId: string) => PlanHistory[];
  refreshStatuses: () => void;
  detectParallelAndCritical: () => void;
}
'''

# 继续写 store 实现（persist 包装）
# 由于内容太长，分多次追加到文件
# 先写到临时 py 文件，再追加到 ts 文件

print('Python script started')
print('Content length:', len(content))
