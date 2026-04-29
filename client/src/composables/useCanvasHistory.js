import { ref, computed } from 'vue';
import { fabric } from 'fabric';
import { CANVAS_CONSTANTS, CUSTOM_PROPS } from '../constants/canvas';

/**
 * Manages canvas history for undo/redo operations.
 * Extracted from useCanvas.js to follow Single Responsibility Principle.
 *
 * @param {import('vue').ShallowRef} canvas - The Fabric.js canvas instance ref
 * @param {object} callbacks - Callback functions for cross-composable communication
 * @param {Function} callbacks.saveCurrentPageState - Saves the current page state
 * @param {Function} callbacks.renderAllPages - Renders all pages
 * @param {Function} callbacks.relinkSignatures - Re-links signature blocks after restore
 */
export function useCanvasHistory(canvas, callbacks = {}) {
  const historyStack = ref([]);
  const redoStack = ref([]);
  const isHistoryLocked = ref(false);

  let saveHistoryTimeout = null;

  const saveHistory = () => {
    if (!canvas.value || isHistoryLocked.value) return;

    if (saveHistoryTimeout) clearTimeout(saveHistoryTimeout);

    saveHistoryTimeout = setTimeout(() => {
      if (!canvas.value || isHistoryLocked.value) return;

      const json = canvas.value.toJSON(CUSTOM_PROPS);
      if (json.objects) {
        json.objects = json.objects.filter(
          (obj) => obj.id !== 'page-bg' && obj.id !== 'page-bg-image' && obj.id !== 'page-divider'
        );
      }
      const jsonString = JSON.stringify(json);

      if (
        historyStack.value.length > 0 &&
        historyStack.value[historyStack.value.length - 1] === jsonString
      ) {
        return;
      }

      historyStack.value.push(jsonString);

      if (historyStack.value.length > CANVAS_CONSTANTS.MAX_HISTORY) {
        historyStack.value = historyStack.value.slice(-CANVAS_CONSTANTS.MAX_HISTORY);
      }

      redoStack.value = [];
    }, CANVAS_CONSTANTS.HISTORY_DEBOUNCE_MS);
  };

  const restoreStateNoFlicker = (jsonString) => {
    if (!canvas.value) return;
    const json = JSON.parse(jsonString);
    const objectsToLoad = json.objects || [];

    canvas.value.renderOnAddRemove = false;

    const currentObjs = canvas.value.getObjects();
    currentObjs.forEach((obj) => {
      if (obj.id !== 'page-bg' && obj.id !== 'page-bg-image' && obj.id !== 'page-divider') {
        canvas.value.remove(obj);
      }
    });

    fabric.util.enlivenObjects(objectsToLoad, async (enlivenedObjects) => {
      enlivenedObjects.forEach((obj) => {
        canvas.value.add(obj);
      });

      canvas.value.renderOnAddRemove = true;
      canvas.value.renderAll();

      if (typeof callbacks.relinkSignatures === 'function') {
        callbacks.relinkSignatures();
      }

      if (typeof callbacks.renderAllPages === 'function') {
        await callbacks.renderAllPages({ infraOnly: true });
      }

      if (typeof callbacks.saveCurrentPageState === 'function') {
        callbacks.saveCurrentPageState();
      }

      setTimeout(() => {
        isHistoryLocked.value = false;
      }, 100);
    });
  };

  const undo = () => {
    if (historyStack.value.length > 1) {
      isHistoryLocked.value = true;
      const current = historyStack.value.pop();
      redoStack.value.push(current);

      const previous = historyStack.value[historyStack.value.length - 1];
      restoreStateNoFlicker(previous);
    }
  };

  const redo = () => {
    if (redoStack.value.length > 0) {
      isHistoryLocked.value = true;
      const next = redoStack.value.pop();
      historyStack.value.push(next);

      restoreStateNoFlicker(next);
    }
  };

  const resetHistory = () => {
    historyStack.value = [];
    redoStack.value = [];
  };

  const setHistoryLock = (status) => {
    isHistoryLocked.value = status;
  };

  /**
   * Clears history timeout on dispose to prevent memory leaks.
   */
  const disposeHistory = () => {
    if (saveHistoryTimeout) {
      clearTimeout(saveHistoryTimeout);
      saveHistoryTimeout = null;
    }
    historyStack.value = [];
    redoStack.value = [];
  };

  return {
    historyStack,
    redoStack,
    isHistoryLocked,
    saveHistory,
    undo,
    redo,
    resetHistory,
    setHistoryLock,
    disposeHistory,
    canUndo: computed(() => historyStack.value.length > 1),
    canRedo: computed(() => redoStack.value.length > 0)
  };
}
