import React, { useState } from 'react';
import { CanvasFormatId, CANVAS_FORMATS, CanvasObject, DetailSize, IllustrationId, ObjectVariant, Palette } from './types';
import { BUILTIN_PALETTES, isAllowedCanvasBg } from './utils/recolorEngine';
import { generateCompositionByMetaphor } from './utils/aiComposer';
import { assembleFullSvg, downloadSvgFile } from './utils/svgExporter';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { AiModal } from './components/AiModal';

let globalInstanceCounter = 0;

export const App: React.FC = () => {
  const [size, setSize] = useState<DetailSize>('L');
  const [format, setFormat] = useState<CanvasFormatId>('square');
  const [activePalette, setActivePalette] = useState<Palette>(BUILTIN_PALETTES[0]);
  const [canvasBg, setCanvasBgState] = useState<string>(BUILTIN_PALETTES[0].roles.bg);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Safe canvas background setter respecting client rules
  const setCanvasBg = (color: string) => {
    if (isAllowedCanvasBg(color, activePalette)) {
      setCanvasBgState(color);
    } else {
      console.warn(`[Client Color Rule Violation]: Color ${color} is forbidden as canvas background.`);
    }
  };

  // Initialize with a beautiful initial scene
  const [objects, setObjects] = useState<CanvasObject[]>(() =>
    generateCompositionByMetaphor('Финтех и аналитика', 'square')
  );

  const activeFormatConfig = CANVAS_FORMATS[format];

  // Object manipulation handlers
  const handleAddObject = (id: IllustrationId, variant: ObjectVariant) => {
    const newInstanceId = `obj_${Date.now()}_${++globalInstanceCounter}_${id}`;
    const maxZ = Math.max(...objects.map((o) => o.zIndex), 0);
    const formatScaleMap: Record<CanvasFormatId, number> = {
      square: 0.38,
      horizontal: 0.34,
      vertical: 0.32,
    };
    const defaultScale = formatScaleMap[format] || 0.38;
    const newObj: CanvasObject = {
      instanceId: newInstanceId,
      illustrationId: id,
      variant,
      x: activeFormatConfig.width / 2 + (Math.random() * 80 - 40),
      y: activeFormatConfig.height / 2 + (Math.random() * 80 - 40),
      scale: defaultScale,
      rotation: 0,
      zIndex: maxZ + 1,
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedId(newInstanceId);
  };

  const handleUpdateObject = (updated: CanvasObject) => {
    setObjects((prev) => prev.map((o) => (o.instanceId === updated.instanceId ? updated : o)));
  };

  const handleDeleteObject = (id: string) => {
    setObjects((prev) => prev.filter((o) => o.instanceId !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleDuplicateObject = (id: string) => {
    const src = objects.find((o) => o.instanceId === id);
    if (!src) return;

    const dup: CanvasObject = {
      ...src,
      instanceId: `obj_${Date.now()}_${++globalInstanceCounter}_${src.illustrationId}`,
      x: src.x + 30,
      y: src.y + 30,
      zIndex: Math.max(...objects.map((o) => o.zIndex), 0) + 1,
    };
    setObjects((prev) => [...prev, dup]);
    setSelectedId(dup.instanceId);
  };

  const handleBringForward = (id: string) => {
    setObjects((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((o) => o.instanceId === id);
      if (idx === -1 || idx === sorted.length - 1) return prev;
      const temp = sorted[idx];
      sorted[idx] = sorted[idx + 1];
      sorted[idx + 1] = temp;
      return sorted.map((o, i) => ({ ...o, zIndex: i }));
    });
  };

  const handleSendBackward = (id: string) => {
    setObjects((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((o) => o.instanceId === id);
      if (idx <= 0) return prev;
      const temp = sorted[idx];
      sorted[idx] = sorted[idx - 1];
      sorted[idx - 1] = temp;
      return sorted.map((o, i) => ({ ...o, zIndex: i }));
    });
  };

  // Palette change updates canvas background to match new theme's bg
  const handlePaletteChange = (newPalette: Palette) => {
    setActivePalette(newPalette);
    setCanvasBg(newPalette.roles.bg);
  };

  // Format change with proportional coordinate remapping and bounds clamping
  const handleFormatChange = (newFormat: CanvasFormatId) => {
    if (newFormat === format) return;
    const oldConfig = CANVAS_FORMATS[format];
    const newConfig = CANVAS_FORMATS[newFormat];
    const scaleX = newConfig.width / oldConfig.width;
    const scaleY = newConfig.height / oldConfig.height;

    setObjects((prev) =>
      prev.map((obj) => {
        const newX = Math.round(obj.x * scaleX);
        const newY = Math.round(obj.y * scaleY);
        return {
          ...obj,
          x: Math.max(60, Math.min(newConfig.width - 60, newX)),
          y: Math.max(60, Math.min(newConfig.height - 60, newY)),
        };
      })
    );
    setFormat(newFormat);
  };

  // Metaphor generator
  const handleGenerateMetaphor = (prompt: string) => {
    const newComposition = generateCompositionByMetaphor(prompt, format);
    setObjects(newComposition);
    setSelectedId(null);
  };

  // SVG Export
  const handleExportSvg = () => {
    const svgCode = assembleFullSvg(
      objects,
      size,
      activePalette,
      canvasBg,
      activeFormatConfig
    );
    downloadSvgFile(svgCode, `ochen-illustration-${format}-${size.toLowerCase()}.svg`);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100">
      {/* Top Header / Toolbar */}
      <Toolbar
        size={size}
        onSizeChange={setSize}
        format={format}
        onFormatChange={handleFormatChange}
        activePalette={activePalette}
        onPaletteChange={handlePaletteChange}
        onExport={handleExportSvg}
        onOpenAiModal={() => setIsAiModalOpen(true)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Catalog & Layers) */}
        <Sidebar
          size={size}
          activePalette={activePalette}
          canvasBg={canvasBg}
          onCanvasBgChange={setCanvasBg}
          objects={objects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAddObject={handleAddObject}
          onUpdateObject={handleUpdateObject}
          onDeleteObject={handleDeleteObject}
          onBringForward={handleBringForward}
          onSendBackward={handleSendBackward}
        />

        {/* Center SVG Artboard Canvas */}
        <Canvas
          objects={objects}
          size={size}
          palette={activePalette}
          canvasBg={canvasBg}
          format={activeFormatConfig}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdateObject={handleUpdateObject}
          onDeleteObject={handleDeleteObject}
          onDuplicateObject={handleDuplicateObject}
          onBringForward={handleBringForward}
          onSendBackward={handleSendBackward}
        />
      </div>

      {/* Scenario 1: AI Prompt Modal */}
      <AiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onGenerate={handleGenerateMetaphor}
      />
    </div>
  );
};

export default App;
