import re

f = r"C:\Users\chenxu\WorkBuddy\2026-06-30-20-42-22\project-manager\src\pages\PlanSchedule.tsx"
with open(f, 'r', encoding='utf-8') as fp:
    c = fp.read()

# 修复1: 第437行 重复的 }, [projectPhases...]
old1 = "  }, [projectPhases, currentProjectId, projects]);  }, [projectPhases, currentProjectId, projects]);"
new1 = "  }, [projectPhases, currentProjectId, projects]);"
if old1 in c:
    c = c.replace(old1, new1, 1)
    print("✅ 修复1: 重复依赖数组已移除")
else:
    print("⚠ 修复1: 未找到目标，跳过")

# 修复2: 第1244行 重复的 <Column（说明列前有多余的 <Column）
# 在说明列前应该只有一个 <Column（即说明列本身的开头）
# 查找 ".../>\n            <Column\n            <Column\n              title=\"说明\""
old2 = "/>\n            <Column>\n            <Column>\n              title=\"说明\""
new2 = "/>\n            <Column>\n              title=\"说明\""
if old2 in c:
    c = c.replace(old2, new2, 1)
    print("✅ 修复2: 重复 <Column> 已移除")
else:
    # 尝试查找其他模式
    idx = c.find('title="说明"')
    if idx >= 0:
        # 往前找80个字符，看看有什么
        snippet = c[max(0,idx-120):idx]
        print(f"⚠ 修复2: 未找到目标，说明列前内容: ...{snippet}...")
    else:
        print("⚠ 修复2: 未找到说明列")

with open(f, 'w', encoding='utf-8') as fp:
    fp.write(c)
print("✅ PlanSchedule.tsx 已修复")
