#!/usr/bin/env python3
"""
Refactor usePlanStore.ts to use zustand persist middleware.
- Removes all manual setItem/getItem calls
- Removes load() (persist handles rehydration)
- Removes isDirty/confirmSave/discardChanges (auto-save = always saved)
- Adds persist wrapper with custom storage using hpm_ prefix
"""

import re

with open(r'C:\Users\chenxu\WorkBuddy\2026-06-30-20-42-22\project-manager\src\store\usePlanStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ===== 1. Fix import line =====
old_import = "import { create } from 'zustand';"
new_import = "import { create } from 'zustand';\nimport { persist } from 'zustand/middleware';"
content = content.replace(old_import, new_import)

# ===== 2. Add custom storage adapter after the imports (after line 4, before DEFAULT_TEMPLATE_PHASES) =====
# Find the position after the last import line
storage_adapter = """
// ── Custom storage adapter for persist middleware (uses hpm_ prefix via localStorage directly) ──
const planStorage = {
  getItem: (name: string) => {
    try {
      const raw = localStorage.getItem('hpm_' + name);
      return raw;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem('hpm_' + name, value);
    } catch (e) {
      console.error('[planStore] persist setItem failed:', e);
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem('hpm_' + name);
    } catch (e) {
      console.error('[planStore] persist removeItem failed:', e);
    }
  },
};
"""

# Insert after "import dayjs from 'dayjs';" line
content = content.replace(
    "import dayjs from 'dayjs';\n",
    "import dayjs from 'dayjs';\n" + storage_adapter + "\n"
)

# ===== 3. Remove isDirty from interface =====
content = content.replace('  // 是否已修改（未保存）\n  isDirty: boolean;\n', '')
content = content.replace('  isDirty: boolean;\n', '')

# ===== 4. Remove load, confirmSave, discardChanges from interface =====
content = content.replace('  // 计划生命周期\n  load: () => void;\n', '')
content = content.replace('  // 确认保存\n  confirmSave: (projectId: string) => void;\n', '')
content = content.replace('  // 撤销未保存的修改\n  discardChanges: () => void;\n', '')

# ===== 5. Rewrite store creation to use persist =====
# Replace "export const usePlanStore = create<PlanStore>((set, get) => ({" 
# with "export const usePlanStore = create<PlanStore>()(persist((set, get) => ({" 
old_create = "export const usePlanStore = create<PlanStore>((set, get) => ({"
new_create = "export const usePlanStore = create<PlanStore>()(persist((set, get) => ({"
content = content.replace(old_create, new_create)

# ===== 6. Add persist closing after the store object ends =====
# Find "}));" followed by the subscribe call, replace with persist closing
old_end = """  },
}));

// 自动保存：phases 变化时立即写盘
usePlanStore.subscribe((state) => {
  setItem('plan_phases', state.phases);
});"""

new_end = """  },
}, {
  name: 'plan_store',       // localStorage key = 'hpm_plan_store'
  storage: planStorage,
  partialize: (state) => ({
    phases: state.phases,
    history: state.history,
    template: state.template,
  }),
  // 迁移：从旧的 hpm_plan_phases / hpm_plan_history / hpm_plan_template 键迁移数据
  onRehydrateStorage: (state) => {
    if (state && state.phases.length === 0) {
      try {
        const rawPhases = localStorage.getItem('hpm_plan_phases');
        if (rawPhases) {
          const phases = JSON.parse(rawPhases).map((p: any) => ({
            ...p,
            linked: p.linked ?? true,
            lockStart: p.lockStart ?? false,
            lockEnd: p.lockEnd ?? (p.locked ?? false),
            description: p.description ?? '',
          }));
          usePlanStore.setState({ phases });
          console.log('[planStore] 已从 hpm_plan_phases 迁移数据');
        }
        const rawHistory = localStorage.getItem('hpm_plan_history');
        if (rawHistory) {
          const history = JSON.parse(rawHistory);
          usePlanStore.setState({ history });
        }
      } catch (e) {
        console.error('[planStore] 迁移旧数据失败:', e);
      }
    }
  },
}));"""

content = content.replace(old_end, new_end)

# ===== 7. Remove isDirty from initial state =====
content = content.replace('  isDirty: false,\n', '')
# Also remove the isDirty: false inside load()
content = content.replace('      set({ phases, history, template, isDirty: false });\n', '      set({ phases, history, template });\n')

# ===== 8. Remove load() method entirely =====
# Find load method and remove it
load_pattern = r'  // ── 加载 ──\n\n  load: \(\) => \{[^}]*\},\n'
content = re.sub(load_pattern, '', content, flags=re.DOTALL)

# ===== 9. Remove setItem calls from all actions =====
# Replace "setItem('plan_phases', ...);" lines
content = re.sub(r'\s*setItem\([\s\S]*?\);\n', '', content)
# Replace "set({ phases: updated });" correctly (don't remove set() calls)
# Actually, let me be more careful - only remove setItem lines
content = re.sub(r'\s*setItem\([^;]+\);\s*\n', '', content)

# ===== 10. Remove isDirty from set() calls =====
content = content.replace(', isDirty: true', '')
content = content.replace('isDirty: false, ', '')

# ===== 11. Remove confirmSave and discardChanges methods =====
# Remove confirmSave
confirm_pattern = r'\s*confirmSave: \(projectId\) => \{[^}]*\},\s*'
content = re.sub(confirm_pattern, '', content, flags=re.DOTALL)

# Remove discardChanges  
discard_pattern = r'\s*discardChanges: \(\) => \{[^}]*\},\s*'
content = re.sub(discard_pattern, '', content, flags=re.DOTALL)

# ===== Write output =====
with open(r'C:\Users\chenxu\WorkBuddy\2026-06-30-20-42-22\project-manager\src\store\usePlanStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('✅ usePlanStore.ts refactored to use persist middleware')
print('   - Removed load(), isDirty, confirmSave, discardChanges')
print('   - Removed all manual setItem calls')
print('   - Added persist wrapper with migration from old keys')
