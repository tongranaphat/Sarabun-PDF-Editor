import { fabric } from 'fabric';
import { CANVAS_CONSTANTS } from '../constants/canvas';
import { BLOCK_THEME } from '../constants/theme';

/**
 * Manages the creation of stamp (ตราประทับรับหนังสือ) blocks on the canvas.
 * Extracted from useCanvas.js to follow Single Responsibility Principle.
 *
 * @param {import('vue').ShallowRef} canvas - The Fabric.js canvas instance ref
 * @param {object} callbacks - Callback object with lazy getters
 * @param {Function} callbacks.saveCurrentPageState - Saves page state after modification
 * @param {Function} callbacks.saveHistory - Saves undo history
 */
export function useStampBlock(canvas, callbacks = {}) {

  const addStampBlockToCanvas = (metadata) => {
    if (!canvas.value) return;

    const { schoolName, seqNo, date, time, receiverName } = metadata;

    const allBgObjects = canvas.value
      .getObjects()
      .filter((o) => o.id === 'page-bg' || o.id === 'page-bg-image');
    let scale = 1;
    let firstPage = null;
    if (allBgObjects.length > 0) {
      allBgObjects.sort((a, b) => a.top - b.top);
      firstPage = allBgObjects[0];
      scale = firstPage.getScaledWidth() / CANVAS_CONSTANTS.PAGE_WIDTH;
    }

    const objects = [];
    const fontFamily = BLOCK_THEME.FONT_FAMILY;
    const fontSize = BLOCK_THEME.STAMP.FONT_SIZE * scale;
    let currentY = BLOCK_THEME.STAMP.TOP_PADDING * scale;

    const fieldsData = [
      { label: 'เลขที่รับ', val: String(seqNo || '') },
      { label: 'วันที่', val: date || '' },
      { label: 'เวลา', val: time || '' },
      { label: 'ผู้รับ', val: receiverName || '' }
    ];

    let maxValWidth = BLOCK_THEME.STAMP.MIN_VALUE_WIDTH * scale;
    const labels = [];
    const values = [];

    fieldsData.forEach((field) => {
      const labelItem = new fabric.Text(field.label, { fontSize, fontFamily, fill: BLOCK_THEME.PRIMARY_COLOR });
      const valItem = new fabric.Text(field.val, {
        fontSize: fontSize + 1 * scale,
        fontFamily,
        fill: BLOCK_THEME.PRIMARY_COLOR
      });
      labels.push(labelItem);
      values.push(valItem);
      if (valItem.width > maxValWidth) {
        maxValWidth = valItem.width;
      }
    });

    const dynamicBoxWidth = BLOCK_THEME.STAMP.VALUE_LEFT_OFFSET * scale + maxValWidth + BLOCK_THEME.STAMP.VALUE_RIGHT_PADDING * scale;
    const blockWidth = Math.max(BLOCK_THEME.STAMP.MIN_WIDTH * scale, dynamicBoxWidth);

    const displaySchoolName = schoolName || 'โรงเรียนทดสอบ';
    let schoolFontSize = fontSize + 1 * scale;
    if (displaySchoolName.length >= 40) {
      schoolFontSize = fontSize - 1.5 * scale;
    } else if (displaySchoolName.length >= 25) {
      schoolFontSize = fontSize - 0.5 * scale;
    }

    const schoolText = new fabric.Text(displaySchoolName, {
      fontSize: schoolFontSize,
      fontFamily: fontFamily,
      fontWeight: 'bold',
      fill: BLOCK_THEME.PRIMARY_COLOR,
      left: blockWidth / 2,
      top: currentY,
      originX: 'center',
      originY: 'top'
    });
    objects.push(schoolText);
    currentY += schoolText.height + BLOCK_THEME.STAMP.HEADER_GAP * scale;

    for (let i = 0; i < fieldsData.length; i++) {
      const labelItem = labels[i];
      const valItem = values[i];

      labelItem.set({ left: BLOCK_THEME.STAMP.LABEL_LEFT_PADDING * scale, top: currentY });
      const valCenter = BLOCK_THEME.STAMP.VALUE_LEFT_OFFSET * scale + (blockWidth - BLOCK_THEME.STAMP.LABEL_LEFT_PADDING * scale - BLOCK_THEME.STAMP.VALUE_LEFT_OFFSET * scale) / 2;
      valItem.set({
        left: valCenter,
        top: currentY - 1 * scale,
        originX: 'center',
        originY: 'top'
      });

      objects.push(labelItem, valItem);
      currentY += Math.max(labelItem.height, valItem.height) + BLOCK_THEME.STAMP.ROW_GAP * scale;
    }

    const frame = new fabric.Rect({
      left: 0,
      top: 0,
      width: blockWidth,
      height: currentY + BLOCK_THEME.STAMP.BOTTOM_PADDING * scale,
      fill: 'transparent',
      stroke: BLOCK_THEME.PRIMARY_COLOR,
      strokeWidth: BLOCK_THEME.STAMP.FRAME_STROKE_WIDTH,
      rx: BLOCK_THEME.STAMP.FRAME_CORNER_RADIUS * scale,
      ry: BLOCK_THEME.STAMP.FRAME_CORNER_RADIUS * scale
    });
    objects.unshift(frame);

    let dropX = CANVAS_CONSTANTS.PAGE_WIDTH - blockWidth - BLOCK_THEME.STAMP.POSITION_RIGHT_MARGIN * scale;
    let dropY = BLOCK_THEME.STAMP.POSITION_TOP_MARGIN * scale;

    if (firstPage) {
      dropX = firstPage.left + firstPage.getScaledWidth() - blockWidth - BLOCK_THEME.STAMP.POSITION_RIGHT_MARGIN * scale;
      dropY = firstPage.top + BLOCK_THEME.STAMP.POSITION_TOP_MARGIN * scale;
    }

    const stampGroup = new fabric.Group(objects, {
      left: dropX,
      top: dropY,
      originX: 'left',
      originY: 'top',
      isSignatureBlock: false,
      isStampBlock: true,
      stampData: metadata,
      id: `stamp_${Date.now()}`,
      name: `บล็อกเลขที่รับ`
    });

    canvas.value.add(stampGroup);
    canvas.value.setActiveObject(stampGroup);
    canvas.value.requestRenderAll();

    if (typeof callbacks.saveCurrentPageState === 'function') callbacks.saveCurrentPageState();
    if (typeof callbacks.saveHistory === 'function') callbacks.saveHistory();
  };

  return {
    addStampBlockToCanvas
  };
}
