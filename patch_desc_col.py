import re

f = r"C:\Users\chenxu\WorkBuddy\2026-06-30-20-42-22\project-manager\src\pages\PlanSchedule.tsx"
with open(f, 'r', encoding='utf-8') as fp:
    c = fp.read()

# 1. 在 editingTaskNameValue state 后面插入 description 编辑 state
old_state = "  const [editingTaskNameValue, setEditingTaskNameValue] = useState('');\n  const [historyModalOpen"
new_state = (
    "  const [editingTaskNameValue, setEditingTaskNameValue] = useState('');\n"
    "  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);\n"
    "  const [editingDescriptionValue, setEditingDescriptionValue] = useState('');\n"
    "  const [historyModalOpen"
)
if old_state not in c:
    print("ERROR: 找不到 state 插入点")
    exit(1)
c = c.replace(old_state, new_state, 1)
print("✅ state 已添加")

# 2. 替换说明列 render 函数（去掉 React.useState/useRef，改用组件级 state）
# 找到说明列 render 函数的开始和结束
desc_col_start = '              title="说明"\n              dataIndex="description"\n              key="description"'
if desc_col_start not in c:
    print("ERROR: 找不到说明列")
    exit(1)

# 找到说明列 Column 的结束（下一个 <Column 或 </Table）
# 说明列后面是 <Column title="操作"
desc_col_end_marker = '            <Column\n              title="操作"'
ei = c.find(desc_col_end_marker)
si = c.find(desc_col_start)
if ei == -1 or si == -1:
    print("ERROR: 找不到说明列范围")
    exit(1)

# 新的说明列 render 函数
new_desc_col = """            <Column
              title="说明"
              dataIndex="description"
              key="description"
              width={200}
              render={(_: string, record: any) => {
                if (record._rowType === 'group') return null;
                const phase = record as PlanPhase;
                const isEditing = editingDescriptionId === phase.id;
                if (!isEditing) {
                  return (
                    <div
                      style={{ cursor: 'pointer', minHeight: 22, fontSize: 12, color: '#666', fontStyle: phase.description ? 'normal' : 'italic' }}
                      onClick={() => { setEditingDescriptionValue(phase.description || ''); setEditingDescriptionId(phase.id); }}
                      title="点击编辑说明"
                    >
                      {phase.description || '(点击添加说明)'}
                    </div>
                  );
                }
                return (
                  <Input
                    size="small"
                    value={editingDescriptionValue}
                    onChange={e => setEditingDescriptionValue(e.target.value)}
                    onBlur={() => { updatePhaseDescription(phase.id, editingDescriptionValue); setEditingDescriptionId(null); }}
                    onPressEnter={() => { updatePhaseDescription(phase.id, editingDescriptionValue); setEditingDescriptionId(null); }}
                    autoFocus
                    style={{ fontSize: 12 }}
                    placeholder="输入说明..."
                  />
                );
              }}
            />
            <Column
              title="操作\""""

c = c[:si] + new_desc_col + c[ei:]
print("✅ 说明列 render 函数已修复")

with open(f, 'w', encoding='utf-8') as fp:
    fp.write(c)
print("✅ PlanSchedule.tsx 已更新")
