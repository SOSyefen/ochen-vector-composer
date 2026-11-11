export type IllustrationId =
  | 'book'
  | 'phone'
  | 'puzzle'
  | 'coin'
  | 'headphones'
  | 'lamp'
  | 'vase'
  | 'notebook'
  | 'folder'
  | 'pen';

export type DetailSize = 'L' | 'S';

export const S_SIZE_SCALE_RATIO = 0.65;

export type ObjectVariant = 'Main' | 'Bg';

export type CanvasFormatId = 'square' | 'horizontal' | 'vertical';

export interface CanvasFormatConfig {
  id: CanvasFormatId;
  label: string;
  width: number;
  height: number;
  ratio: string;
}

export const CANVAS_FORMATS: Record<CanvasFormatId, CanvasFormatConfig> = {
  square: {
    id: 'square',
    label: 'Квадрат (1:1)',
    width: 380,
    height: 380,
    ratio: '1:1',
  },
  horizontal: {
    id: 'horizontal',
    label: 'Горизонтальный (16:9)',
    width: 450,
    height: 250,
    ratio: '16:9',
  },
  vertical: {
    id: 'vertical',
    label: 'Вертикальный (9:16)',
    width: 250,
    height: 450,
    ratio: '9:16',
  },
};

export type ColorRole =
  | 'bg'
  | 'primary_accent'
  | 'secondary_accent'
  | 'highlight'
  | 'tertiary_accent'
  | 'soft_fill'
  | 'stroke'
  | 'white';

export interface PaletteRoles {
  bg: string;
  primary_accent: string;
  secondary_accent: string;
  highlight: string;
  tertiary_accent: string;
  soft_fill: string;
  stroke: string;
  white: string;
}

export interface Palette {
  id: string;
  name: string;
  roles: PaletteRoles;
  isCustom?: boolean;
}

export interface CanvasObject {
  instanceId: string;
  illustrationId: IllustrationId;
  variant: ObjectVariant;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
}

export interface CompositionState {
  size: DetailSize;
  paletteId: string;
  customPalette?: Palette;
  canvasBg: string;
  format: CanvasFormatId;
  objects: CanvasObject[];
  selectedInstanceId: string | null;
}

export interface IllustrationCatalogItem {
  id: IllustrationId;
  label: string;
  category: 'study' | 'tech' | 'creative' | 'finance' | 'work';
  visualWeight: number;
}
