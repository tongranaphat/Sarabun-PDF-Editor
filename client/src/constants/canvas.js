/**
 * Custom properties to preserve during Fabric.js serialization/deserialization.
 * Single source of truth — used by useCanvas.js, useExportPdf.js, and usePageManager.js.
 */
export const CUSTOM_PROPS = [
  'id',
  'selectable',
  'name',
  'textBaseline',
  'angle',
  'isSignatureBlock',
  'isSignaturePrefix',
  'isStampBlock',
  'stampData',
  'linkedId',
  'sigData'
];

export const CANVAS_CONSTANTS = {
  PAGE_WIDTH: 794,
  PAGE_HEIGHT: 1123,

  PAGE_GAP: 40,

  MIN_ZOOM: 0.1,
  MAX_ZOOM: 3.0,
  ZOOM_STEP: 0.1,

  DEFAULT_LEFT: 50,
  DEFAULT_TOP: 50,
  DEFAULT_FONT_SIZE: 20,
  DEFAULT_BOTTOM_MARGIN: 20,

  DEFAULT_BG_COLOR: '#ffffff',
  PREVIEW_BG_COLOR: '#f9f9f9',
  WORKSPACE_BG_COLOR: '#525659',

  IMAGE_QUALITY: 0.8,
  PDF_MULTIPLIER: 2,

  MAX_HISTORY: 20,

  HISTORY_DEBOUNCE_MS: 300,

  RENDER_DELAY: 100,
  ZOOM_RENDER_DELAY: 200,
  OBJECT_UNLOCK_DELAY: 50
};

export default CANVAS_CONSTANTS;
