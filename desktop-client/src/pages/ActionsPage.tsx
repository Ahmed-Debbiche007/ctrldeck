import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, GripVertical, Lock } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Button, SystemMetrics } from "../types";
import {
  getButtons,
  createButton,
  updateButton,
  deleteButton,
  executeAction,
  setVolume,
  setBrightness,
  connectWebSocket,
  getSystemMetrics,
  reorderButtons,
} from "../api";
import { ButtonEditor } from "../components/ButtonEditor";
import { getIconComponent } from "../components/IconPicker";
import { VolumeKnobButton } from "../components/VolumeKnobButton";
import { VolumeSliderButton } from "../components/VolumeSliderButton";
import { BrightnessKnobButton } from "../components/BrightnessKnobButton";
import { BrightnessSliderButton } from "../components/BrightnessSliderButton";
import { MediaPlayPauseButton } from "../components/MediaPlayPauseButton";

// Toggle Switch Component
interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  enabledIcon: React.ReactNode;
  disabledIcon: React.ReactNode;
}

function ToggleSwitch({
  enabled,
  onToggle,
  enabledIcon,
  disabledIcon,
}: ToggleSwitchProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center rounded-xl transition-all duration-300 `}
    >
      <div className="relative">
        <div
          className={`w-12 h-6 rounded-full transition-all duration-300 ${
            enabled
              ? "bg-gradient-to-r from-violet-500 to-purple-500"
              : "bg-gray-700"
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center ${
              enabled ? "left-6 bg-white shadow-lg" : "left-0.5 bg-gray-400"
            }`}
          >
            {enabled ? (
              <span className="text-violet-600 scale-75">{enabledIcon}</span>
            ) : (
              <span className="text-gray-600 scale-75">{disabledIcon}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// Sortable Button Item Component
interface SortableButtonItemProps {
  button: Button;
  executingId: string | null;
  metrics: SystemMetrics | null;
  onExecute: (buttonId: string) => void;
  onEdit: (button: Button) => void;
  onDelete: (buttonId: string) => void;
  onVolumeChange: (level: number) => void;
  onBrightnessChange: (level: number) => void;
  isDragEnabled: boolean;
}

function SortableButtonItem({
  button,
  executingId,
  metrics,
  onExecute,
  onEdit,
  onDelete,
  onVolumeChange,
  onBrightnessChange,
  isDragEnabled,
}: SortableButtonItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: button.id, disabled: !isDragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const dragProps = isDragEnabled ? { ...attributes, ...listeners } : {};
  const cursorClass = isDragEnabled
    ? "cursor-grab active:cursor-grabbing"
    : "cursor-pointer";

  // Render Toggle Mic button with dynamic color and icon
  if (button.action_type === "mute_mic") {
    const isExecuting = executingId === button.id;
    const isMuted = metrics?.mic_muted ?? false;
    const dynamicColor = isMuted ? "#ef4444" : "#22c55e";
    const dynamicIcon = isMuted ? "mic-off" : "mic";
    const IconComponent = getIconComponent(dynamicIcon);

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative ${cursorClass}`}
        {...dragProps}
      >
        <button
          onClick={() => !isDragEnabled && onExecute(button.id)}
          disabled={isDragEnabled}
          className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200 ${
            isExecuting ? "scale-95" : "hover:scale-105"
          }`}
          style={{
            background: `linear-gradient(135deg, ${dynamicColor}22, ${dynamicColor}11)`,
            border: `2px solid ${dynamicColor}`,
            boxShadow: isExecuting
              ? `0 0 40px ${dynamicColor}66, inset 0 0 30px ${dynamicColor}33`
              : `0 0 20px ${dynamicColor}22`,
          }}
        >
          {IconComponent && (
            <IconComponent
              size={36}
              color={dynamicColor}
              className={`transition-all ${isExecuting ? "scale-110" : ""}`}
            />
          )}
          <span className="text-sm font-medium text-white truncate px-2 max-w-full">
            {button.name}
          </span>
        </button>

        {/* Action Buttons */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(button);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-gray-800 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Edit2 size={14} className="text-gray-300" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(button.id);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-red-600 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Trash2 size={14} className="text-gray-300" />
          </button>
        </div>

        {/* Badge */}
        <div
          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `${dynamicColor}33`, color: dynamicColor }}
        >
          {isMuted ? "mic off" : "mic on"}
        </div>
      </div>
    );
  }

  // Render Toggle Volume button with dynamic color and icon
  if (button.action_type === "volume_mute") {
    const isExecuting = executingId === button.id;
    const isVolumeMuted = metrics?.volume_muted ?? false;
    const dynamicColor = isVolumeMuted ? "#ef4444" : "#06b6d4";
    const dynamicIcon = isVolumeMuted ? "volume-x" : "volume-2";
    const IconComponent = getIconComponent(dynamicIcon);

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative ${cursorClass}`}
        {...dragProps}
      >
        <button
          onClick={() => !isDragEnabled && onExecute(button.id)}
          disabled={isDragEnabled}
          className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200 ${
            isExecuting ? "scale-95" : "hover:scale-105"
          }`}
          style={{
            background: `linear-gradient(135deg, ${dynamicColor}22, ${dynamicColor}11)`,
            border: `2px solid ${dynamicColor}`,
            boxShadow: isExecuting
              ? `0 0 40px ${dynamicColor}66, inset 0 0 30px ${dynamicColor}33`
              : `0 0 20px ${dynamicColor}22`,
          }}
        >
          {IconComponent && (
            <IconComponent
              size={36}
              color={dynamicColor}
              className={`transition-all ${isExecuting ? "scale-110" : ""}`}
            />
          )}
          <span className="text-sm font-medium text-white truncate px-2 max-w-full">
            {button.name}
          </span>
        </button>

        {/* Action Buttons */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(button);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-gray-800 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Edit2 size={14} className="text-gray-300" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(button.id);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-red-600 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Trash2 size={14} className="text-gray-300" />
          </button>
        </div>

        {/* Badge */}
        <div
          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `${dynamicColor}33`, color: dynamicColor }}
        >
          {isVolumeMuted ? "muted" : "volume on"}
        </div>
      </div>
    );
  }

  // Render Volume control (knob or slider)
  if (button.action_type === "volume_knob") {
    const controlStyle = button.action_data?.control_style || "knob";
    const sliderDirection = (button.action_data?.slider_direction ||
      "horizontal") as "horizontal" | "vertical";
    const badgeLabel =
      controlStyle === "slider"
        ? `volume slider (${sliderDirection})`
        : "volume knob";

    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          pointerEvents: isDragEnabled ? "auto" : "auto",
        }}
        className={`group relative ${cursorClass}`}
        {...dragProps}
      >
        {controlStyle === "slider" ? (
          <VolumeSliderButton
            value={metrics?.volume_level ?? 50}
            onChange={() => { !isDragEnabled && onVolumeChange(metrics?.volume_level ?? 50) }}
            color={button.color}
            name={button.name}
            direction={sliderDirection}
          />
        ) : (
          <VolumeKnobButton
            value={metrics?.volume_level ?? 50}
            onChange={() => { !isDragEnabled && onVolumeChange(metrics?.volume_level ?? 50) }}
            color={button.color}
            name={button.name}
          />
        )}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(button);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-gray-800 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Edit2 size={14} className="text-gray-300" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(button.id);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-red-600 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Trash2 size={14} className="text-gray-300" />
          </button>
        </div>
        <div
          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity z-10"
          style={{ background: `${button.color}33`, color: button.color }}
        >
          {badgeLabel}
        </div>
      </div>
    );
  }

  // Render Brightness control (knob or slider)
  if (button.action_type === "brightness_knob") {
    const controlStyle = button.action_data?.control_style || "knob";
    const sliderDirection = (button.action_data?.slider_direction ||
      "horizontal") as "horizontal" | "vertical";
    const badgeLabel =
      controlStyle === "slider"
        ? `brightness slider (${sliderDirection})`
        : "brightness knob";

    return (
      <div
        ref={setNodeRef}
        style={{
          ...style,
          pointerEvents: isDragEnabled ? "auto" : "auto",
        }}
        className={`group relative ${cursorClass}`}
        {...dragProps}
      >
        {controlStyle === "slider" ? (
          <BrightnessSliderButton
            value={metrics?.brightness_level ?? 50}
            onChange={() => { !isDragEnabled && onBrightnessChange(metrics?.brightness_level ?? 50) }}
            color={button.color}
            name={button.name}
            direction={sliderDirection}
          />
        ) : (
          <BrightnessKnobButton
            value={metrics?.brightness_level ?? 50}
            onChange={() => { !isDragEnabled && onBrightnessChange(metrics?.brightness_level ?? 50) }}
            color={button.color}
            name={button.name}
          />
        )}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(button);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-gray-800 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Edit2 size={14} className="text-gray-300" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(button.id);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-red-600 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Trash2 size={14} className="text-gray-300" />
          </button>
        </div>
        <div
          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity z-10"
          style={{ background: `${button.color}33`, color: button.color }}
        >
          {badgeLabel}
        </div>
      </div>
    );
  }

  // Render Media Play/Pause button with rich now playing info
  if (button.action_type === "media_play_pause") {
    const isExecuting = executingId === button.id;
    const mediaState = metrics?.media ?? {
      title: "",
      artist: "",
      status: "",
      thumbnail: "",
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative ${cursorClass}`}
        {...dragProps}
      >
        <MediaPlayPauseButton
          media={mediaState}
          isExecuting={isExecuting}
          onClick={() => !isDragEnabled && onExecute(button.id)}
        />
        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(button);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-gray-800 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Edit2 size={14} className="text-gray-300" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(button.id);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-red-600 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Trash2 size={14} className="text-gray-300" />
          </button>
        </div>
      </div>
    );
  }

  // Render Media Next/Prev buttons
  if (
    button.action_type === "media_next" ||
    button.action_type === "media_prev"
  ) {
    const isExecuting = executingId === button.id;
    const mediaColor = "#8b5cf6";
    const iconName =
      button.action_type === "media_next" ? "skip-forward" : "skip-back";
    const IconComponent = getIconComponent(iconName);

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative ${cursorClass}`}
        {...dragProps}
      >
        <button
          onClick={() => !isDragEnabled && onExecute(button.id)}
          disabled={isDragEnabled}
          className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200 ${
            isExecuting ? "scale-95" : "hover:scale-105"
          }`}
          style={{
            background: `linear-gradient(135deg, ${mediaColor}22, ${mediaColor}11)`,
            border: `2px solid ${mediaColor}`,
            boxShadow: isExecuting
              ? `0 0 40px ${mediaColor}66, inset 0 0 30px ${mediaColor}33`
              : `0 0 20px ${mediaColor}22`,
          }}
        >
          {IconComponent && (
            <IconComponent
              size={36}
              color={mediaColor}
              className={`transition-all ${isExecuting ? "scale-110" : ""}`}
            />
          )}
          <span className="text-sm font-medium text-white truncate px-2 max-w-full">
            {button.name}
          </span>
        </button>

        {/* Action Buttons */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(button);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-gray-800 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Edit2 size={14} className="text-gray-300" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(button.id);
            }}
            className="p-1.5 bg-gray-900/80 hover:bg-red-600 rounded-lg transition-colors backdrop-blur-sm"
          >
            <Trash2 size={14} className="text-gray-300" />
          </button>
        </div>

        {/* Badge */}
        <div
          className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `${mediaColor}33`, color: mediaColor }}
        >
          {button.action_type === "media_next" ? "next track" : "prev track"}
        </div>
      </div>
    );
  }

  // Render regular button
  const IconComponent = getIconComponent(button.icon);
  const isExecuting = executingId === button.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${cursorClass}`}
      {...dragProps}
    >
      <button
        onClick={() => !isDragEnabled && onExecute(button.id)}
        disabled={isDragEnabled}
        className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-200 ${
          isExecuting ? "scale-95" : "hover:scale-105"
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
            className={`transition-all ${isExecuting ? "scale-110" : ""}`}
          />
        )}
        <span className="text-sm font-medium text-white truncate px-2 max-w-full">
          {button.name}
        </span>
      </button>

      {/* Action Buttons */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(button);
          }}
          className="p-1.5 bg-gray-900/80 hover:bg-gray-800 rounded-lg transition-colors backdrop-blur-sm"
        >
          <Edit2 size={14} className="text-gray-300" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(button.id);
          }}
          className="p-1.5 bg-gray-900/80 hover:bg-red-600 rounded-lg transition-colors backdrop-blur-sm"
        >
          <Trash2 size={14} className="text-gray-300" />
        </button>
      </div>

      {/* Badge */}
      <div
        className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `${button.color}33`, color: button.color }}
      >
        {button.action_type.replace("_", " ")}
      </div>
    </div>
  );
}

export function ActionsPage() {
  const [buttons, setButtons] = useState<Button[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingButton, setEditingButton] = useState<Button | undefined>();
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadButtons();
    loadInitialMetrics();
    connectToWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const loadButtons = async () => {
    try {
      const data = await getButtons();
      setButtons(data || []);
    } catch (e) {
      console.error("Failed to load buttons:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadInitialMetrics = async () => {
    try {
      const data = await getSystemMetrics();
      setMetrics(data);
    } catch (e) {
      console.error("Failed to load initial metrics:", e);
    }
  };

  const connectToWebSocket = () => {
    wsRef.current = connectWebSocket(
      (newMetrics) => {
        setMetrics(newMetrics);
      },
      () => {
        setTimeout(connectToWebSocket, 3000);
      }
    );
  };

  const handleCreateButton = async (buttonData: Omit<Button, "id">) => {
    try {
      await createButton(buttonData);
      await loadButtons();
      setShowEditor(false);
      setEditingButton(undefined);
    } catch (e) {
      console.error("Failed to create button:", e);
    }
  };

  const handleUpdateButton = async (buttonData: Button) => {
    try {
      await updateButton(buttonData);
      await loadButtons();
      setShowEditor(false);
      setEditingButton(undefined);
    } catch (e) {
      console.error("Failed to update button:", e);
    }
  };

  const handleDeleteButton = async (id: string) => {
    try {
      await deleteButton(id);
      await loadButtons();
    } catch (e) {
      console.error("Failed to delete button:", e);
    }
  };

  const handleExecuteAction = async (buttonId: string) => {
    setExecutingId(buttonId);
    try {
      const result = await executeAction(buttonId);
      console.log("Action result:", result);
    } catch (e) {
      console.error("Failed to execute action:", e);
    } finally {
      setTimeout(() => setExecutingId(null), 300);
    }
  };

  const handleEditButton = (button: Button) => {
    setEditingButton(button);
    setShowEditor(true);
  };

  const handleVolumeChange = async (level: number) => {
    try {
      await setVolume(level);
    } catch (e) {
      console.error("Failed to set volume:", e);
    }
  };

  const handleBrightnessChange = async (level: number) => {
    try {
      await setBrightness(level);
    } catch (e) {
      console.error("Failed to set brightness:", e);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = buttons.findIndex((b) => b.id === active.id);
      const newIndex = buttons.findIndex((b) => b.id === over.id);

      // Optimistically update UI
      const newButtons = arrayMove(buttons, oldIndex, newIndex);
      setButtons(newButtons);

      // Persist to backend
      try {
        await reorderButtons(newButtons.map((b) => b.id));
      } catch (e) {
        console.error("Failed to reorder buttons:", e);
        // Revert on error
        await loadButtons();
      }
    }
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
          <p className="text-gray-400 mt-1">Configure your CtrlDeck buttons</p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleSwitch
            enabled={isDragEnabled}
            onToggle={() => setIsDragEnabled(!isDragEnabled)}
            enabledIcon={<GripVertical size={12} />}
            disabledIcon={<Lock size={12} />}
          />
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
      </div>

      {/* Button Grid */}
      {buttons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-4">
            <Plus size={40} className="text-gray-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            No buttons yet
          </h3>
          <p className="text-gray-400 mb-4">
            Create your first button to get started
          </p>
          <button
            onClick={() => setShowEditor(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            Create Button
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={buttons.map((b) => b.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {buttons.map((button) => (
                <SortableButtonItem
                  key={button.id}
                  button={button}
                  executingId={executingId}
                  metrics={metrics}
                  onExecute={handleExecuteAction}
                  onEdit={handleEditButton}
                  onDelete={handleDeleteButton}
                  onVolumeChange={handleVolumeChange}
                  onBrightnessChange={handleBrightnessChange}
                  isDragEnabled={isDragEnabled}
                />
              ))}

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
          </SortableContext>
        </DndContext>
      )}

      {/* Button Editor Modal */}
      {showEditor && (
        <ButtonEditor
          button={editingButton}
          onSave={handleCreateButton}
          onUpdate={handleUpdateButton}
          onClose={() => {
            setShowEditor(false);
            setEditingButton(undefined);
          }}
        />
      )}
    </div>
  );
}
