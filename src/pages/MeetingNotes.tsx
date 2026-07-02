import React, { useEffect, useState } from 'react';
import {
  Card, Button, Modal, Input, DatePicker, Select, List, Tag, Space, Popconfirm, Empty,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import dayjs from 'dayjs';
import { useProjectStore } from '../store/useProjectStore';
import { useMeetingStore } from '../store/useMeetingStore';
import { MeetingNote, ActionItem } from '../types';
import { formatDate, generateId } from '../utils/storage';

const MeetingNotes: React.FC = () => {
  const { currentProjectId } = useProjectStore();
  const { notes, load, add, update, remove } = useMeetingStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<MeetingNote | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const [form, setForm] = useState({
    title: '',
    date: formatDate(new Date().toISOString()),
    attendees: [] as string[],
    content: '',
    decisions: [] as string[],
    actionItems: [] as ActionItem[],
  });

  useEffect(() => {
    load();
  }, []);

  const projectNotes = notes.filter((n) => n.projectId === currentProjectId);

  const handleSave = () => {
    if (!form.title || !currentProjectId) return;
    if (editingNote) {
      update(editingNote.id, form);
    } else {
      add({ ...form, projectId: currentProjectId });
    }
    setModalOpen(false);
    setEditingNote(null);
    setForm({ title: '', date: formatDate(new Date().toISOString()), attendees: [], content: '', decisions: [], actionItems: [] });
    setPreviewMode(false);
  };

  const openEdit = (note: MeetingNote) => {
    setEditingNote(note);
    setForm({
      title: note.title,
      date: note.date,
      attendees: note.attendees,
      content: note.content,
      decisions: note.decisions,
      actionItems: note.actionItems,
    });
    setPreviewMode(false);
    setModalOpen(true);
  };

  const addActionItem = () => {
    setForm({
      ...form,
      actionItems: [...form.actionItems, { id: generateId(), description: '', assignee: '', dueDate: '', completed: false }],
    });
  };

  const updateActionItem = (idx: number, data: Partial<ActionItem>) => {
    const items = [...form.actionItems];
    items[idx] = { ...items[idx], ...data };
    setForm({ ...form, actionItems: items });
  };

  const removeActionItem = (idx: number) => {
    setForm({ ...form, actionItems: form.actionItems.filter((_, i) => i !== idx) });
  };

  const getAttendeeOptions = () => {
    const allAttendees = new Set<string>();
    notes.forEach((n) => n.attendees.forEach((a) => allAttendees.add(a)));
    return Array.from(allAttendees).map((a) => ({ label: a, value: a }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>会议纪要</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditingNote(null); setModalOpen(true); }}
        >
          新建纪要
        </Button>
      </div>

      {projectNotes.length === 0 ? (
        <Empty description="暂无会议纪要" />
      ) : (
        <List
          dataSource={projectNotes}
          renderItem={(note) => (
            <Card
              size="small"
              style={{ marginBottom: 12 }}
              title={
                <Space>
                  <span>{note.title}</span>
                  <Tag>{note.date}</Tag>
                  <Tag color="blue">{note.attendees.length} 人参会</Tag>
                </Space>
              }
              extra={
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(note)}>
                    编辑
                  </Button>
                  <Popconfirm title="确定删除？" onConfirm={() => remove(note.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              }
            >
              <div style={{ maxHeight: 300, overflow: 'auto', fontSize: 13, lineHeight: 1.8 }}>
                <ReactMarkdown>{note.content}</ReactMarkdown>
              </div>
              {note.decisions.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Tag color="green" style={{ marginBottom: 4 }}>会议决议</Tag>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                    {note.decisions.map((d, i) => (
                      <li key={i} style={{ fontSize: 13 }}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {note.actionItems.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Tag color="orange" style={{ marginBottom: 4 }}>待办事项</Tag>
                  {note.actionItems.map((a) => (
                    <div key={a.id} style={{ fontSize: 13, padding: '2px 0', display: 'flex', gap: 8 }}>
                      <span>{a.completed ? '✅' : '⬜'}</span>
                      <span>{a.description}</span>
                      <Tag style={{ fontSize: 11 }}>{a.assignee}</Tag>
                      {a.dueDate && <span style={{ color: '#999' }}>{a.dueDate}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        title={editingNote ? '编辑会议纪要' : '新建会议纪要'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); setEditingNote(null); setPreviewMode(false); }}
        okText="保存"
        cancelText="取消"
        width={800}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Input
              placeholder="会议标题"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{ flex: 2 }}
            />
            <DatePicker
              value={dayjs(form.date)}
              onChange={(d) => d && setForm({ ...form, date: d.format('YYYY-MM-DD') })}
              style={{ flex: 1 }}
            />
          </div>
          <Select
            mode="tags"
            placeholder="参会人员（输入后回车添加）"
            value={form.attendees}
            onChange={(v) => setForm({ ...form, attendees: v })}
            options={getAttendeeOptions()}
          />
          <div>
            <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: '#666' }}>会议内容 (支持 Markdown)</span>
              <Button size="small" onClick={() => setPreviewMode(!previewMode)}>
                {previewMode ? '编辑' : '预览'}
              </Button>
            </div>
            {previewMode ? (
              <div
                style={{
                  minHeight: 200,
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 13,
                  lineHeight: 1.8,
                  overflow: 'auto',
                  maxHeight: 400,
                }}
              >
                <ReactMarkdown>{form.content}</ReactMarkdown>
              </div>
            ) : (
              <Input.TextArea
                rows={10}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="## 会议议题&#10;&#10;1. ...&#10;&#10;## 讨论内容&#10;&#10;...&#10;&#10;## 结论&#10;&#10;..."
              />
            )}
          </div>

          {/* Action Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#666' }}>待办事项</span>
              <Button size="small" type="dashed" onClick={addActionItem}>+ 添加</Button>
            </div>
            {form.actionItems.map((item, idx) => (
              <div key={item.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <Input
                  placeholder="描述"
                  value={item.description}
                  onChange={(e) => updateActionItem(idx, { description: e.target.value })}
                  style={{ flex: 2 }}
                />
                <Input
                  placeholder="负责人"
                  value={item.assignee}
                  onChange={(e) => updateActionItem(idx, { assignee: e.target.value })}
                  style={{ width: 120 }}
                />
                <DatePicker
                  placeholder="截止日期"
                  value={item.dueDate ? dayjs(item.dueDate) : null}
                  onChange={(d) => updateActionItem(idx, { dueDate: d?.format('YYYY-MM-DD') || '' })}
                  style={{ width: 140 }}
                />
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeActionItem(idx)}
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MeetingNotes;
