import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Card, Button, Table, Modal, Input, InputNumber, DatePicker, Space, Popconfirm, Tag,
  Typography, Row, Col, message, Upload, Timeline, Empty, Switch, Tooltip, Alert, Select,
} from 'antd';
import {
  PlusOutlined, UploadOutlined, LockOutlined, UnlockOutlined,
  DeleteOutlined, SaveOutlined, HistoryOutlined, ReloadOutlined,
  DownloadOutlined, CheckCircleOutlined, ClockCircleOutlined, InfoCircleOutlined,
  MinusCircleOutlined, EditOutlined, CloseOutlined, InsertRowBelowOutlined,
  LinkOutlined, FolderAddOutlined, DownOutlined, RightOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/zh-cn';
import zhCN from 'antd/locale/zh_CN';
import * as XLSX from 'xlsx';
import usePlanStore from '../store/usePlanStore';
import { useProjectStore } from '../store/useProjectStore';
import { PlanPhase, PlanTemplatePhase, PlanHistory } from '../types';
import { generateId } from '../utils/storage';
import { computeStatusFull } from '../store/usePlanStore';

dayjs.locale('zh-cn');

const { Text } = Typography;
const { Column } = Table;

// ── 甘特图颜色 ──
const GANTT_COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1',
  '#13c2c2', '#f5222d', '#faad14', '#2f54eb', '#a0d911',
];

const STATUS_CONFIG = {
  completed: { color: '#d9d9d9', text: '已完成', icon: <CheckCircleOutlined /> },
  in_progress: { color: '#1677ff', text: '进行中', icon: <ClockCircleOutlined /> },
  upcoming: { color: '#8c8c8c', text: '未开始', icon: <MinusCircleOutlined /> },
};

const PHASE_COLORS: Record<string, string> = {
  'M1预研阶段': '#722ed1',
  'M2计划阶段': '#1677ff',
  'M3研发测试阶段': '#fa8c16',
  'M4试制阶段': '#eb2f96',
  'M5新品导入阶段': '#13c2c2',
  // 保留旧阶段名兼容性
  '计划阶段': '#1677ff',
  '详细设计阶段': '#52c41a',
  '研发测试阶段': '#fa8c16',
  '试制阶段': '#eb2f96',
};

// ── 组件 ──

