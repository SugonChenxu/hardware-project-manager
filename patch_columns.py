import re

f = r"C:\Users\chenxu\WorkBuddy\2026-06-30-20-42-22\project-manager\src\pages\PlanSchedule.tsx"
with open(f, 'r', encoding='utf-8') as fp:
    c = fp.read()

# 1. 在『关键路径』列和『操作』列之间插入『说明』列
# 找到关键路径 Column 的结束位置（]] /> 后接 <Column title="操作"）
old_marker = '/>\n            <Column\n              title="操作"'
new_marker = (
    '/>\n'
    '            <Column\n'
    '              title="说明"\n'
    '              dataIndex="description"\n'
    '              key="description"\n'
    '              width={200}\n'
    '              render={(_: string, record: any) => {\n'
    '                if (record._rowType === "group") return null;\n'
    '                const phase = record as PlanPhase;\n'
    '                const [editing, setEditing] = React.useState(false);\n'
    '                const [val, setVal] = React.useState(phase.description || "");\n'
    '                const phaseRef = React.useRef(phase);\n'
    '                phaseRef.current = phase;\n'
    '                if (!editing) {\n'
    '                  return (\n'
    '                    <div\n'
    '                      style={{ cursor: "pointer", minHeight: 22, fontSize: 12, color: "#666", fontStyle: phase.description ? "normal" : "italic" }}\n'
    '                      onClick={() => { setVal(phaseRef.current.description || ""); setEditing(true); }}\n'
    '                      title="点击编辑说明"\n'
    '                    >\n'
    '                      {phase.description || "(点击添加说明)"}\n'
    '                    </div>\n'
    '                  );\n'
    '                }\n'
    '                return (\n'
    '                  <Input\n'
    '                    size="small"\n'
    '                    value={val}\n'
    '                    onChange={e => setVal(e.target.value)}\n'
    '                    onBlur={() => { updatePhaseDescription(phaseRef.current.id, val); setEditing(false); }}\n'
    '                    onPressEnter={() => { updatePhaseDescription(phaseRef.current.id, val); setEditing(false); }}\n'
    '                    autoFocus\n'
    '                    style={{ fontSize: 12 }}\n'
    '                    placeholder="输入说明..."\n'
    '                  />\n'
    '                );\n'
    '              }}\n'
    '            />\n'
    '            <Column\n'
    '              title="操作"'
)

if old_marker not in c:
    print("ERROR: 找不到『操作』列标记")
    # 尝试调试
    idx = c.find('title="操作"')
    print(f"  title=操作 位置: {idx}")
    exit(1)

c = c.replace(old_marker, new_marker, 1)
print("✅ 说明列已插入")

# 2. 调整列宽：阶段列 260→200，开始/结束日期 170→130
c = c.replace('width={260}', 'width={200}', 1)
# 开始日期和结束日期各有 width={170}，只替换前两个
count = 0
def repl_width(m):
    global count
    if count < 2:
        count += 1
        return 'width={130}'
    return m.group(0)
c = re.sub(r'width=\{170\}', repl_width, c)
print("✅ 列宽已调整")

with open(f, 'w', encoding='utf-8') as fp:
    fp.write(c)
print("✅ PlanSchedule.tsx 已更新")
