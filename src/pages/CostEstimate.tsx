import React, { useEffect, useState } from 'react';
import {
  Card, Button, Table, Modal, Input, InputNumber, Select, Space, Popconfirm, Tag, Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useProjectStore } from '../store/useProjectStore';
import { useCostStore } from '../store/useCostStore';
import { CostItem } from '../types';

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  material: { label: '物料', color: '#1677ff' },
  labor: { label: '人力', color: '#52c41a' },
  equipment: { label: '设备', color: '#fa8c16' },
  outsource: { label: '外包', color: '#722ed1' },
  travel: { label: '差旅', color: '#13c2c2' },
  other: { label: '其他', color: '#8c8c8c' },
};

const CostEstimate: React.FC = () => {
  const { currentProjectId } = useProjectStore();
  const { items, load, add, update, remove } = useCostStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CostItem | null>(null);

  const [form, setForm] = useState({
    category: 'material' as CostItem['category'],
    item: '',
    estimatedCost: 0,
    actualCost: 0,
    manHours: 0,
    notes: '',
  });

  useEffect(() => {
    load();
  }, []);

  const projectItems = items.filter((i) => i.projectId === currentProjectId);

  const handleSave = () => {
    if (!form.item || !currentProjectId) return;
    if (editingItem) {
      update(editingItem.id, form);
    } else {
      add({ ...form, projectId: currentProjectId });
    }
    setModalOpen(false);
    setEditingItem(null);
    setForm({ category: 'material', item: '', estimatedCost: 0, actualCost: 0, manHours: 0, notes: '' });
  };

  const openEdit = (item: CostItem) => {
    setEditingItem(item);
    setForm({
      category: item.category,
      item: item.item,
      estimatedCost: item.estimatedCost,
      actualCost: item.actualCost,
      manHours: item.manHours,
      notes: item.notes,
    });
    setModalOpen(true);
  };

  const columns: ColumnsType<CostItem> = [
    {
      title: '类别', dataIndex: 'category', key: 'category', width: 80,
      render: (v: string) => <Tag color={CATEGORY_LABELS[v]?.color}>{CATEGORY_LABELS[v]?.label || v}</Tag>,
    },
    { title: '项目', dataIndex: 'item', key: 'item', width: 200 },
    {
      title: '预估费用', dataIndex: 'estimatedCost', key: 'estimatedCost', width: 110, align: 'right',
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '实际费用', dataIndex: 'actualCost', key: 'actualCost', width: 110, align: 'right',
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '差异', key: 'diff', width: 100, align: 'right',
      render: (_, r) => {
        const diff = r.actualCost - r.estimatedCost;
        return (
          <span style={{ color: diff > 0 ? '#f5222d' : diff < 0 ? '#52c41a' : '#666' }}>
            {diff > 0 ? '+' : ''}¥{diff.toLocaleString()}
          </span>
        );
      },
    },
    { title: '人时', dataIndex: 'manHours', key: 'manHours', width: 70, align: 'right' },
    { title: '备注', dataIndex: 'notes', key: 'notes', ellipsis: true, width: 120 },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="确定删除？" onConfirm={() => remove(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Summary
  const totalEstimated = projectItems.reduce((sum, i) => sum + i.estimatedCost, 0);
  const totalActual = projectItems.reduce((sum, i) => sum + i.actualCost, 0);
  const totalManHours = projectItems.reduce((sum, i) => sum + i.manHours, 0);

  // Chart data
  const categoryData = Object.entries(CATEGORY_LABELS).map(([key, { label, color }]) => {
    const catItems = projectItems.filter((i) => i.category === key);
    return {
      name: label,
      color,
      预估: catItems.reduce((s, i) => s + i.estimatedCost, 0),
      实际: catItems.reduce((s, i) => s + i.actualCost, 0),
    };
  }).filter((d) => d.预估 > 0 || d.实际 > 0);

  const pieData = categoryData.map((d) => ({ name: d.name, value: d.实际, color: d.color }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>费用人力估算</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditingItem(null); setModalOpen(true); }}
        >
          添加费用项
        </Button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#999' }}>预估总费用</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#1677ff' }}>
            ¥{totalEstimated.toLocaleString()}
          </div>
        </Card>
        <Card size="small" style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#999' }}>实际总费用</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: totalActual > totalEstimated ? '#f5222d' : '#52c41a' }}>
            ¥{totalActual.toLocaleString()}
          </div>
        </Card>
        <Card size="small" style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#999' }}>总人时</div>
          <div style={{ fontSize: 24, fontWeight: 600 }}>{totalManHours}h</div>
        </Card>
        <Card size="small" style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#999' }}>预算偏差</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: totalActual > totalEstimated ? '#f5222d' : '#52c41a' }}>
            {totalEstimated > 0 ? Math.round((totalActual / totalEstimated - 1) * 100) : 0}%
          </div>
        </Card>
      </div>

      {/* Charts */}
      {categoryData.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="预估" fill="#1677ff" />
              <Bar dataKey="实际" fill="#52c41a" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Table */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={projectItems}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 900 }}
          locale={{ emptyText: '暂无费用数据' }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={2}><strong>合计</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><strong>¥{totalEstimated.toLocaleString()}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right"><strong>¥{totalActual.toLocaleString()}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <strong style={{ color: totalActual > totalEstimated ? '#f5222d' : '#52c41a' }}>
                  {totalActual > totalEstimated ? '+' : ''}¥{(totalActual - totalEstimated).toLocaleString()}
                </strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right"><strong>{totalManHours}h</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={6} />
              <Table.Summary.Cell index={7} />
            </Table.Summary.Row>
          )}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑费用项' : '添加费用项'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditingItem(null); }}
        okText="保存"
        cancelText="取消"
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
          <Select
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ label: v.label, value: k }))}
          />
          <Input
            placeholder="费用项目 *"
            value={form.item}
            onChange={(e) => setForm({ ...form, item: e.target.value })}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <InputNumber
              placeholder="预估费用"
              value={form.estimatedCost}
              onChange={(v) => setForm({ ...form, estimatedCost: v || 0 })}
              style={{ flex: 1 }}
              min={0}
              prefix="¥"
            />
            <InputNumber
              placeholder="实际费用"
              value={form.actualCost}
              onChange={(v) => setForm({ ...form, actualCost: v || 0 })}
              style={{ flex: 1 }}
              min={0}
              prefix="¥"
            />
          </div>
          <InputNumber
            placeholder="人时 (小时)"
            value={form.manHours}
            onChange={(v) => setForm({ ...form, manHours: v || 0 })}
            style={{ width: '100%' }}
            min={0}
            suffix="h"
          />
          <Input.TextArea
            placeholder="备注"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  );
};

export default CostEstimate;