const PlanSchedule: React.FC = () => {
  const { currentProjectId, projects, setCurrent } = useProjectStore();
  const {
    phases, history, isDirty,
    importTemplate, generateFromTemplate, getByProject,
    addPhase, addPhaseAfter, removePhase, updatePhaseDate, updatePhaseTaskName, updatePhaseDescription,
    toggleLockStart, toggleLockEnd, toggleLink, confirmSave, discardChanges,
    refreshStatuses, detectParallelAndCritical,
    loadHistory, getHistoryByProject,
    addPhaseGroup, removePhaseGroup, updatePhaseGroupName,
    load, debug,
  } = usePlanStore();

  // 如果 currentProjectId 为空，自动选择第一个项目
  useEffect(() => {
    if (!currentProjectId && projects.length > 0) {
      console.log('⚠️ currentProjectId 为空，自动选择第一个项目:', projects[0].id);
      setCurrent(projects[0].id);
    }
  }, [currentProjectId, projects, setCurrent]);

  // 暴露 debug 函数到全局，方便在控制台调用
  useEffect(() => {
    (window as any).debugPlan = () => {
      console.log('🔍 ===== 计划数据调试 =====');
      console.log('🔍 当前项目ID:', currentProjectId);
      console.log('🔍 项目列表:', projects.map((p: any) => ({ id: p.id, name: p.name })));
      console.log('🔍 所有任务数 (phases):', phases.length);
      console.log('🔍 isDirty:', isDirty);
      
      if (currentProjectId) {
        const projectPhases = getByProject(currentProjectId);
        console.log('🔍 当前项目的任务数:', projectPhases.length);
        console.log('🔍 当前项目的任务:', projectPhases);
      } else {
        console.log('⚠️ 没有选择项目！');
      }
      console.log('🔍 =======================');
    };
    console.log('💡 提示：在控制台输入 window.debugPlan() 查看计划数据状态');
  }, [currentProjectId, projects, phases, isDirty]);

  const [editingCell, setEditingCell] = useState<{ id: string; field: 'startDate' | 'endDate' | 'duration' } | null>(null);
  const [editingTaskNameId, setEditingTaskNameId] = useState<string | null>(null);
  const [editingTaskNameValue, setEditingTaskNameValue] = useState('');
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState('');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [tempDateValue, setTempDateValue] = useState<Dayjs | null>(null);
  const tempDateValueRef = React.useRef<Dayjs | null>(null);
  const [tempDurationValue, setTempDurationValue] = useState<number>(7);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showGantt, setShowGantt] = useState(true);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [addGroupModalOpen, setAddGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [renameGroupModalOpen, setRenameGroupModalOpen] = useState(false);
  const [renameGroupOldName, setRenameGroupOldName] = useState('');
  const [renameGroupNewName, setRenameGroupNewName] = useState('');

  useEffect(() => { load(); }, []);

  // 监听 currentProjectId 变化，打印调试信息
  useEffect(() => {
    console.log('🔍 currentProjectId 变化:', currentProjectId);
    if (currentProjectId) {
      const projectPhases = getByProject(currentProjectId);
      console.log('🔍 当前项目的任务数:', projectPhases.length);
    }
  }, [currentProjectId]);

  const projectPhases = useMemo(
    () => {
      const result = currentProjectId ? getByProject(currentProjectId) : [];
      console.log('🔍 projectPhases 计算:', result.length, '个任务');
      return result;
    },
    [currentProjectId, phases],
  );

  const projectHistory = useMemo(
    () => (currentProjectId ? getHistoryByProject(currentProjectId) : []),
    [currentProjectId, history],
  );

  // 分组后的阶段数据（含阶段时间范围）
  const groupedPhases = useMemo(() => {
    const groups: Record<string, {
      group: string;
      items: PlanPhase[];
      startDate: string;
      endDate: string;
      totalDays: number;
      color: string;
    }> = {};

    for (const p of projectPhases) {
      if (!groups[p.phaseGroup]) {
        groups[p.phaseGroup] = {
          group: p.phaseGroup,
          items: [],
          startDate: p.startDate,
          endDate: p.endDate,
          totalDays: 0,
          color: PHASE_COLORS[p.phaseGroup] || '#1677ff',
        };
      }
      const g = groups[p.phaseGroup];
      g.items.push(p);
      if (p.startDate < g.startDate) g.startDate = p.startDate;
      if (p.endDate > g.endDate) g.endDate = p.endDate;
    }

    return Object.values(groups).map(g => ({
      ...g,
      totalDays: Math.max(1, dayjs(g.endDate).diff(dayjs(g.startDate), 'day') + 1),
    }));
  }, [projectPhases]);

  // 自动展开/折叠（顶层任务可展开子任务）
  const suggestPhaseGroupName = useMemo(() => {
    const existing = groupedPhases.map(g => g.group);
    const candidates = ['M6量产阶段', 'M7维护阶段', 'M8迭代阶段'];
    return candidates.find(c => !existing.includes(c)) || '新阶??段';
  }, [groupedPhases]);

  // ── Excel 导入 ──
  const handleExcelImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (rows.length < 2) {
          message.error('Excel 为空或格式不正确');
          return;
        }

        // 找列索引
        const header = rows[0] as string[];
        const nameIdx = header.findIndex(h => /任务名称/.test(h));
        const startIdx = header.findIndex(h => /开始日期/.test(h));
        const endIdx = header.findIndex(h => /结束日期/.test(h));
        const durIdx = header.findIndex(h => /周期/.test(h));
        const descIdx = header.findIndex(h => /说明/.test(h));

        if (nameIdx < 0 || startIdx < 0) {
          message.error('Excel 列名不正确，需要包含"任务名称"和"开始日期"列');
          return;
        }

        // 遍历现有 phases，按任务名匹配更新
        const updatedPhases = [...usePlanStore.getState().phases];
        let matched = 0;

        for (let ri = 1; ri < rows.length; ri++) {
          const row = rows[ri];
          if (!row || row.length === 0) continue;
          const taskName = String(row[nameIdx] || '').trim();
          if (!taskName) continue;

          // 在现有 phases 中查找同名任务
          const existingIdx = updatedPhases.findIndex(p =>
            p.taskName.trim() === taskName && p.projectId === currentProjectId
          );
          if (existingIdx < 0) continue;

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
        usePlanStore.setState({ phases: updatedPhases });
        detectParallelAndCritical();
        message.success(`已更新 ${matched} 个任务（含说明字段），数据已自动保存`);
      } catch (err) {
        message.error('Excel 解析失败，请检查文件格式');
        console.error(err);
      }
    };
    reader.readAsBinaryString(file);
    return false;
  }, [currentProjectId, detectParallelAndCritical]);

  // ── 一键创建计划（以今日为基准，使用内置默认模板）──
  const handleCreatePlan = useCallback(() => {
    if (!currentProjectId) {
      message.warning('请先选择项目');
      return;
    }
    generateFromTemplate(currentProjectId, dayjs().format('YYYY-MM-DD'));
    message.success(`已基于今日（${dayjs().format('YYYY-MM-DD')}）自动生成排期计划，请检查并确认保存`);
  }, [currentProjectId, generateFromTemplate]);

  // ── 日期编辑 ──
  const handleDateChange = useCallback((id: string, field: 'startDate' | 'endDate', value: Dayjs | null) => {
    if (!value) return;
    updatePhaseDate(id, field, value.format('YYYY-MM-DD'));
    setEditingCell(null);
  }, [updatePhaseDate]);

  const handleDurationChange = useCallback((id: string, field: 'duration', value: number | null) => {
    if (value == null || value <= 0) return;
    updatePhaseDate(id, field, value);
    setEditingCell(null);
  }, [updatePhaseDate]);

  // ── 保存确认 ──
  const handleConfirm = useCallback(() => {
    if (!currentProjectId) return;
    confirmSave(currentProjectId);
    message.success('排期已保存');
  }, [currentProjectId, confirmSave]);

  // ── 计算甘特图数据 ──
  const ganttRange = useMemo(() => {
    if (projectPhases.length === 0) return { min: dayjs(), max: dayjs().add(90, 'day'), totalDays: 90 };
    let min = dayjs(projectPhases[0].startDate);
    let max = dayjs(projectPhases[0].endDate);
    for (const p of projectPhases) {
      if (dayjs(p.startDate).isBefore(min)) min = dayjs(p.startDate);
      if (dayjs(p.endDate).isAfter(max)) max = dayjs(p.endDate);
    }
    return { min, max, totalDays: Math.max(1, max.diff(min, 'day')) };
  }, [projectPhases]);

  // ── 导出 Excel（序号/阶段/任务/开始/结束/周期/说明，含公式，同阶段合并，美观格式）──
  const handleExport = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const ws: any = {};

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

    projectPhases.forEach((p: PlanPhase, rowIdx: number) => {
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
  }, [projectPhases, currentProjectId, projects]);

  // ── 版本恢复 ──
  const handleRestoreVersion = useCallback((historyId: string) => {
    loadHistory(historyId);
    message.success('已恢复至该版本');
    setHistoryModalOpen(false);
  }, [loadHistory]);

  // ── 行内编辑渲染 ──
  const renderDateCell = (phase: PlanPhase, field: 'startDate' | 'endDate') => {
    const isEditing = editingCell?.id === phase.id && editingCell?.field === field;
    const val = field === 'startDate' ? phase.startDate : phase.endDate;
    const label = field === 'startDate' ? '开始' : '结束';
    const isLocked = field === 'startDate' ? phase.lockStart : phase.lockEnd;
    const toggleLockFn = field === 'startDate' ? toggleLockStart : toggleLockEnd;
    
    // 判断是否为父任务（有子任务的）
    const isParentTask = phase._hasChildren;
    
    // 查找同级别上一节点的结束时间（用于快捷选择）
    // 子任务 → 上一兄弟；顶层/父任务 → 上一顶层节点
    const projectPhasesSorted = projectPhases.sort((a: PlanPhase, b: PlanPhase) => a.sortOrder - b.sortOrder);
    const currentIdx = projectPhasesSorted.findIndex((p: PlanPhase) => p.id === phase.id);
    const prevLinkedEndDate = (() => {
      if (currentIdx <= 0) return '';
      if (phase.parentId) {
        // 子任务：找上一兄弟节点（相同 parentId）
        for (let i = currentIdx - 1; i >= 0; i--) {
          const p = projectPhasesSorted[i];
          if (p.parentId === phase.parentId) return p.endDate;
        }
        return '';
      } else {
        // 顶层/父任务：找上一顶层节点（无 parentId）
        for (let i = currentIdx - 1; i >= 0; i--) {
          const p = projectPhasesSorted[i];
          if (!p.parentId) return p.endDate;
        }
        return '';
      }
    })();

    if (isEditing) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
          <DatePicker
            size="small"
            value={tempDateValue}
            onChange={(d) => {
              setTempDateValue(d);
              tempDateValueRef.current = d;
            }}
            open={datePickerOpen}
            onOpenChange={(isOpen) => {
              setDatePickerOpen(isOpen);
              if (!isOpen) {
                // 面板关闭：如果用户选了日期 → 自动确认；否则取消编辑
                if (tempDateValueRef.current?.isValid()) {
                  handleDateChange(phase.id, field, tempDateValueRef.current);
                } else {
                  setEditingCell(null);
                }
              }
            }}
            autoFocus
            style={{ width: 130 }}
            format="YYYY-MM-DD"
            allowClear={false}
            disabled={isLocked}
            locale={zhCN.DatePicker}
            placeholder="选择日期"
            inputReadOnly={false}
          />
          <Button
            size="small"
            type="text"
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            onClick={() => {
              if (tempDateValue) handleDateChange(phase.id, field, tempDateValue);
            }}
            title="确认"
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<CloseOutlined />}
            onClick={() => {
              setEditingCell(null);
              setDatePickerOpen(false);
            }}
            title="取消"
          />
          {field === 'startDate' && prevLinkedEndDate && (
            <Button
              size="small"
              type="link"
              onClick={() => {
                handleDateChange(phase.id, field, dayjs(prevLinkedEndDate));
              }}
              title={`接上一流程结束时间 ${prevLinkedEndDate}`}
              style={{ fontSize: 11, padding: '0 4px', whiteSpace: 'nowrap' }}
            >
              接上
            </Button>
          )}
        </div>
      );
    }

    return (
      <Tooltip title={isParentTask ? `父任务时间由子任务自动计算（可手动覆盖）` : `点击编辑${label}日期`}>
        <div
          onClick={() => {
            if (!isLocked) {
              setEditingCell({ id: phase.id, field });
              const dv = val ? dayjs(val) : null;
              setTempDateValue(dv);
              tempDateValueRef.current = dv;
              setDatePickerOpen(true);
            }
          }}
          style={{ 
            cursor: isLocked ? 'not-allowed' : 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4,
            backgroundColor: isParentTask ? '#f6ffed' : 'transparent',
            padding: isParentTask ? '2px 6px' : 0,
            borderRadius: 4
          }}
        >
          <ClockCircleOutlined style={{ fontSize: 11, color: isParentTask ? '#52c41a' : '#999' }} />
          <Text style={{ opacity: phase.status === 'completed' ? 0.55 : 1, fontSize: 13 }}>
            {val || '-'}
          </Text>
          <Tooltip title={isLocked ? `解锁${label}日期（允许修改）` : `锁定${label}日期（固定不变）`}>
            <span
              onClick={(e) => { e.stopPropagation(); toggleLockFn(phase.id); }}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            >
              {isLocked ? <LockOutlined style={{ fontSize: 10, color: '#fa8c16' }} /> : <UnlockOutlined style={{ fontSize: 10, color: '#d9d9d9' }} />}
            </span>
          </Tooltip>
          {isParentTask && (
            <Tooltip title="自动计算">
              <span style={{ fontSize: 9, color: '#52c41a', fontWeight: 500 }}>AUTO</span>
            </Tooltip>
          )}
        </div>
      </Tooltip>
    );
  };

  const renderDurationCell = (phase: PlanPhase) => {
    if (phase.lockEnd) return <Text style={{ opacity: 0.55 }}>{phase.duration} 天</Text>;

    const isEditing = editingCell?.id === phase.id && editingCell?.field === 'duration';
    if (isEditing) {
      return (
        <InputNumber
          size="small"
          min={1}
          max={365}
          value={tempDurationValue}
          onChange={(v) => setTempDurationValue(v ?? 7)}
          onBlur={() => handleDurationChange(phase.id, 'duration', tempDurationValue)}
          onPressEnter={() => handleDurationChange(phase.id, 'duration', tempDurationValue)}
          autoFocus
          style={{ width: 80 }}
          addonAfter="天"
        />
      );
    }
    return (
      <Tooltip title="点击编辑周期">
        <div
          onClick={() => {
            if (!phase.lockEnd) {
              setEditingCell({ id: phase.id, field: 'duration' });
              setTempDurationValue(phase.duration);
            }
          }}
          style={{
            cursor: phase.lockEnd ? 'not-allowed' : 'pointer',
            opacity: phase.status === 'completed' ? 0.55 : 1,
            fontSize: 13,
          }}
        >
          {phase.duration} 天
        </div>
      </Tooltip>
    );
  };

  const renderTaskNameCell = (phase: PlanPhase) => {
    const isEditing = editingTaskNameId === phase.id;

    if (isEditing) {
      return (
        <Input
          size="small"
          value={editingTaskNameValue}
          onChange={(e) => setEditingTaskNameValue(e.target.value)}
          onBlur={() => {
            updatePhaseTaskName(phase.id, editingTaskNameValue);
            setEditingTaskNameId(null);
          }}
          onPressEnter={() => {
            updatePhaseTaskName(phase.id, editingTaskNameValue);
            setEditingTaskNameId(null);
          }}
          autoFocus
          style={{ width: '100%' }}
        />
      );
    }

    return (
      <div
        onClick={() => {
          setEditingTaskNameId(phase.id);
          setEditingTaskNameValue(phase.taskName);
        }}
        style={{
          cursor: 'pointer',
          opacity: phase.status === 'completed' ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {phase.taskName}
        <EditOutlined style={{ fontSize: 10, color: '#bbb' }} />
      </div>
    );
  };

  const renderStatus = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.upcoming;
    return (
      <Tag
        icon={config.icon}
        style={{
          color: status === 'completed' ? '#999' : config.color,
          background: status === 'completed' ? '#f0f0f0' : `${config.color}15`,
          border: `1px solid ${status === 'completed' ? '#d9d9d9' : config.color}40`,
          borderRadius: 10,
        }}
      >
        {config.text}
      </Tag>
    );
  };

  // ── 甘特图 ──
  const ganttChart = useMemo(() => {
    if (!showGantt || projectPhases.length === 0) return null;

    const { min, totalDays } = ganttRange;

    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#555' }}>排期甘特图</div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 800 }}>
            {/* 表头——月份刻度 */}
            <div style={{ display: 'flex', borderBottom: '1px solid #eee', paddingBottom: 4, marginBottom: 4 }}>
              <div style={{ width: 180, flexShrink: 0, fontSize: 11, color: '#999', paddingLeft: 8 }}>任务</div>
              <div style={{ flex: 1, display: 'flex' }}>
                {Array.from({ length: Math.min(totalDays + 1, 120) }, (_, i) => {
                  const d = min.add(i, 'day');
                  const showLabel = d.date() === 1 || i === 0;
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        minWidth: 12,
                        fontSize: 9,
                        color: '#bbb',
                        textAlign: 'center',
                        borderLeft: showLabel ? '1px solid #e0e0e0' : 'none',
                      }}
                    >
                      {showLabel ? d.format('M/D') : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 甘特条 */}
            {projectPhases.map((phase, idx) => {
              const offsetDays = Math.max(0, dayjs(phase.startDate).diff(min, 'day'));
              const barDays = Math.max(1, dayjs(phase.endDate).diff(dayjs(phase.startDate), 'day') + 1);
              const color = PHASE_COLORS[phase.phaseGroup] || GANTT_COLORS[idx % GANTT_COLORS.length];
              const isCompleted = phase.status === 'completed';

              return (
                <div
                  key={phase.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 2,
                    opacity: isCompleted ? 0.5 : 1,
                  }}
                >
                  {/* 任务名 */}
                  <div
                    style={{
                      width: 180,
                      flexShrink: 0,
                      fontSize: 12,
                      paddingLeft: 8,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <Tooltip title={`${phase.phaseGroup} > ${phase.taskName}`}>
                      <span>
                        {phase.isCriticalPath && <span style={{ color: '#ff4d4f', marginRight: 4 }}>★</span>}
                        {(phase.lockEnd || phase.lockStart) && <LockOutlined style={{ fontSize: 10, color: '#fa8c16', marginRight: 4 }} />}
                        {phase.taskName}
                      </span>
                    </Tooltip>
                  </div>

                  {/* 甘特条 */}
                  <div style={{ flex: 1, height: 28, position: 'relative' }}>
                    {/* 网格线 */}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                      {Array.from({ length: Math.min(totalDays + 1, 120) }, (_, i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            minWidth: 12,
                            borderLeft: '1px solid #f5f5f5',
                          }}
                        />
                      ))}
                    </div>
                    {/* 进度条 */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${(offsetDays / totalDays) * 100}%`,
                        width: `${(barDays / totalDays) * 100}%`,
                        height: 22,
                        top: 3,
                        borderRadius: 4,
                        background: phase.isCriticalPath
                          ? `linear-gradient(135deg, ${color}, ${color}dd)`
                          : `linear-gradient(135deg, ${color}88, ${color}44)`,
                        border: phase.isCriticalPath ? `2px solid ${color}` : `1px solid ${color}60`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        color: phase.isCriticalPath ? '#fff' : '#555',
                        fontWeight: phase.isCriticalPath ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        minWidth: 0,
                      }}
                      onClick={() => setEditingCell({ id: phase.id, field: 'endDate' })}
                      title={phase.isCriticalPath ? '关键路径（制约整体工期）' : ''}
                    >
                      {barDays > 20 ? `${phase.duration}天` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 图例 */}
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          {groupedPhases.map((g) => (
            <div key={g.group} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: g.color }} />
              <span style={{ color: '#666' }}>{g.group}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: '#ff4d4f', fontWeight: 600 }}>★</span>
            <span style={{ color: '#666' }}>关键路径</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <LockOutlined style={{ color: '#fa8c16', fontSize: 12 }} />
            <span style={{ color: '#666' }}>开始/结束锁定</span>
          </div>
        </div>
      </div>
    );
  }, [showGantt, projectPhases, ganttRange, groupedPhases]);

  // ── 表格数据（手动展开/折叠，平铺 + _isChild 标识） ──
  const tableData = useMemo(() => {
    const result: (PlanPhase & {
      _rowType: 'group' | 'item';
      _groupName?: string;
      _groupStartDate?: string;
      _groupEndDate?: string;
      _groupTotalDays?: number;
      _groupColor?: string;
      _rowKey: string;
      _isChild?: boolean;
      _parentId?: string;
      _hasChildren?: boolean;
      _childrenCount?: number;
    })[] = [];

    for (const g of groupedPhases) {
      // 阶段标题行
      result.push({
        ...g.items[0],
        _rowType: 'group' as const,
        _groupName: g.group,
        _groupStartDate: g.startDate,
        _groupEndDate: g.endDate,
        _groupTotalDays: g.totalDays,
        _groupColor: g.color,
        _rowKey: `group-${g.group}`,
      } as any);

      // 构建 parentId → children 映射
      const childrenMap = new Map<string, PlanPhase[]>();
      const topLevel: PlanPhase[] = [];
      for (const item of g.items) {
        if (item.parentId) {
          const siblings = childrenMap.get(item.parentId) || [];
          siblings.push(item);
          childrenMap.set(item.parentId, siblings);
        } else {
          topLevel.push(item);
        }
      }

      // 平铺展开：父行 → 子行（仅展开时）
      for (const item of topLevel.sort((a, b) => a.sortOrder - b.sortOrder)) {
        const children = childrenMap.get(item.id) || [];
        const hasChildren = children.length > 0;
        // 父行
        result.push({
          ...item,
          _rowType: 'item' as const,
          _rowKey: item.id,
          _hasChildren: hasChildren,
          _childrenCount: children.length,
        } as any);
        // 子行（仅在展开时渲染）
        if (hasChildren && expandedParents.has(item.id)) {
          for (const child of children.sort((a, b) => a.sortOrder - b.sortOrder)) {
            result.push({
              ...child,
              _rowType: 'item' as const,
              _rowKey: `child-${child.id}`,
              _isChild: true,
              _parentId: item.id,
            } as any);
          }
        }
      }
    }
    return result;
  }, [groupedPhases, expandedParents]);

  if (!currentProjectId) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
        <h3>请先在顶部选择项目</h3>
      </div>
    );
  }

  // 测试保存函数
  const testSave = async () => {
    console.log('🧪 测试保存...');
    const testPhases = [
      {
        id: 'test-1',
        projectId: currentProjectId,
        phaseGroup: '测试阶段',
        taskName: '测试任务1',
        startDate: '2026-01-01',
        endDate: '2026-01-07',
        duration: 7,
        lockStart: false,
        lockEnd: false,
        linked: true,
        isCriticalPath: false,
        isParallel: false,
        parallelGroup: 'L1',
        status: 'upcoming' as const,
        sortOrder: 0,
        parentId: undefined,
        description: '测试数据',
      }
    ];
    try {
      const { dbSetPlanPhases } = await import('../utils/db');
      await dbSetPlanPhases(testPhases);
      console.log('✅ 测试数据已保存到 IndexedDB');
      message.success('测试数据已保存，正在重新加载...');
      
      // 重新加载
      await load();
    } catch (e) {
      console.error('❌ 测试保存失败:', e);
      message.error('测试保存失败: ' + e);
    }
  };

  return (
    <div>
      <style>
        {`
          .plan-completed-row {
            opacity: 0.45;
          }
          .plan-completed-row:hover > td {
            opacity: 0.7;
          }
        `}
      </style>

      {/* ── 调试面板 ── */}
      <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff', border: '1px solid #91caff' }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <Space>
              <Tag color="blue">项目选择</Tag>
              <Select
                value={currentProjectId}
                onChange={(id) => setCurrent(id)}
                placeholder="选择项目"
                style={{ width: 200 }}
                size="small"
              >
                {projects.map(p => (
                  <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                ))}
              </Select>
              <Tag color={currentProjectId ? 'green' : 'red'}>
                {currentProjectId ? '已选择' : '未选择'}
              </Tag>
            </Space>
          </Col>
          <Col>
            <Space>
              <span style={{ fontSize: 12 }}>总任务数: {phases.length}</span>
              <span style={{ fontSize: 12 }}>当前项目任务: {currentProjectId ? getByProject(currentProjectId).length : 0}</span>
              <Button size="small" type="primary" onClick={load}>
                重新加载
              </Button>
              <Button size="small" onClick={() => {
                const store = usePlanStore.getState();
                console.log('📦 完整store状态:', store);
                message.info('已打印完整状态到控制台');
              }}>
                打印状态
              </Button>
            </Space>
          </Col>
        </Row>
        {(!currentProjectId || getByProject(currentProjectId).length === 0) && (
          <Alert
            type="warning"
            message="暂无数据显示"
            description={!currentProjectId ? '请先在上方选择项目' : '当前项目没有任务数据，请点击"创建计划"添加'}
            showIcon
            style={{ marginTop: 8 }}
          />
        )}
      </Card>

      {/* ── 未保存提示 ── */}
      {isDirty && (
        <Alert
          type="warning"
          message="有未保存的修改"
          description=" data has been modified, please save or discard"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Space>
              <Button size="small" onClick={discardChanges}>
                撤销
              </Button>
              <Button size="small" type="primary" onClick={() => currentProjectId && confirmSave(currentProjectId)}>
                确认保存
              </Button>
            </Space>
          }
        />
      )}

      {/* ── 工具栏 ── */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col flex="auto">
            <Space wrap>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreatePlan}
              >
                创建计划
              </Button>

              <Upload
                accept=".xlsx,.xls"
                showUploadList={false}
                beforeUpload={handleExcelImport}
              >
                <Button icon={<UploadOutlined />} type="default">
                  更新模板
                </Button>
              </Upload>

              <Button
                icon={<FolderAddOutlined />}
                onClick={() => {
                  setNewGroupName(suggestPhaseGroupName);
                  setAddGroupModalOpen(true);
                }}
              >
                添加大阶段
              </Button>

              {projectPhases.length > 0 && (
                <>
                  <Button icon={<ReloadOutlined />} onClick={refreshStatuses}>
                    刷新状态
                  </Button>

                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                  >
                    导出 Excel
                  </Button>
                  <Button
                    icon={<HistoryOutlined />}
                    onClick={() => setHistoryModalOpen(true)}
                    disabled={projectHistory.length === 0}
                  >
                    版本历史 ({projectHistory.length})
                  </Button>
                </>
              )}
            </Space>
          </Col>

          <Col>
            <Space>
              <Switch
                checked={showGantt}
                onChange={setShowGantt}
                checkedChildren="甘特图"
                unCheckedChildren="甘特图"
              />
              {projectPhases.length > 0 && (
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={() => currentProjectId && confirmSave(currentProjectId)}
                  disabled={!isDirty}
                >
                  确认保存
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── 计划表格 ── */}
      {projectPhases.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Table
            dataSource={tableData}
            rowKey="_rowKey"
            size="small"
            pagination={false}
            bordered
            indentSize={0}
            rowClassName={(r: any) => {
              const classes = [];
              if (r._rowType === 'group') classes.push('plan-group-row');
              else if (r._isChild) classes.push('plan-child-row');
              if (r.status === 'completed') classes.push('plan-completed-row');
              return classes.join(' ');
            }}
            expandable={{
              expandedRowKeys: Array.from(expandedParents),
              onExpand: (expanded, record: any) => {
                if (record._rowType === 'item' && record._hasChildren) {
                  setExpandedParents(prev => {
                    const next = new Set(prev);
                    if (expanded) next.add(record.id);
                    else next.delete(record.id);
                    return next;
                  });
                }
              },
              rowExpandable: (r: any) => r._hasChildren,
            }}
          >
            <Column
              title="阶段 / 任务"
              dataIndex="phaseGroup"
              width={200}
              render={(val, record: any) => {
                if (record._rowType === 'group') {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: record._groupColor }} />
                      <span>{record._groupName}</span>
                      <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>
                        {record._groupStartDate} ~ {record._groupEndDate}（{record._groupTotalDays}天）
                      </span>
                    </div>
                  );
                }
                return (
                  <div style={{ 
                    paddingLeft: record._isChild ? 32 : 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    {/* 展开/折叠按钮 */}
                    {record._hasChildren && (
                      <Button
                        type="text"
                        size="small"
                        icon={expandedParents.has(record.id) ? <DownOutlined /> : <RightOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedParents(prev => {
                            const next = new Set(prev);
                            if (expandedParents.has(record.id)) {
                              next.delete(record.id);
                            } else {
                              next.add(record.id);
                            }
                            return next;
                          });
                        }}
                        style={{ 
                          width: 20, 
                          height: 20, 
                          padding: 0, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: 10,
                          color: '#1677ff'
                        }}
                      />
                    )}
                    {/* 缩进图标 */}
                    {record._isChild && <span style={{ color: '#1677ff', fontSize: 12 }}>└</span>}
                    {/* 任务名称 */}
                    <div style={{ flex: 1 }}>
                      {renderTaskNameCell(record)}
                    </div>
                  </div>
                );
              }}
            />
            <Column title="开始日期" dataIndex="startDate" width={130} render={(val, record: any) => record._rowType === 'group' ? null : renderDateCell(record, 'startDate')} />
            <Column title="结束日期" dataIndex="endDate" width={130} render={(val, record: any) => record._rowType === 'group' ? null : renderDateCell(record, 'endDate')} />
            <Column title="周期(天)" dataIndex="duration" width={90} render={(val, record: any) => record._rowType === 'group' ? null : renderDurationCell(record)} />
            <Column title="状态" dataIndex="status" width={100} render={(val, record: any) => record._rowType === 'group' ? null : renderStatus(record.status)} />
            <Column
              title="关键路径"
              width={80}
              render={(val, record: any) => {
                if (record._rowType === 'group') return null;
                return (
                  <div style={{ textAlign: 'center' }}>
                    {record.isCriticalPath ? (
                      <Tag color="red">★ 关键</Tag>
                    ) : (
                      <span style={{ color: '#ccc' }}>-</span>
                    )}
                  </div>
                );
              }}
            />
            <Column
              title="说明"
              dataIndex="description"
              width={200}
              render={(val, record: any) => {
                if (record._rowType === 'group') return null;
                const isEditing = editingDescriptionId === record.id;
                if (isEditing) {
                  return (
                    <Input
                      size="small"
                      value={editingDescriptionValue}
                      onChange={(e) => setEditingDescriptionValue(e.target.value)}
                      onBlur={() => {
                        updatePhaseDescription(record.id, editingDescriptionValue);
                        setEditingDescriptionId(null);
                      }}
                      onPressEnter={() => {
                        updatePhaseDescription(record.id, editingDescriptionValue);
                        setEditingDescriptionId(null);
                      }}
                      autoFocus
                      style={{ width: '100%' }}
                    />
                  );
                }
                return (
                  <div
                    onClick={() => {
                      setEditingDescriptionId(record.id);
                      setEditingDescriptionValue(record.description || '');
                    }}
                    style={{ cursor: 'pointer', minHeight: 24, padding: '4px 0' }}
                  >
                    {record.description || <span style={{ color: '#ccc' }}>点击编辑</span>}
                  </div>
                );
              }}
            />
            <Column
              title="操作"
              width={120}
              render={(val, record: any) => {
                if (record._rowType === 'group') {
                  return (
                    <Space size={4}>
                      <Button size="small" type="link" onClick={() => { setRenameGroupOldName(record._groupName); setRenameGroupNewName(record._groupName); setRenameGroupModalOpen(true); }}>重命名</Button>
                      <Popconfirm title="确定删除整个阶段？" onConfirm={() => { if (currentProjectId) removePhaseGroup(currentProjectId, record._groupName); }}> 
                        <Button size="small" type="link" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  );
                }
                return (
                  <Space size={4}>
                    <Tooltip title={record.linked ? '已关联（自动级联）' : '未关联（独立节点）'}>
                      <Button size="small" type="text" icon={<LinkOutlined style={{ color: record.linked ? '#1677ff' : '#ccc' }} />} onClick={() => toggleLink(record.id)} />
                    </Tooltip>
                    <Popconfirm title="确定删除该任务？" onConfirm={() => removePhase(record.id)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                );
              }}
            />
          </Table>
        </Card>
      )}

      {/* ── 甘特图 ── */}
      {projectPhases.length > 0 && ganttChart}

      {/* ── 添加大阶段弹窗 ── */}
      <Modal
        title="添加大阶段"
        open={addGroupModalOpen}
        onOk={() => {
          const name = newGroupName.trim();
          if (!name) { message.warning('请输入阶段名称'); return; }
          if (!currentProjectId) return;
          if (groupedPhases.some((g) => g.group === name)) {
            message.warning('该大阶段名称已存在');
            return;
          }
          addPhaseGroup(currentProjectId, name);
          message.success('大阶段已添加');
          setAddGroupModalOpen(false);
          setNewGroupName('');
        }}
        onCancel={() => setAddGroupModalOpen(false)}
        okText="确认"
        cancelText="取消"
        width={440}
      >
        <Input
          placeholder="请输入大阶段名称"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onPressEnter={() => {
            const name = newGroupName.trim();
            if (!name) { message.warning('请输入阶段名称'); return; }
            if (!currentProjectId) return;
            if (groupedPhases.some((g) => g.group === name)) {
              message.warning('该大阶段名称已存在');
              return;
            }
            addPhaseGroup(currentProjectId, name);
            message.success('大阶段已添加');
            setAddGroupModalOpen(false);
            setNewGroupName('');
          }}
          autoFocus
          size="large"
        />
      </Modal>

      {/* ── 重命名大阶段弹窗 ── */}
      <Modal
        title="重命名大阶段"
        open={renameGroupModalOpen}
        onOk={() => {
          const name = renameGroupNewName.trim();
          if (!name) {
            message.warning('请输入新名称');
            return;
          }
          if (!currentProjectId) return;
          if (name !== renameGroupOldName && groupedPhases.some((g) => g.group === name)) {
            message.warning('该大阶段名称已存在');
            return;
          }
          updatePhaseGroupName(currentProjectId, renameGroupOldName, name);
          message.success('大阶段已重命名');
          setRenameGroupModalOpen(false);
        }}
        onCancel={() => setRenameGroupModalOpen(false)}
        okText="确认"
        cancelText="取消"
        width={440}
      >
        <Input
          placeholder="请输入新名称"
          value={renameGroupNewName}
          onChange={(e) => setRenameGroupNewName(e.target.value)}
          onPressEnter={() => {
            const name = renameGroupNewName.trim();
            if (!name) { message.warning('请输入新名称'); return; }
            if (!currentProjectId) return;
            if (name !== renameGroupOldName && groupedPhases.some((g) => g.group === name)) {
              message.warning('该大阶段名称已存在'); return;
            }
            updatePhaseGroupName(currentProjectId, renameGroupOldName, name);
            message.success('大阶段已重命名');
            setRenameGroupModalOpen(false);
          }}
          autoFocus
          size="large"
        />
      </Modal>

      {/* ── 全局样式 ── */}
      <style>{`
        .plan-group-row td { background: #fafafa !important; font-weight: 600; border-bottom: 2px solid #e8e8e8 !important; }
        .plan-group-row:hover td { background: #f0f0f0 !important; }
        .plan-child-row td { background: #f8f9fb !important; }
        .plan-child-row:hover td { background: #eef1f5 !important; }
        .ant-table-cell { vertical-align: middle; }
      `}</style>
    </div>
  );
};

export default PlanSchedule;
