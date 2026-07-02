import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Card, Button, Table, Input, InputNumber, Space, Popconfirm, Tooltip,
  Upload, DatePicker, Modal, message, Typography, Select, Dropdown,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, UploadOutlined,
  DownloadOutlined, ExclamationCircleOutlined,
  SortAscendingOutlined, CaretDownOutlined, UndoOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { TableRowSelection } from 'antd/es/table/interface';
import dayjs, { Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import { useProjectStore } from '../store/useProjectStore';
import { useMaterialStore } from '../store/useMaterialStore';
import { MaterialItem, MaterialStatus, MATERIAL_STATUS_CONFIG, MATERIAL_STATUS_LIST } from '../types';

const { Text } = Typography;

const MaterialManagement: React.FC = () => {
  const { currentProjectId } = useProjectStore();
  const { items, load, add, batchAdd, update, remove, batchRemove, batchUpdate, undoImport, lastImportIds } = useMaterialStore();
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<'manufacturer' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchField, setBatchField] = useState<string | null>(null);
  const [batchTextValue, setBatchTextValue] = useState('');
  const [batchNumValue, setBatchNumValue] = useState<number | null>(null);
  const [batchDateValue, setBatchDateValue] = useState<string>('');
  const batchInputRef = useRef<any>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<Record<string, unknown>>>([]);
  const [importColumns, setImportColumns] = useState<string[]>([]);
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof MaterialItem } | null>(null);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    load();
  }, []);

  const projectItems = items
    .filter((i) => i.projectId === currentProjectId)
    .filter((i) => {
      if (!searchText) return true;
      const kw = searchText.toLowerCase();
      return (
        i.partNumber.toLowerCase().includes(kw) ||
        i.manufacturer.toLowerCase().includes(kw) ||
        i.model.toLowerCase().includes(kw) ||
        i.materialStatus.toLowerCase().includes(kw) ||
        (i.status || '').toLowerCase().includes(kw) ||
        (i.notes || '').toLowerCase().includes(kw)
      );
    })
    .sort((a, b) => {
      if (sortKey === 'manufacturer') {
        const cmp = (a.manufacturer || '').localeCompare(b.manufacturer || '', 'zh');
        return sortOrder === 'desc' ? -cmp : cmp;
      }
      return a.seq - b.seq;
    });

  // ============ 计算工具 ============
  const calcExpectedDelivery = (purchaseDate: string, leadTime: number): string => {
    if (!purchaseDate || leadTime <= 0) return '';
    return dayjs(purchaseDate).add(leadTime, 'day').format('YYYY-MM-DD');
  };

  const calcTotalQty = (quantityPerSet: number, setCount: number): number => {
    return quantityPerSet * setCount;
  };

  // ============ 状态颜色标签 ============
  const renderStatusTag = (status: MaterialStatus) => {
    const cfg = MATERIAL_STATUS_CONFIG[status];
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 500,
          color: cfg.color,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          whiteSpace: 'nowrap',
          lineHeight: '20px',
        }}
      >
        {status}
      </span>
    );
  };

  // ============ 批量操作 ============
  const BATCH_FIELDS: { value: string; label: string; type: 'text' | 'number' | 'date' | 'status' }[] = [
    { value: 'manufacturer', label: '厂家', type: 'text' },
    { value: 'model', label: '物料型号', type: 'text' },
    { value: 'partNumber', label: '物料号', type: 'text' },
    { value: 'quantityPerSet', label: '单套用量', type: 'number' },
    { value: 'setCount', label: '套数', type: 'number' },
    { value: 'purchaseDate', label: '采购时间', type: 'date' },
    { value: 'leadTime', label: '采购周期(天)', type: 'number' },
    { value: 'materialStatus', label: '物料状态', type: 'status' },
    { value: 'notes', label: '备注', type: 'text' },
  ];

  const resetBatchEdit = () => {
    setBatchField(null);
    setBatchTextValue('');
    setBatchNumValue(null);
    setBatchDateValue('');
  };

  const handleBatchFieldSelect = (field: string) => {
    setBatchField(field);
    setBatchTextValue('');
    setBatchNumValue(null);
    setBatchDateValue('');
    setTimeout(() => {
      if (batchInputRef.current) {
        if (batchInputRef.current.focus) batchInputRef.current.focus();
      }
    }, 100);
  };

  const applyBatchEdit = () => {
    if (selectedRowKeys.length === 0 || !batchField) return;
    const fieldDef = BATCH_FIELDS.find((f) => f.value === batchField);
    if (!fieldDef) return;

    let value: any;
    if (fieldDef.type === 'number') {
      if (batchNumValue === null || batchNumValue === undefined) {
        message.warning('请输入数值');
        return;
      }
      value = batchNumValue;
    } else if (fieldDef.type === 'date') {
      if (!batchDateValue) {
        message.warning('请选择日期');
        return;
      }
      value = batchDateValue;
      // 批量设采购时间时，对默认状态物料自动切已下单
      if (batchField === 'purchaseDate') {
        const idSet = new Set(selectedRowKeys as string[]);
        const defaultItems = projectItems.filter((i) => idSet.has(i.id) && i.materialStatus === '默认');
        if (defaultItems.length > 0) {
          batchUpdate(defaultItems.map((i) => i.id), { materialStatus: '已下单' as any });
        }
      }
    } else if (fieldDef.type === 'status') {
      value = batchTextValue;
      if (!value) {
        message.warning('请选择物料状态');
        return;
      }
    } else {
      value = batchTextValue;
      if (!value) {
        message.warning('请输入内容');
        return;
      }
    }

    batchUpdate(selectedRowKeys as string[], { [batchField]: value as any });
    message.success(`已将 ${selectedRowKeys.length} 条物料的「${fieldDef.label}」批量更新`);
    resetBatchEdit();
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) return;
    batchRemove(selectedRowKeys as string[]);
    message.success(`已删除 ${selectedRowKeys.length} 条物料`);
    setSelectedRowKeys([]);
  };

  const rowSelection: TableRowSelection<MaterialItem> = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys);
      resetBatchEdit();
    },
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
    ],
  };

  // ============ 手动添加一行 ============
  const handleAddRow = () => {
    if (!currentProjectId) {
      message.warning('请先选择项目');
      return;
    }
    const maxSeq = items.filter((i) => i.projectId === currentProjectId).length;
    const newItem = add({
      projectId: currentProjectId,
      seq: maxSeq + 1,
      materialStatus: '默认',
      manufacturer: '',
      model: '',
      partNumber: '',
      quantityPerSet: 1,
      setCount: 1,
      purchaseDate: '',
      leadTime: 0,
      status: '',
      notes: '',
    });
    setEditingCell({ id: newItem.id, field: 'partNumber' });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ============ 采购时间变更 → 自动切换状态 ============
  const handlePurchaseDateChange = (record: MaterialItem, dateStr: string) => {
    const updates: Partial<MaterialItem> = { purchaseDate: dateStr };
    // 采购时间从不填→有值，且当前状态为"默认"时，自动变为"已下单"
    if (dateStr && record.materialStatus === '默认') {
      updates.materialStatus = '已下单' as any;
    }
    update(record.id, updates);
  };

  // ============ Excel 导入 ============
  const handleImportExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        if (jsonData.length === 0) {
          message.warning('Excel 文件中无数据');
          return;
        }
        const cols = Object.keys(jsonData[0]);
        setImportColumns(cols);
        setImportPreview(jsonData.slice(0, 50));
        setImportModalOpen(true);
      } catch {
        message.error('无法解析 Excel 文件，请检查格式');
      }
    };
    reader.readAsBinaryString(file);
    return false;
  };

  const COLUMN_MAP: Record<string, keyof Omit<MaterialItem, 'id' | 'createdAt' | 'updatedAt'> | 'materialStatus_import'> = {
    '序号': 'seq', 'seq': 'seq', 'no': 'seq',
    '物料状态': 'materialStatus' as any, '状态': 'materialStatus' as any, 'status': 'materialStatus' as any,
    '厂家': 'manufacturer', '供应商': 'manufacturer', 'manufacturer': 'manufacturer', '品牌': 'manufacturer',
    '物料型号': 'model', '型号': 'model', 'model': 'model', '规格': 'model',
    '物料号': 'partNumber', '料号': 'partNumber', 'partnumber': 'partNumber', '物料编号': 'partNumber', '编号': 'partNumber',
    '单套用量': 'quantityPerSet', '单套数量': 'quantityPerSet', '单套': 'quantityPerSet',
    '套数': 'setCount', '总套数': 'setCount',
    '采购时间': 'purchaseDate', '采购日期': 'purchaseDate',
    '采购周期': 'leadTime', '周期': 'leadTime', 'leadtime': 'leadTime',
    '备注': 'notes', 'notes': 'notes', '说明': 'notes',
  };

  const isValidStatus = (s: string): s is MaterialStatus => {
    return MATERIAL_STATUS_LIST.includes(s as MaterialStatus);
  };

  const confirmImport = () => {
    if (!currentProjectId) {
      message.error('请先选择项目');
      return;
    }
    const currentMaxSeq = items.filter((i) => i.projectId === currentProjectId).length;

    const dataList = importPreview.map((row, idx) => {
      const item: any = {
        projectId: currentProjectId,
        seq: currentMaxSeq + idx + 1,
        materialStatus: '默认',
        manufacturer: '',
        model: '',
        partNumber: '',
        quantityPerSet: 1,
        setCount: 1,
        purchaseDate: '',
        leadTime: 0,
        status: '',
        notes: '',
      };

      for (const [colName, field] of Object.entries(COLUMN_MAP)) {
        const value = row[colName];
        if (value === undefined || value === null || value === '') continue;

        if (field === 'materialStatus') {
          const str = String(value).trim();
          item.materialStatus = isValidStatus(str) ? str : '默认';
        } else if (field === 'quantityPerSet' || field === 'setCount' || field === 'leadTime') {
          const num = Number(value);
          if (!isNaN(num)) item[field] = num;
        } else if (field === 'purchaseDate') {
          const str = String(value);
          const d = dayjs(str);
          if (d.isValid()) item[field] = d.format('YYYY-MM-DD');
          else item[field] = str;
        } else {
          item[field] = String(value).trim();
        }
      }

      // 导入时如果采购时间有值且状态为默认，自动设为已下单
      if (item.purchaseDate && item.materialStatus === '默认') {
        item.materialStatus = '已下单';
      }

      return item as Omit<MaterialItem, 'id' | 'createdAt' | 'updatedAt'>;
    });

    batchAdd(dataList);
    message.success(`成功导入 ${dataList.length} 条物料`);
    setImportModalOpen(false);
    setImportPreview([]);
    setImportColumns([]);
  };

  // ============ 内联编辑 ============
  const startEdit = useCallback((id: string, field: keyof MaterialItem) => {
    setEditingCell({ id, field });
    setTimeout(() => {
      inputRef.current?.focus();
      if (inputRef.current?.select) inputRef.current.select();
    }, 50);
  }, []);

  const finishEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const EDITABLE_FIELDS: (keyof MaterialItem)[] = ['partNumber', 'manufacturer', 'model', 'quantityPerSet', 'setCount', 'leadTime', 'notes'];

  const moveEditCell = (record: MaterialItem, currentField: keyof MaterialItem, direction: 1 | -1) => {
    const idx = EDITABLE_FIELDS.indexOf(currentField);
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < EDITABLE_FIELDS.length) {
      startEdit(record.id, EDITABLE_FIELDS[nextIdx]);
    }
  };

  const renderEditableCell = (
    value: any,
    record: MaterialItem,
    field: keyof MaterialItem,
    opts?: { type?: 'text' | 'number'; placeholder?: string }
  ) => {
    const { type = 'text', placeholder = '-' } = opts || {};
    const isEditing = editingCell?.id === record.id && editingCell?.field === field;
    const displayValue = value == null || value === '' ? placeholder : String(value);
    const isEmpty = value == null || value === '';

    if (isEditing) {
      if (type === 'number') {
        return (
          <InputNumber
            ref={inputRef}
            size="small"
            defaultValue={value ?? 0}
            min={0}
            style={{ width: '100%' }}
            onBlur={() => {
              finishEdit();
              const inputEl = inputRef.current?.input || inputRef.current;
              const num = Number(inputEl?.value ?? value);
              if (!isNaN(num)) update(record.id, { [field]: num as any });
            }}
            onKeyDown={(e: any) => {
              if (e.key === 'Enter') {
                finishEdit();
                const inputEl = inputRef.current?.input || inputRef.current;
                const num = Number(inputEl?.value ?? value);
                if (!isNaN(num)) update(record.id, { [field]: num as any });
                moveEditCell(record, field, 1);
              }
              if (e.key === 'Tab') {
                e.preventDefault();
                finishEdit();
                const inputEl = inputRef.current?.input || inputRef.current;
                const num = Number(inputEl?.value ?? value);
                if (!isNaN(num)) update(record.id, { [field]: num as any });
                moveEditCell(record, field, e.shiftKey ? -1 : 1);
              }
              if (e.key === 'Escape') finishEdit();
            }}
            autoFocus
          />
        );
      }
      return (
        <Input
          ref={inputRef}
          size="small"
          defaultValue={value ?? ''}
          style={{ width: '100%', padding: 0 }}
          bordered={false}
          placeholder={placeholder !== '-' ? placeholder : undefined}
          onBlur={(e) => {
            finishEdit();
            update(record.id, { [field]: e.target.value as any });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              finishEdit();
              update(record.id, { [field]: (e.target as HTMLInputElement).value as any });
              moveEditCell(record, field, 1);
            }
            if (e.key === 'Tab') {
              e.preventDefault();
              finishEdit();
              update(record.id, { [field]: (e.target as HTMLInputElement).value as any });
              moveEditCell(record, field, e.shiftKey ? -1 : 1);
            }
            if (e.key === 'Escape') finishEdit();
          }}
          autoFocus
        />
      );
    }

    return (
      <div
        onClick={() => startEdit(record.id, field)}
        style={{
          cursor: 'pointer',
          minHeight: 24,
          lineHeight: '24px',
          padding: '0 4px',
          margin: '-4px 0',
          borderRadius: 3,
          color: isEmpty ? '#bbb' : '#333',
          fontSize: 13,
          width: '100%',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#e6f4ff'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        title="点击编辑"
      >
        {displayValue}
      </div>
    );
  };

  // ============ 导出 Excel ============
  const handleExport = () => {
    if (projectItems.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }
    const exportData = projectItems.map((item, idx) => ({
      '序号': idx + 1,
      '物料状态': item.materialStatus,
      '厂家': item.manufacturer,
      '物料型号': item.model,
      '物料号': item.partNumber,
      '单套用量': item.quantityPerSet,
      '套数': item.setCount,
      '总数量': calcTotalQty(item.quantityPerSet, item.setCount),
      '采购时间': item.purchaseDate,
      '采购周期(天)': item.leadTime,
      '预计交期': calcExpectedDelivery(item.purchaseDate, item.leadTime),
      '备注': item.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '物料清单');
    XLSX.writeFile(wb, '物料清单.xlsx');
  };

  // ============ 表格列定义 ============
  const columns: ColumnsType<MaterialItem> = [
    {
      title: '序号', key: 'seq', width: 55, align: 'center',
      render: (_, __, idx) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{idx + 1}</Text>
      ),
    },
    {
      title: '物料状态', dataIndex: 'materialStatus', key: 'materialStatus', width: 80, align: 'center',
      render: (v: MaterialStatus, r: MaterialItem) => {
        const cfg = MATERIAL_STATUS_CONFIG[v];
        return (
          <Dropdown
            trigger={['click']}
            menu={{
              items: MATERIAL_STATUS_LIST.map((s) => ({
                key: s,
                label: (
                  <span style={{
                    display: 'inline-block',
                    padding: '1px 8px',
                    borderRadius: 3,
                    fontSize: 12,
                    fontWeight: 500,
                    color: MATERIAL_STATUS_CONFIG[s].color,
                    background: MATERIAL_STATUS_CONFIG[s].bg,
                    border: `1px solid ${MATERIAL_STATUS_CONFIG[s].border}`,
                  }}>
                    {s}
                  </span>
                ),
              })),
              onClick: ({ key }) => update(r.id, { materialStatus: key as MaterialStatus }),
              style: { minWidth: 80 },
            }}
            placement="bottom"
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: '1px 7px',
                borderRadius: 3,
                fontSize: 12,
                fontWeight: 500,
                color: cfg.color,
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                lineHeight: '18px',
                userSelect: 'none',
              }}
            >
              {v}
              <CaretDownOutlined style={{ fontSize: 10 }} />
            </span>
          </Dropdown>
        );
      },
    },
    {
      title: '厂家', dataIndex: 'manufacturer', key: 'manufacturer', width: 120,
      render: (v: string, r: MaterialItem) => renderEditableCell(v, r, 'manufacturer'),
    },
    {
      title: '物料型号', dataIndex: 'model', key: 'model', width: 120,
      render: (v: string, r: MaterialItem) => renderEditableCell(v, r, 'model'),
    },
    {
      title: '物料号', dataIndex: 'partNumber', key: 'partNumber', width: 130,
      render: (v: string, r: MaterialItem) => renderEditableCell(v, r, 'partNumber', { placeholder: '点击输入' }),
    },
    {
      title: '单套用量', dataIndex: 'quantityPerSet', key: 'quantityPerSet', width: 85, align: 'right',
      render: (v: number, r: MaterialItem) => renderEditableCell(v, r, 'quantityPerSet', { type: 'number' }),
    },
    {
      title: '套数', dataIndex: 'setCount', key: 'setCount', width: 65, align: 'right',
      render: (v: number, r: MaterialItem) => renderEditableCell(v, r, 'setCount', { type: 'number' }),
    },
    {
      title: '总数量', key: 'totalQuantity', width: 70, align: 'right',
      render: (_, r) => (
        <span style={{ fontWeight: 600, color: '#1677ff', fontSize: 13 }}>
          {calcTotalQty(r.quantityPerSet, r.setCount)}
        </span>
      ),
    },
    {
      title: '采购时间', dataIndex: 'purchaseDate', key: 'purchaseDate', width: 115,
      render: (v: string, r: MaterialItem) => (
        <DatePicker
          size="small"
          value={v ? dayjs(v) : null}
          onChange={(d: Dayjs | null) => handlePurchaseDateChange(r, d ? d.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
          placeholder="选择日期"
          allowClear
          format="YYYY/MM/DD"
        />
      ),
    },
    {
      title: '采购周期', dataIndex: 'leadTime', key: 'leadTime', width: 80, align: 'right',
      render: (v: number, r: MaterialItem) => renderEditableCell(v, r, 'leadTime', { type: 'number' }),
    },
    {
      title: '预计交期', key: 'expectedDelivery', width: 105,
      render: (_, r) => {
        const delivery = calcExpectedDelivery(r.purchaseDate, r.leadTime);
        const isOverdue = delivery && dayjs(delivery).isBefore(dayjs(), 'day');
        return delivery ? (
          <span style={{ color: isOverdue ? '#ff4d4f' : '#333', fontSize: 13 }}>
            {delivery}
            {isOverdue && <ExclamationCircleOutlined style={{ marginLeft: 4, color: '#ff4d4f' }} />}
          </span>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>-</Text>
        );
      },
    },
    {
      title: '备注', dataIndex: 'notes', key: 'notes', width: 160, ellipsis: true,
      render: (v: string, r: MaterialItem) => renderEditableCell(v, r, 'notes'),
    },
    {
      title: '', key: 'delete', width: 50, fixed: 'right',
      render: (_, r) => (
        <Popconfirm
          title="确定删除此行？"
          onConfirm={() => {
            remove(r.id);
            setSelectedRowKeys((prev) => prev.filter((k) => k !== r.id));
          }}
          okText="删除"
          cancelText="取消"
        >
          <Tooltip title="删除此行">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{ opacity: 0.35 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.35')}
            />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      {/* 顶部工具栏 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12, flexWrap: 'wrap', gap: 8,
      }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>物料管理</h2>
        <Space wrap>
          <Input.Search
            placeholder="搜索料号/厂家/型号..."
            style={{ width: 240 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Space size={4}>
            <Tooltip title="按厂家排序">
              <Button
                size="small"
                type={sortKey === 'manufacturer' ? 'primary' : 'default'}
                icon={<SortAscendingOutlined />}
                onClick={() => {
                  if (sortKey === 'manufacturer') {
                    setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                  } else {
                    setSortKey('manufacturer');
                    setSortOrder('desc');
                  }
                }}
                style={{ fontWeight: sortKey === 'manufacturer' ? 600 : 400 }}
              >
                厂家{sortKey === 'manufacturer' ? (sortOrder === 'desc' ? ' ↓' : ' ↑') : ''}
              </Button>
            </Tooltip>
            {sortKey && (
              <Tooltip title="取消排序">
                <Button size="small" onClick={() => { setSortKey(null); }}>✕</Button>
              </Tooltip>
            )}
          </Space>
          <Upload
            accept=".xlsx,.xls"
            showUploadList={false}
            beforeUpload={handleImportExcel}
          >
            <Button icon={<UploadOutlined />}>导入Excel</Button>
          </Upload>
          {lastImportIds.length > 0 && (
            <Tooltip title="撤销最近一次导入">
              <Button
                icon={<UndoOutlined />}
                danger
                onClick={() => {
                  const count = undoImport();
                  if (count > 0) {
                    message.success(`已撤销导入，移除了 ${count} 条物料`);
                  }
                }}
              >
                撤销导入
              </Button>
            </Tooltip>
          )}
          <Tooltip title="导出当前物料清单">
            <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddRow}
          >
            添加一行
          </Button>
        </Space>
      </div>

      {/* 批量操作栏 */}
      {selectedRowKeys.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 14px', marginBottom: 8,
          background: '#e6f4ff', borderRadius: 6,
          border: '1px solid #91caff',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap' }}>
            已选 <span style={{ color: '#1677ff', fontSize: 15 }}>{selectedRowKeys.length}</span> 条
          </span>
          <span style={{ color: '#999', fontSize: 12, whiteSpace: 'nowrap' }}>|</span>

          {/* 选择要修改的字段 */}
          <Select
            size="small"
            placeholder="选择批量修改的字段"
            value={batchField}
            onChange={(val) => handleBatchFieldSelect(val)}
            style={{ width: 150 }}
            options={BATCH_FIELDS.map((f) => ({ value: f.value, label: f.label }))}
          />

          {/* 根据字段类型显示不同输入 */}
          {batchField && (() => {
            const fd = BATCH_FIELDS.find((f) => f.value === batchField)!;
            if (fd.type === 'number') {
              return (
                <InputNumber
                  ref={batchInputRef}
                  size="small"
                  placeholder="输入数值"
                  min={0}
                  value={batchNumValue}
                  onChange={(v) => setBatchNumValue(v)}
                  style={{ width: 120 }}
                  onKeyDown={(e: any) => { if (e.key === 'Enter') applyBatchEdit(); }}
                />
              );
            }
            if (fd.type === 'date') {
              return (
                <DatePicker
                  size="small"
                  placeholder="选择日期"
                  value={batchDateValue ? dayjs(batchDateValue) : null}
                  onChange={(d) => setBatchDateValue(d ? d.format('YYYY-MM-DD') : '')}
                  style={{ width: 140 }}
                  format="YYYY/MM/DD"
                />
              );
            }
            if (fd.type === 'status') {
              return (
                <Select
                  size="small"
                  placeholder="选择状态"
                  value={batchTextValue || undefined}
                  onChange={(v) => setBatchTextValue(v)}
                  style={{ width: 120 }}
                  options={MATERIAL_STATUS_LIST.map((s) => ({
                    value: s,
                    label: (
                      <span style={{
                        display: 'inline-block', padding: '1px 8px', borderRadius: 3,
                        fontSize: 12, fontWeight: 500,
                        color: MATERIAL_STATUS_CONFIG[s].color,
                        background: MATERIAL_STATUS_CONFIG[s].bg,
                        border: `1px solid ${MATERIAL_STATUS_CONFIG[s].border}`,
                      }}>{s}</span>
                    ),
                  }))}
                />
              );
            }
            return (
              <Input
                ref={batchInputRef}
                size="small"
                placeholder={`输入${fd.label}`}
                value={batchTextValue}
                onChange={(e) => setBatchTextValue(e.target.value)}
                style={{ width: 160 }}
                onKeyDown={(e: any) => { if (e.key === 'Enter') applyBatchEdit(); }}
              />
            );
          })()}

          {batchField && (
            <Button type="primary" size="small" onClick={applyBatchEdit}>
              应用
            </Button>
          )}
          {batchField && (
            <Button size="small" onClick={resetBatchEdit}>取消</Button>
          )}

          <span style={{ color: '#999', fontSize: 12, whiteSpace: 'nowrap' }}>|</span>

          <Popconfirm
            title={`确定删除选中的 ${selectedRowKeys.length} 条物料？此操作不可恢复。`}
            onConfirm={handleBatchDelete}
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              批量删除
            </Button>
          </Popconfirm>
        </div>
      )}

      {/* 表格 */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={projectItems}
          rowKey="id"
          size="small"
          pagination={{
            pageSize: 50,
            showTotal: (total) => `共 ${total} 条物料`,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
          scroll={{ x: 1500 }}
          locale={{ emptyText: '暂无物料数据，请导入Excel或点击「添加一行」' }}
        />
      </Card>

      {/* 导入预览弹窗 */}
      <Modal
        title="导入预览"
        open={importModalOpen}
        onOk={confirmImport}
        onCancel={() => {
          setImportModalOpen(false);
          setImportPreview([]);
          setImportColumns([]);
        }}
        okText="确认导入"
        cancelText="取消"
        width={900}
      >
        <p style={{ color: '#666', marginBottom: 12 }}>
          已解析 {importPreview.length} 条数据，确认列名映射无误后点击导入。支持列名：序号、物料状态、厂家、物料型号、物料号、单套用量、套数、采购时间、采购周期、备注
        </p>
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {importColumns.map((col) => (
                  <th key={col} style={{ border: '1px solid #e8e8e8', padding: '6px 8px', background: '#fafafa', textAlign: 'left' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {importPreview.map((row, idx) => (
                <tr key={idx}>
                  {importColumns.map((col) => (
                    <td key={col} style={{ border: '1px solid #e8e8e8', padding: '4px 8px' }}>
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
};

export default MaterialManagement;
