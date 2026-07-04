'use client';

import { useState } from 'react';
import { usePlanStore } from '@/store/usePlanStore';
import { PlanPhase } from '@/types';
import dayjs from 'dayjs';

export default function PlanPage() {
  const {
    phases,
    isDirty,
    currentProjectId,
    setCurrentProject,
    createPlan,
    addPhase,
    updatePhase,
    deletePhase,
    insertPhase,
    toggleLockStart,
    toggleLockEnd,
    toggleLinked,
    save,
    undo,
  } = usePlanStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhaseGroup, setNewPhaseGroup] = useState('');

  const projects = [
    { id: 'proj-1', name: '天阔T50P' },
    { id: 'proj-2', name: '金海X8950' },
    { id: 'proj-3', name: 'S2000盛泽' },
  ];

  const groupedPhases = phases.reduce((groups, phase) => {
    if (!groups[phase.phaseGroup]) {
      groups[phase.phaseGroup] = [];
    }
    groups[phase.phaseGroup].push(phase);
    return groups;
  }, {} as Record<string, PlanPhase[]>);

  const handleCreatePlan = () => {
    if (!currentProjectId) {
      alert('请先选择项目');
      return;
    }
    createPlan(currentProjectId);
  };

  const handleSaveEdit = (id: string, field: string, value: any) => {
    if (field === 'startDate' || field === 'endDate') {
      const phase = phases.find(p => p.id === id);
      if (phase) {
        const startDate = field === 'startDate' ? value : phase.startDate;
        const endDate = field === 'endDate' ? value : phase.endDate;
        const duration = dayjs(endDate).diff(dayjs(startDate), 'day');
        updatePhase(id, { [field]: value, duration });
      }
    } else if (field === 'duration') {
      const phase = phases.find(p => p.id === id);
      if (phase) {
        const endDate = dayjs(phase.startDate).add(value, 'day').format('YYYY-MM-DD');
        updatePhase(id, { duration: value, endDate });
      }
    } else {
      updatePhase(id, { [field]: value });
    }
    setEditingId(null);
    setEditingField(null);
  };

  const handleAddPhase = () => {
    if (!newPhaseGroup.trim()) {
      alert('请输入大阶段名称');
      return;
    }
    addPhase(newPhaseGroup);
    setNewPhaseGroup('');
    setShowAddPhase(false);
  };

  const renderEditableCell = (phase: PlanPhase, field: string, value: any, className = '') => {
    const isLocked = (field === 'startDate' && phase.lockStart) || (field === 'endDate' && phase.lockEnd);
    
    if (editingId === phase.id && editingField === field) {
      if (field === 'startDate' || field === 'endDate') {
        return (
          <input
            type="date"
            defaultValue={value}
            onBlur={(e) => handleSaveEdit(phase.id, field, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveEdit(phase.id, field, (e.target as HTMLInputElement).value);
              }
            }}
            autoFocus
            className="border rounded px-1"
            disabled={isLocked}
          />
        );
      } else if (field === 'duration') {
        return (
          <input
            type="number"
            defaultValue={value}
            onBlur={(e) => handleSaveEdit(phase.id, field, parseInt((e.target as HTMLInputElement).value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveEdit(phase.id, field, parseInt((e.target as HTMLInputElement).value));
              }
            }}
            autoFocus
            className="border rounded px-1 w-16"
          />
        );
      } else {
        return (
          <input
            type="text"
            defaultValue={value}
            onBlur={(e) => handleSaveEdit(phase.id, field, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveEdit(phase.id, field, (e.target as HTMLInputElement).value);
              }
            }}
            autoFocus
            className="border rounded px-1"
          />
        );
      }
    }
    
    return (
      <span
        onClick={() => {
          if (!isLocked) {
            setEditingId(phase.id);
            setEditingField(field);
          }
        }}
        className={`cursor-pointer hover:bg-gray-100 ${isLocked ? 'text-red-500 font-bold' : ''} ${className}`}
        title={isLocked ? '已锁定，不可修改' : '点击编辑'}
      >
        {value}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">项目计划</h1>

        <div className="mb-4">
          <label className="mr-2">选择项目：</label>
          <select
            value={currentProjectId || ''}
            onChange={(e) => setCurrentProject(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">请选择项目</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={handleCreatePlan}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            创建计划
          </button>
          <button
            onClick={() => setShowAddPhase(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            添加大阶段
          </button>
          <button
            onClick={save}
            disabled={!isDirty}
            className={`px-4 py-2 rounded ${isDirty ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          >
            保存
          </button>
          <button
            onClick={undo}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            撤销
          </button>
        </div>

        {isDirty && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
            有未保存的修改，请点击"保存"按钮保存。
          </div>
        )}

        {showAddPhase && (
          <div className="mb-4 p-4 bg-white rounded shadow">
            <label className="mr-2">大阶段名称：</label>
            <input
              type="text"
              value={newPhaseGroup}
              onChange={(e) => setNewPhaseGroup(e.target.value)}
              placeholder="如：M6 量产阶段"
              className="border rounded px-2 py-1 mr-2"
            />
            <button onClick={handleAddPhase} className="px-4 py-1 bg-blue-600 text-white rounded mr-2">确认</button>
            <button onClick={() => setShowAddPhase(false)} className="px-4 py-1 bg-gray-400 text-white rounded">取消</button>
          </div>
        )}

        {phases.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            暂无计划数据，请点击"创建计划"按钮创建。
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">阶段 / 任务</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">开始日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">结束日期</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">周期(天)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">关联</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">锁定</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(groupedPhases).map(([phaseGroup, groupPhases]) => (
                  <>
                    <tr key={phaseGroup} className="bg-gray-100">
                      <td colSpan={8} className="px-6 py-2 font-bold text-gray-900">
                        {phaseGroup} [{groupPhases[0].startDate} → {groupPhases[groupPhases.length - 1].endDate} ({groupPhases.reduce((sum, p) => sum + p.duration, 0)}天)]
                      </td>
                    </tr>
                    {groupPhases.map((phase) => (
                      <tr key={phase.id} className={phase.status === 'completed' ? 'opacity-45' : ''}>
                        <td 
                          className="px-6 py-4 text-sm text-gray-900"
                          style={{ 
                            paddingLeft: phase.level === 'child' ? '4rem' : 
                                        phase.level === 'grandchild' ? '6rem' : '1.5rem',
                            fontWeight: phase.level === 'parent' ? 'bold' : 'normal'
                          }}
                        >
                          {renderEditableCell(phase, 'taskName', phase.taskName)}
                          {phase.isParentWithChildren && (
                            <span className="ml-2 text-xs text-gray-500">(含子任务)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            {renderEditableCell(phase, 'startDate', phase.startDate)}
                            <button
                              onClick={() => toggleLockStart(phase.id)}
                              title={phase.lockStart ? '解锁开始日期' : '锁定开始日期'}
                              className={phase.lockStart ? 'text-red-500' : 'text-gray-400'}
                            >
                              🔒
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            {renderEditableCell(phase, 'endDate', phase.endDate)}
                            <button
                              onClick={() => toggleLockEnd(phase.id)}
                              title={phase.lockEnd ? '解锁结束日期' : '锁定结束日期'}
                              className={phase.lockEnd ? 'text-red-500' : 'text-gray-400'}
                            >
                              🔒
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {phase.isParentWithChildren ? (
                            <span className="text-gray-400">自动</span>
                          ) : (
                            renderEditableCell(phase, 'duration', phase.duration)
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            phase.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                            phase.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {phase.status === 'completed' ? '已完成' :
                             phase.status === 'in_progress' ? '进行中' : '未开始'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => toggleLinked(phase.id)}
                            title={phase.linked ? '已关联（点击解除）' : '独立（点击关联）'}
                            className={phase.linked ? 'text-blue-500' : 'text-gray-400'}
                          >
                            {phase.linked ? '🔗' : '🔓'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <span className={phase.lockStart ? 'text-red-500' : 'text-gray-300'}>S</span>
                            <span className={phase.lockEnd ? 'text-red-500' : 'text-gray-300'}>E</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <button
                            onClick={() => insertPhase(phase.id)}
                            title="插入任务"
                            className="mr-2 text-blue-500 hover:text-blue-700"
                          >
                            [+]
                          </button>
                          <button
                            onClick={() => deletePhase(phase.id)}
                            title="删除"
                            disabled={phase.lockEnd}
                            className={phase.lockEnd ? 'opacity-50 cursor-not-allowed text-red-300' : 'text-red-500 hover:text-red-700'}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
