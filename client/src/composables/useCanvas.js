import { ref, shallowRef, computed } from 'vue';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { CANVAS_CONSTANTS, CUSTOM_PROPS } from '../constants/canvas';
import { useCanvasHistory } from './useCanvasHistory';
import { useSignatureBlock } from './useSignatureBlock';
import { useStampBlock } from './useStampBlock';

export function useCanvas() {
  const _callbacks = {
    saveCurrentPageState: null,
    forceUnlockObject: null,
    renderAllPages: null
  };

  const setCallbacks = (cbs = {}) => {
    if (cbs.saveCurrentPageState) _callbacks.saveCurrentPageState = cbs.saveCurrentPageState;
    if (cbs.forceUnlockObject) _callbacks.forceUnlockObject = cbs.forceUnlockObject;
    if (cbs.renderAllPages) _callbacks.renderAllPages = cbs.renderAllPages;
  };
  const canvas = shallowRef(null);
  const zoomLevel = ref(1);
  const viewportRef = ref(null);

  const historyCallbacks = {
    get saveCurrentPageState() { return _callbacks.saveCurrentPageState; },
    get renderAllPages() { return _callbacks.renderAllPages; },
    get relinkSignatures() { return relinkSignatures; }
  };
  const {
    historyStack, redoStack, isHistoryLocked,
    saveHistory, undo, redo, resetHistory, setHistoryLock,
    disposeHistory, canUndo, canRedo
  } = useCanvasHistory(canvas, historyCallbacks);

  const initCanvas = () => {
    if (canvas.value) return;

    fabric.Object.prototype.set({
      transparentCorners: false,
      cornerColor: '#ffffff',
      cornerStrokeColor: '#ff85ab',
      borderColor: '#ff85ab',
      editingBorderColor: '#ff85ab',
      cornerSize: 8,
      borderScaleFactor: 1.5,
      padding: 5,
      cornerStyle: 'circle',
      borderOpacityWhenMoving: 0.6
    });

    fabric.Textbox.prototype.editingBorderColor = '#ff85ab';
    fabric.IText.prototype.editingBorderColor = '#ff85ab';

    fabric.devicePixelRatio = 1;
    canvas.value = new fabric.Canvas('c', {
      width: CANVAS_CONSTANTS.PAGE_WIDTH,
      height: CANVAS_CONSTANTS.PAGE_HEIGHT,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      renderOnAddRemove: true
    });

    canvas.value.on('object:scaling', (e) => {
      const obj = e.target;
      if (!obj) return;

      if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
        const corner = e.transform ? e.transform.corner : '';
        const sx = obj.scaleX;
        const sy = obj.scaleY;

        if (corner === 'ml' || corner === 'mr') {
          obj.set({
            width: obj.width * sx,
            scaleX: 1,
            scaleY: 1
          });
        } else {
          const newFontSize = (obj.fontSize || 16) * Math.max(sx, sy);
          obj.set({
            fontSize: Math.round(newFontSize),
            width: obj.width * sx,
            height: obj.height * sy,
            scaleX: 1,
            scaleY: 1
          });
        }
        obj.setCoords();
      }
    });
    let relinkTimeout = null;
    canvas.value.on('object:added', () => {
      if (relinkTimeout) clearTimeout(relinkTimeout);
      relinkTimeout = setTimeout(() => {
        relinkSignatures();
      }, 300);
    });
  };

  const render = async () => {
    if (canvas.value) canvas.value.requestRenderAll();
  };

  if (!fabric.Object.prototype.__customExportPatched) {
    const originalToObject = fabric.Object.prototype.toObject;
    fabric.Object.prototype.toObject = function (additionalProperties) {
      return originalToObject.call(
        this,
        ['id', 'name', 'isSignatureBlock', 'isSignaturePrefix', 'linkedId', 'sigData'].concat(
          additionalProperties || []
        )
      );
    };
    fabric.Object.prototype.__customExportPatched = true;
  }

  const blockCallbacks = {
    get saveCurrentPageState() { return _callbacks.saveCurrentPageState; },
    get saveHistory() { return saveHistory; },
    get getPageScaleAtPos() { return getPageScaleAtPos; }
  };
  const { addSignatureBlockToCanvas, relinkSignatures } = useSignatureBlock(canvas, blockCallbacks);
  const { addStampBlockToCanvas } = useStampBlock(canvas, blockCallbacks);

  const getPageScaleAtPos = (y) => {
    if (!canvas.value) return 1;
    const bgObjects = canvas.value
      .getObjects()
      .filter((o) => o.id === 'page-bg' || o.id === 'page-bg-image');
    if (bgObjects.length === 0) return 1;

    const targetBg = bgObjects.find(
      (bg) =>
        y >= bg.top && y <= bg.top + bg.getScaledHeight() + (CANVAS_CONSTANTS.PAGE_GAP || 40)
    );
    if (targetBg) {
      return targetBg.getScaledWidth() / CANVAS_CONSTANTS.PAGE_WIDTH;
    }

    bgObjects.sort((a, b) => a.top - b.top);
    return bgObjects[0].getScaledWidth() / CANVAS_CONSTANTS.PAGE_WIDTH;
  };


  const addImageToCanvas = async (url, x = 100, y = 100) => {

    if (!canvas.value) return;
    fabric.Image.fromURL(
      url,
      (img) => {
        img.set({ id: uuidv4(), left: x, top: y });
        img.scaleToWidth(200);

        if (typeof _callbacks.forceUnlockObject === 'function') {
          _callbacks.forceUnlockObject(img);
        }

        canvas.value.add(img);
        canvas.value.setActiveObject(img);
        if (typeof _callbacks.saveCurrentPageState === 'function')
          _callbacks.saveCurrentPageState();
        saveHistory();
      },
      { crossOrigin: 'anonymous' }
    );
  };

  const removeSelectedObject = () => {
    if (!canvas.value) return;
    const activeObjects = canvas.value.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => {
        canvas.value.remove(obj);
      });
      canvas.value.discardActiveObject().requestRenderAll();
      if (typeof _callbacks.saveCurrentPageState === 'function') _callbacks.saveCurrentPageState();
      saveHistory();
    }
  };


  const capturePageAsImage = (pageIndex, pageHeight, pageGap, multiplier = 2) => {
    try {
      const c = canvas.value;
      if (!c) return null;

      const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
      const GAP = CANVAS_CONSTANTS.PAGE_GAP;
      const captureWidth = CANVAS_CONSTANTS.PAGE_WIDTH * zoomLevel.value;
      const captureHeight = P_H * zoomLevel.value;
      const topOffset = pageIndex * (P_H + GAP) * zoomLevel.value;

      const TEXT_TYPES = ['textbox', 'text', 'i-text'];
      const IMAGE_TYPES = ['image'];
      const ALL_OVERLAY_TYPES = [...TEXT_TYPES, ...IMAGE_TYPES];

      const allObjects = c.getObjects();
      const hiddenForCapture = [];

      allObjects.forEach((obj) => {
        const center = obj.getCenterPoint();
        const objPageIndex = Math.floor(center.y / (P_H + GAP));
        const isWrongPage = objPageIndex !== pageIndex;
        const isOverlay =
          ALL_OVERLAY_TYPES.includes(obj.type) &&
          obj.id !== 'page-bg-image' &&
          obj.id !== 'page-bg';

        if ((isWrongPage || isOverlay) && obj.visible) {
          hiddenForCapture.push(obj);
          obj.visible = false;
        }
      });

      c.renderAll();

      let dataUrl = null;
      try {
        dataUrl = c.toDataURL({
          format: 'jpeg',
          quality: 0.92,
          multiplier: multiplier / zoomLevel.value,
          left: 0,
          top: topOffset,
          width: captureWidth,
          height: captureHeight
        });
      } catch (canvasError) {
        console.warn(
          `Canvas taint detected on page ${pageIndex + 1}, using fallback:`,
          canvasError
        );

        try {
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = CANVAS_CONSTANTS.PAGE_WIDTH * multiplier;
          fallbackCanvas.height = P_H * multiplier;
          const fallbackCtx = fallbackCanvas.getContext('2d');

          fallbackCtx.fillStyle = '#ffffff';
          fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);

          dataUrl = fallbackCanvas.toDataURL('image/jpeg', 0.92);
        } catch (fallbackError) {
          console.error(`Even fallback failed for page ${pageIndex + 1}:`, fallbackError);
          return null;
        }
      }

      hiddenForCapture.forEach((obj) => {
        obj.visible = true;
      });
      c.renderAll();

      return dataUrl && dataUrl.length > 100 ? dataUrl : null;
    } catch (error) {
      console.error(`Error capturing page ${pageIndex + 1}:`, error);
      return null;
    }
  };

  const cleanupCanvasObjects = (canvas, deep = true) => {
    if (!canvas) return;

    let cleanedCount = 0;

    const objects = canvas.getObjects();

    objects.forEach((obj) => {
      try {
        if (obj.clipPath) {
          if (obj.clipPath.dispose && typeof obj.clipPath.dispose === 'function') {
            obj.clipPath.dispose();
          }
          obj.clipPath = null;
        }

        if (obj.off && typeof obj.off === 'function') {
          obj.off();
        }

        if (obj.dispose && typeof obj.dispose === 'function') {
          obj.dispose();
        }

        if (deep) {
          if (obj._cacheContext) {
            obj._cacheContext = null;
          }
          if (obj._cacheCanvas) {
            obj._cacheCanvas = null;
          }
          if (obj._currentTransform) {
            obj._currentTransform = null;
          }
        }

        cleanedCount++;
      } catch (cleanupError) {
        console.error('Error cleaning up object:', cleanupError);
      }
    });

    return cleanedCount;
  };

  const updateCanvasZoom = () => {
    if (!canvas.value) return;
    canvas.value.requestRenderAll();
  };

  const zoomIn = () => {
    zoomLevel.value = Math.min(3, zoomLevel.value + 0.1);
  };
  const zoomOut = () => {
    zoomLevel.value = Math.max(0.1, zoomLevel.value - 0.1);
  };
  const fitToScreen = () => {
    zoomLevel.value = 1;
  };

  const periodicCleanup = (canvas, intervalMs = 30000) => {
    let cleanupInterval = null;

    const startCleanup = () => {
      if (cleanupInterval) return;

      cleanupInterval = setInterval(() => {
        if (canvas) {
          const objects = canvas.getObjects();

          objects.forEach((obj) => {
            if (obj._cacheContext) {
              obj._cacheContext = null;
            }
            if (obj._cacheCanvas) {
              obj._cacheCanvas = null;
            }
          });
        }
      }, intervalMs);
    };

    const stopCleanup = () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
    };

    return { startCleanup, stopCleanup };
  };

  const updateCanvasDimensions = () => {
    if (canvas.value) {
      canvas.value.calcOffset();
      canvas.value.requestRenderAll();
    }
  };

  const dispose = () => {
    disposeHistory();

    if (canvas.value) {
      try {
        canvas.value.off();
        canvas.value.dispose();
      } catch (e) {
        console.warn('Canvas dispose error (non-critical):', e);
      }
      canvas.value = null;
    }

    _callbacks.saveCurrentPageState = null;
    _callbacks.forceUnlockObject = null;
    _callbacks.renderAllPages = null;
  };

  return {
    canvas,
    zoomLevel,
    viewportRef,
    historyStack,
    redoStack,
    undo,
    redo,
    resetHistory,
    saveHistory,
    setHistoryLock,
    setHistoryContext: () => { },
    setCallbacks,
    canUndo,
    canRedo,

    initCanvas,
    removeSelectedObject,
    addImageToCanvas,
    capturePageAsImage,
    updateCanvasZoom,

    zoomIn,
    zoomOut,
    fitToScreen,

    cleanupCanvasObjects,
    periodicCleanup,



    render,
    dispose,

    addSignatureBlockToCanvas,
    addStampBlockToCanvas,
    updateCanvasDimensions,


    relinkSignatures
  };
}
