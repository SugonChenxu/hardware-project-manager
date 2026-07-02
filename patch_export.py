import re

f = r"C:\Users\chenxu\WorkBuddy\2026-06-30-20-42-22\project-manager\src\pages\PlanSchedule.tsx"
with open(f, 'r', encoding='utf-8') as fp:
    c = fp.read()

# 新的 handleExport 函数
new_export = """  // ── 导出 Excel（序号/阶段/任务/开始/结束/周期/说明，含公式，同阶段合并，美观格式）──
  const handleExport = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const ws = {};

    // 表头（第0行）
    const headers = ['序号', '阶段', '任务名称', '开始日期', '结束日期', '周期(天)', '说明'];
    const headerStyle = {
      font: { name: 'Microsoft YaHei', bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
      fill: { fgColor: { rgb: '1677FF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        bottom: { style: 'thin', color: { rgb: 'B0B0B0' } },
        left:   { style: 'thin', color: { rgb: 'D0D0D0' } },
        right:  { style: 'thin', color: { rgb: 'D0D0D0' } },
        top:    { style: 'thin', color: { rgb: 'D0D0D0' } },
      },
    };
    headers.forEach((h, ci) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
      ws[addr] = { v: h, t: 's', s: headerStyle };
    });

    // 数据行
    const n = projectPhases.length;
    const phaseGroupRanges: [string, number, number][] = []; // [phaseGroup, startRow, endRow]
    let currentGroup = '';
    let groupStartRow = 1;

    projectPhases.forEach((p, rowIdx) => {
      const r = rowIdx + 1;

      // 跟踪同阶段合并范围
      if (p.phaseGroup !== currentGroup) {
        if (currentGroup !== '') {
          phaseGroupRanges.push([currentGroup, groupStartRow, r - 1]);
        }
        currentGroup = p.phaseGroup;
        groupStartRow = r;
      }

      // 交替行底色
      const altFill = (rowIdx % 2 === 0)
        ? { fgColor: { rgb: 'F7F9FC' } }
        : { fgColor: { rgb: 'FFFFFF' } };
      const cellStyle = {
        font: { name: 'Microsoft YaHei', sz: 10 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        fill: altFill.fgColor,
        border: {
          left:   { style: 'hair', color: { rgb: 'D0D0D0' } },
          right:  { style: 'hair', color: { rgb: 'D0D0D0' } },
          bottom: { style: 'hair', color: { rgb: 'D0D0D0' } },
        },
      };
      const leftStyle = { ...cellStyle, alignment: { horizontal: 'left', vertical: 'center', wrapText: true } };

      // A: 序号
      ws[XLSX.utils.encode_cell({ r, c: 0 })] = { v: rowIdx + 1, t: 'n', s: cellStyle };
      // B: 阶段（合并后在下方统一处理）
      ws[XLSX.utils.encode_cell({ r, c: 1 })] = { v: p.phaseGroup, t: 's', s: leftStyle };
      // C: 任务名称
      ws[XLSX.utils.encode_cell({ r, c: 2 })] = { v: p.taskName, t: 's', s: leftStyle };
      // D: 开始日期（存为日期序列值，让Excel识别为日期）
      const [sy, sm, sd] = p.startDate.split('-').map(Number);
      const startDateSerial = Math.floor(new Date(sy, sm - 1, sd).getTime() / 86400000) + 25569;
      ws[XLSX.utils.encode_cell({ r, c: 3 })] = {
        v: startDateSerial, t: 'n', z: 'yyyy-mm-dd', s: cellStyle,
      };
      // E: 结束日期（公式 = 开始日期 + 周期）
      const startCell = XLSX.utils.encode_cell({ r, c: 3 }); // Dx
      const durCell   = XLSX.utils.encode_cell({ r, c: 5 }); // Fx
      const endDateSerial = startDateSerial + p.duration;
      ws[XLSX.utils.encode_cell({ r, c: 4 })] = {
        f: `${startCell}+${durCell}`,
        v: endDateSerial, t: 'n', z: 'yyyy-mm-dd',
        s: { ...cellStyle, font: { name: 'Microsoft YaHei', sz: 10, bold: p.isCriticalPath } },
      };
      // F: 周期(天)
      ws[XLSX.utils.encode_cell({ r, c: 5 })] = { v: p.duration, t: 'n', s: cellStyle };
      // G: 说明
      ws[XLSX.utils.encode_cell({ r, c: 6 })] = { v: p.description || '', t: 's', s: leftStyle };
    });

    // 最后一个阶段的范围
    if (currentGroup !== '') {
      phaseGroupRanges.push([currentGroup, groupStartRow, n]);
    }

    // 同阶段合并（B列 = column 1）
    const merges = [];
    for (const [, startR, endR] of phaseGroupRanges) {
      if (startR < endR) {
        merges.push({ s: { r: startR, c: 1 }, e: { r: endR, c: 1 } });
      }
    }
    ws['!merges'] = merges;

    // 列宽
    ws['!cols'] = [
      { wch: 6 },  // 序号
      { wch: 16 }, // 阶段
      { wch: 20 }, // 任务名称
      { wch: 12 }, // 开始日期
      { wch: 12 }, // 结束日期
      { wch: 10 }, // 周期
      { wch: 30 }, // 说明（宽一点）
    ];

    // sheet 范围
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: n, c: headers.length - 1 },
    });

    XLSX.utils.book_append_sheet(wb, ws, '项目排期计划');
    const project = projects.find((p) => p.id === currentProjectId);
    const fname = `${project?.name || '项目'}_排期计划_${dayjs().format('YYYYMMDD')}.xlsx`;
    XLSX.writeFile(wb, fname);
    message.success('排期已导出（含公式，可在Excel修改后重新导入）');
  }, [projectPhases, currentProjectId, projects]);"""

# 找到旧函数并替换
start_marker = "  // ── 导出 Excel（开始日期存值，结束日期=开始日期+周期公式，可在Excel端修改后反向上传）──\n  const handleExport = useCallback(() => {"
end_marker = "  }, [projectPhases, currentProjectId, projects]);\n\n  // ── 版本恢复 ──"

si = c.find(start_marker)
if si == -1:
    print("ERROR: 找不到 handleExport 开始标记")
    exit(1)

ei = c.find(end_marker, si)
if ei == -1:
    print("ERROR: 找不到 handleExport 结束标记")
    exit(1)

c = c[:si] + new_export + c[ei:]
print(f"✅ handleExport 已替换（行 {si}~{ei}）")

with open(f, 'w', encoding='utf-8') as fp:
    fp.write(c)
print("✅ PlanSchedule.tsx 已更新")
