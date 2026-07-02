import re

f = r"C:\Users\chenxu\WorkBuddy\2026-06-30-20-42-22\project-manager\src\pages\PlanSchedule.tsx"
with open(f, 'r', encoding='utf-8') as fp:
    c = fp.read()

# 新的 handleExcelImport 函数
new_import = """  // ── Excel 导入（支持导出格式反向上传：序号/阶段/任务/开始/结束/周期/说明）──
  const handleExcelImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (raw.length < 2) {
          message.error('文件为空，请检查 Excel');
          return;
        }

        // 解析表头（第0行），按列名定位
        const header = raw[0] as string[];
        const findCol = (keywords: string[]) => {
          return header.findIndex(h => keywords.some(k => String(h).includes(k)));
        };
        const phaseIdx = findCol(['阶段']);
        const taskIdx  = findCol(['任务', '任务名称']);
        const startIdx = findCol(['开始']);
        const endIdx   = findCol(['结束']);
        const durIdx   = findCol(['周期', '天数']);
        const descIdx  = findCol(['说明', '备注', '描述']);

        if (taskIdx === -1) {
          message.error('Excel 中未找到「任务名称」列');
          return;
        }

        // 解析每一行，匹配现有 phases 并更新
        let matched = 0;
        const updatedPhases = [...get().phases];

        for (let i = 1; i < raw.length; i++) {
          const row = raw[i] as (string | number | Date)[];
          const phaseGroup = phaseIdx >= 0 ? String(row[phaseIdx] ?? '').trim() : '';
          const taskName   = String(row[taskIdx] ?? '').trim();
          if (!taskName) continue;

          // 在现有 phases 中查找匹配（优先 taskName 完全匹配，其次 phaseGroup+taskName）
          const existingIdx = updatedPhases.findIndex(p =>
            p.taskName === taskName && (!phaseGroup || p.phaseGroup === phaseGroup)
          );
          if (existingIdx === -1) continue;

          // 解析开始日期
          let startDate = '';
          const startVal = startIdx >= 0 ? row[startIdx] : undefined;
          if (startVal != null) {
            if (typeof startVal === 'number' && startVal > 40000) {
              const d = XLSX.SSF.parse_date_code(startVal);
              startDate = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
            } else {
              const ds = dayjs(String(startVal));
              if (ds.isValid()) startDate = ds.format('YYYY-MM-DD');
            }
          }

          // 解析周期
          let duration = 0;
          const durVal = durIdx >= 0 ? row[durIdx] : undefined;
          if (durVal != null) {
            duration = Number(durVal) || 0;
          }

          // 解析结束日期（优先用公式结果，其次用开始+周期计算）
          let endDate = '';
          const endVal = endIdx >= 0 ? row[endIdx] : undefined;
          if (endVal != null) {
            if (typeof endVal === 'number' && endVal > 40000) {
              const d = XLSX.SSF.parse_date_code(endVal);
              endDate = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
            } else {
              const de = dayjs(String(endVal));
              if (de.isValid()) endDate = de.format('YYYY-MM-DD');
            }
          }
          // 如果没有结束日期但有开始日期和周期，自动计算
          if (!endDate && startDate && duration > 0) {
            endDate = dayjs(startDate).add(duration, 'day').format('YYYY-MM-DD');
          }

          // 解析说明
          let description = '';
          if (descIdx >= 0 && row[descIdx] != null) {
            description = String(row[descIdx]).trim();
          }

          // 更新 phase
          const orig = updatedPhases[existingIdx];
          updatedPhases[existingIdx] = {
            ...orig,
            ...(startDate ? { startDate, lockStart: true } : {}),
            ...(endDate   ? { endDate,   lockEnd: true   } : {}),
            ...(duration  ? { duration } : {}),
            ...(description !== '' ? { description } : {}),
            status: computeStatusFull(
              startDate || orig.startDate,
              endDate   || orig.endDate
            ),
          };
          matched++;
        }

        if (matched === 0) {
          message.error('未能匹配到任何现有任务，请确认 Excel 列名与系统一致');
          return;
        }

        // 保存并更新
        set({ phases: updatedPhases, isDirty: true });
        detectParallelAndCritical();
        message.success(`已更新 ${matched} 个任务（含说明字段），请点击「确认保存」写入本地`);
      } catch (err) {
        message.error('Excel 解析失败，请检查文件格式');
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
    return false;
  }, [currentProjectId, get, set, detectParallelAndCritical]);"""

# 找旧函数起止位置
start_str = "  // ── Excel 导入 ──\n  const handleExcelImport = useCallback((file: File) => {"
end_str   = "  }, [importTemplate]);"

si = c.find(start_str)
if si == -1:
    print("ERROR: 找不到 handleExcelImport 开始")
    exit(1)

ei = c.find(end_str, si)
if ei == -1:
    print("ERROR: 找不到 handleExcelImport 结束")
    exit(1)

c = c[:si] + new_import + c[ei + len(end_str):]
print(f"✅ handleExcelImport 已替换（{si}~{ei}）")

with open(f, 'w', encoding='utf-8') as fp:
    fp.write(c)
print("✅ PlanSchedule.tsx 已更新")
