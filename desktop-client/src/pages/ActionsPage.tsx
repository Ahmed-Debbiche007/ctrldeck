import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import type { Button } from '../types';
import { getButtons, createButton, deleteButton, executeAction } from '../api';
import { ButtonEditor } from '../components/ButtonEditor';
import { getIconComponent } from '../components/IconPicker';

export function ActionsPage() {
  const [buttons, setButtons] = useState<Button[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingButton, setEditingButton] = useState<Button | undefined>();
  const [executingId, setExecutingId] = useState<string | null>(null);

  useEffect(() => {
    loadButtons();
  }, []);

  const loadButtons = async () => {
    try {
      const data = await getButtons();
      setButtons(data || []);
    } catch (e) {
      console.error('Failed to load buttons:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateButton = async (buttonData: Omit<Button, 'id'>) => {
    try {
      await createButton(buttonData);
      await loadButtons();
      setShowEditor(false);
      setEditingButton(undefined);
    } catch (e) {
      console.error('Failed to create button:', e);
    }
  };

  const handleDeleteButton = async (id: string) => {
    try {
      await deleteButton(id);
      await loadButtons();
    } catch (e) {
      console.error('Failed to delete button:', e);
    }
  };

  const handleExecuteAction = async (buttonId: string) => {
    setExecutingId(buttonId);
    try {
      const result = await executeAction(buttonId);
      console.log('Action result:', result);
    } catch (e) {
      console.error('Failed to execute action:', e);
    } finally {
      setTimeout(() => setExecutingId(null), 300);
    }
  };

  const handleEditButton = (button: Button) => {
    setEditingButton(button);
    setShowEditor(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Action Buttons</h1>
          <p className="text-gray-400 mt-1">Configure your Stream Deck buttons</p>
        </div>
        <button
          onClick={() => {
            setEditingButton(undefined);
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
        >
          <Plus size={20} />
          Add Button
        </button>
      </div>

      {/* Button Grid */}
      {buttons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-4">
            <Plus size={40} className="text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No buttons yet</h3>
          <p className="text-gray-400 mb-4">Create your first button to get started</p>
          <button
            onClick={() => setShowEditor(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            Create Button
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {buttons.map((button) => {
            const IconComponent = getIconComponent(button.icon);
            const isExecuting = executingId === button.id;

            return (
              <div
                key={button.id}
                className="group relative"
              >
                {/* Button Card */}
                <button
                  onClick={() => handleExecuteAction(button.id)}
                  className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200 ${
                    isExecuting ? 'scale-95' : 'hover:scale-105'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${button.color}22, ${button.color}11)`,
                    border: `2px solid ${button.color}`,
                    boxShadow: isExecuting
                      ? `0 0 40px ${button.color}66, inset 0 0 30px ${button.color}33`
                      : `0 0 20px ${button.color}22`,
                  }}
                >
                  {IconComponent && (
                    <IconComponent
                      size={36}
                      color={button.color}
                      className={`transition-all ${isExecuting ? 'scale-110' : ''}`}
                    />
                  )}
                  <span className="text-sm font-medium text-white truncate px-2 max-w-full">
                    {button.name}
                  </span>
                </button>

                {/* Action Buttons (visible on hover) */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditButton(button);
                    }}
                    className="p-1.5 bg-gray-900/80 hover:bg-gray-800 rounded-lg transition-colors backdrop-blur-sm"
                  >
                    <Edit2 size={14} className="text-gray-300" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteButton(button.id);
                    }}
                    className="p-1.5 bg-gray-900/80 hover:bg-red-600 rounded-lg transition-colors backdrop-blur-sm"
                  >
                    <Trash2 size={14} className="text-gray-300" />
                  </button>
                </div>

                {/* Drag Handle */}
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-move">
                  <GripVertical size={16} className="text-gray-500" />
                </div>

                {/* Action Type Badge */}
                <div
                  className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `${button.color}33`,
                    color: button.color,
                  }}
                >
                  {button.action_type.replace('_', ' ')}
                </div>
              </div>
            );
          })}

          {/* Add Button Card */}
          <button
            onClick={() => {
              setEditingButton(undefined);
              setShowEditor(true);
            }}
            className="aspect-square rounded-2xl border-2 border-dashed border-gray-700 hover:border-gray-500 flex flex-col items-center justify-center gap-2 transition-all hover:bg-gray-800/30"
          >
            <Plus size={32} className="text-gray-500" />
            <span className="text-sm text-gray-500">Add Button</span>
          </button>
        </div>
      )}

      {/* Button Editor Modal */}
      {showEditor && (
        <ButtonEditor
          button={editingButton}
          onSave={handleCreateButton}
          onClose={() => {
            setShowEditor(false);
            setEditingButton(undefined);
          }}
        />
      )}
    </div>
  );
}
