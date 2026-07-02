#!/bin/bash
# 快速保存版本脚本
# 用法: ./save-version.sh "版本描述"

if [ -z "$1" ]; then
    echo "错误：请提供版本描述"
    echo "用法: ./save-version.sh \"版本描述\""
    exit 1
fi

# 获取当前时间
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# 添加所有修改
git add .

# 提交（包含时间戳和描述）
git commit -m "[$TIMESTAMP] $1"

# 显示提交结果
echo "✅ 版本已保存！"
echo "提交信息: [$TIMESTAMP] $1"
echo ""
echo "当前版本历史："
git log --oneline -5
