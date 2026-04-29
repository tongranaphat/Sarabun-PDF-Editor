/**
 * Theme constants for visual styling of signature and stamp blocks.
 * Centralizes all hardcoded colors, fonts, and dimensions.
 */

export const BLOCK_THEME = {
  // Shared styling
  PRIMARY_COLOR: '#003399',
  FONT_FAMILY: 'Sarabun',

  // Signature Block
  SIGNATURE: {
    FONT_SIZE: 15,        // base, before scale
    MAX_TEXT_WIDTH: 165,   // base, before scale
    IMAGE_HEIGHT: 45,      // base, before scale
    GAP: 4,               // vertical gap between elements
    NAME_GAP: 4,          // gap after name text
    PREFIX_GAP_EXTRA: 8,  // extra gap after prefix text
    IMAGE_GAP: 5,         // gap after image
    BALANCER_HEIGHT: 1,   // invisible balancer rect height
  },

  // Stamp Block
  STAMP: {
    FONT_SIZE: 13,             // base, before scale
    FRAME_STROKE_WIDTH: 1.2,
    FRAME_CORNER_RADIUS: 2,    // base, before scale
    MIN_WIDTH: 145,            // base, before scale
    LABEL_LEFT_PADDING: 6,     // base, before scale
    VALUE_LEFT_OFFSET: 55,     // base, before scale
    VALUE_RIGHT_PADDING: 5,    // base, before scale
    HEADER_GAP: 6,             // base, before scale
    ROW_GAP: 6,                // base, before scale
    TOP_PADDING: 12,           // base, before scale
    BOTTOM_PADDING: 3,         // base, before scale
    MIN_VALUE_WIDTH: 45,       // base, before scale
    POSITION_RIGHT_MARGIN: 95, // base, before scale
    POSITION_TOP_MARGIN: 40,   // base, before scale
  }
};

export default BLOCK_THEME;
