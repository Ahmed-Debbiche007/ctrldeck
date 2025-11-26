import { useState, useEffect } from 'react';
import { Plus, Settings } from 'lucide-react';
import { Button } from '../types';
import { getButtons, createButton, executeAction } from '../api';
import { ButtonEditor } from '../components/ButtonEditor';
import { getIconComponent } from '../components/IconPicker';

interface ActionsPageProps {
  onSettingsClick?: () => void;
}

export function ActionsPage({ onSettingsClick }: ActionsPageProps) {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full p-2 pb-8">
      {/* Button Grid - Maximum space for buttons */}
      {buttons.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <div className="w-16 h-16 rounded-xl bg-gray-800/50 flex items-center justify-center mb-3">
            <Plus size={28} className="text-gray-600" />
          </div>
          <h3 className="text-base font-medium text-white mb-1">No buttons</h3>
          <p className="text-gray-400 text-sm mb-3">Tap + to create one</p>
          <button
            onClick={() => setShowEditor(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Create Button
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-1.5 sm:gap-2">
          {buttons.map((button) => {
            const IconComponent = getIconComponent(button.icon);
            const isExecuting = executingId === button.id;

            return (
              <button
                key={button.id}
                onClick={() => handleExecuteAction(button.id)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 p-1.5 transition-all duration-150 ${
                  isExecuting ? 'scale-90' : 'active:scale-90'
                }`}
                style={{
                  background: `linear-gradient(135deg, ${button.color}25, ${button.color}10)`,
                  border: `1.5px solid ${button.color}`,
                  boxShadow: isExecuting
                    ? `0 0 20px ${button.color}50, inset 0 0 15px ${button.color}30`
                    : `0 0 10px ${button.color}15`,
                }}
              >
                {IconComponent && (
                  <IconComponent
                    size={20}
                    color={button.color}
                    className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${isExecuting ? 'scale-110' : ''}`}
                  />
                )}
                <span className="text-[9px] sm:text-[10px] font-medium text-white truncate w-full text-center leading-tight px-0.5">
                  {button.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Settings button - Small floating button */}
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className="absolute top-2 right-2 p-2 rounded-full bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors"
        >
          <Settings size={16} />
        </button>
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
