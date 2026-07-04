# 版本管理指南

## 快速提交版本

每次完成一个功能或修复后，运行：

```bash
# 快速提交（自动填写日期和时间）
./save-version.sh "描述本次改动的内容"

# 例如：
./save-version.sh "修复关键路径显示问题"
./save-version.sh "添加 Excel 导出功能"
```

## 查看历史版本

```bash
# 查看提交历史
git log --oneline

# 查看详细历史
git log
```

## 回退到之前的版本

```bash
# 回退到某个版本（例如回退到初始版本）
git reset --hard bcd0e9f

# 或者，如果想保留修改后的回退：
git checkout bcd0e9f -- src/pages/PlanSchedule.tsx
```

## 版本标签（重要版本）

```bash
# 给当前版本打标签（例如 v1.0）
git tag -a v1.0 -m "第一个稳定版本"

# 查看所有标签
git tag

# 回退到某个标签的版本
git checkout v1.0
```

## 注意事项

1. **提交前测试**：确保代码能正常运行再提交
2. **提交信息清晰**：写明本次改动的内容，方便以后查找
3. **重要版本打标签**：稳定版本打标签，方便以后快速回退
4. **不要提交敏感信息**：API 密钥、密码等不要提交到 git

## 当前版本状态

- **初始版本**：`bcd0e9f` - 项目计划模块（含 IndexedDB 持久化）
