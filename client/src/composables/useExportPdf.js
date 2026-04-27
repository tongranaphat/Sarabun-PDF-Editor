import { nextTick } from 'vue';
import { CANVAS_CONSTANTS } from '../constants/canvas';
import { yieldToMain } from '../utils/yieldToMain';
import apiService from '../services/apiService';

/**
 * Shared PDF export utilities used by both handleSaveProject and handleExport.
 * Eliminates ~90% duplication between those two flows.
 */
export function useExportPdf() {
  const CUSTOM_PROPS = [
    'id', 'selectable', 'name', 'textBaseline', 'angle',
    'isSignatureBlock', 'isSignaturePrefix', 'isStampBlock',
    'stampData', 'linkedId', 'sigData'
  ];

  /**
   * Capture all canvas pages as data URL images.
   */
  const captureAllPages = async (
    canvas,
    pages,
    captureCanvasPageSafe,
    getPageTopOffset,
    getPageLeftOffset,
    getPageIndexFromTop,
    qualityMultiplier,
    onProgress
  ) => {
    const canvasImages = [];

    for (let i = 0; i < pages.length; i++) {
      const allObjects = canvas.getObjects();
      const hiddenForCapture = [];
      const OVERLAY_TYPES = ['textbox', 'text', 'i-text', 'image'];

      allObjects.forEach((obj) => {
        const center = obj.getCenterPoint();
        const objPageIndex = getPageIndexFromTop(center.y);
        const isWrongPage = objPageIndex !== i;
        const isBackground = obj.id === 'page-bg-image' || obj.id === 'page-bg';
        const isOverlay = OVERLAY_TYPES.includes(obj.type) && !isBackground;

        let shouldHide = isWrongPage;
        if (shouldHide && obj.visible) {
          obj.visible = false;
          hiddenForCapture.push(obj);
        }
      });

      canvas.renderAll();

      const topOffset = getPageTopOffset(i);
      const pageData = pages[i] || {};
      const pWidth = Number(pageData.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
      const pHeight = Number(pageData.height) || CANVAS_CONSTANTS.PAGE_HEIGHT;
      const offsetLeftCanvas = getPageLeftOffset(pWidth);

      const imgDataUrl = await captureCanvasPageSafe(
        canvas, offsetLeftCanvas, topOffset, pWidth, pHeight, qualityMultiplier
      );

      if (imgDataUrl) {
        canvasImages.push(imgDataUrl);
      } else {
        console.warn(`Fallback for page ${i + 1}`);
        const fallbackCanvas = document.createElement('canvas');
        fallbackCanvas.width = pWidth * qualityMultiplier;
        fallbackCanvas.height = pHeight * qualityMultiplier;
        const fallbackCtx = fallbackCanvas.getContext('2d');
        fallbackCtx.fillStyle = '#ffffff';
        fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
        canvasImages.push(fallbackCanvas.toDataURL('image/jpeg', 0.92));
      }

      hiddenForCapture.forEach((obj) => { obj.visible = true; });

      if (onProgress) onProgress(i + 1, `กำลังประมวลผลหน้า ${i + 1} / ${pages.length}`);
      await yieldToMain();
    }

    canvas.requestRenderAll();
    return canvasImages;
  };

  /**
   * Build the export project data with live text resolved from canvas objects.
   */
  const buildExportProjectData = (projectData, canvas, getPageTopOffset) => {
    const exportProjectData = JSON.parse(JSON.stringify(projectData));
    const liveObjects = canvas.getObjects();
    const TEXT_TYPES = ['textbox', 'text', 'i-text'];

    exportProjectData.pages.forEach((page, pageIndex) => {
      if (!page.objects) return;
      page.objects.forEach((jsonObj) => {
        if (!TEXT_TYPES.includes(jsonObj.type)) return;

        const liveObj = liveObjects.find((o) => {
          if (o.id && jsonObj.id && o.id === jsonObj.id) return true;
          const expectedTop = jsonObj.top + getPageTopOffset(pageIndex);
          return Math.abs(o.left - jsonObj.left) < 5 && Math.abs(o.top - expectedTop) < 5;
        });

        if (liveObj) {
          if (liveObj.textLines && liveObj.textLines.length > 0) {
            const cleanLines = liveObj.textLines.map((line) =>
              (typeof line === 'string' ? line : '').replace(/\u200B/g, '').trimEnd()
            );
            jsonObj.text = cleanLines.join('\n');
          } else if (liveObj.text) {
            jsonObj.text = liveObj.text.replace(/\u200B/g, '');
          }
        }
        if (jsonObj.text) jsonObj.text = jsonObj.text.replace(/\u200B/g, '');
      });
    });

    return exportProjectData;
  };

  /**
   * Fetch live variable map from API.
   */
  const fetchVariableMap = async () => {
    const variableMap = {};
    try {
      const realData = await apiService.getVariables();
      if (Array.isArray(realData)) {
        realData.forEach((item) => {
          if (item.key) variableMap[item.key] = item.value || '';
        });
      }
    } catch (error) {
      console.warn('Failed to fetch live variables:', error);
    }
    return variableMap;
  };

  /**
   * Restore canvas state after capture (re-enable selection & visibility).
   */
  const restoreCanvasAfterCapture = (canvas) => {
    if (!canvas) return;
    const TEXT_TYPES = ['textbox', 'text', 'i-text'];
    canvas.selection = true;
    canvas.getObjects().forEach((obj) => {
      if (obj.id !== 'page-bg' && obj.id !== 'page-bg-image') {
        obj.set({ selectable: true, evented: true, visible: true });
        if (TEXT_TYPES.includes(obj.type)) obj.set('editable', true);
      }
    });
    canvas.renderAll();
  };

  return {
    captureAllPages,
    buildExportProjectData,
    fetchVariableMap,
    restoreCanvasAfterCapture
  };
}
