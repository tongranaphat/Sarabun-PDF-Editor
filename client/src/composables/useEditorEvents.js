import { onMounted, onUnmounted } from 'vue';
import { fabric } from 'fabric';

/**
 * Manages all editor-level event listeners (keyboard shortcuts, wheel zoom, scroll tracking).
 * Extracted from EditorView.vue to reduce component complexity and prevent memory leaks.
 *
 * @param {object} deps - Dependencies
 * @param {import('vue').ShallowRef} deps.canvas - The Fabric.js canvas instance
 * @param {import('vue').Ref<number>} deps.zoomLevel - Current zoom level
 * @param {import('vue').Ref<HTMLElement>} deps.viewportRef - The viewport DOM element
 * @param {Function} deps.undo - Undo action
 * @param {Function} deps.redo - Redo action
 * @param {Function} deps.removeSelectedObject - Remove selected canvas objects
 * @param {Function} deps.saveHistory - Save history state
 * @param {Function} deps.getPageIndexFromTop - Calculate page index from scroll position
 * @param {import('vue').Ref<Array>} deps.pages - Pages array
 * @param {import('vue').Ref<number>} deps.currentPageIndex - Current page index
 */
export function useEditorEvents(deps) {
  const {
    canvas, zoomLevel, viewportRef,
    undo, redo, removeSelectedObject, saveHistory,
    getPageIndexFromTop, pages, currentPageIndex
  } = deps;

  let _wheelHandler = null;
  let _scrollHandler = null;
  let _keydownHandler = null;
  let clipboard = null;

  const setupWheelHandler = () => {
    _wheelHandler = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        zoomLevel.value = Math.max(0.1, Math.min(3, zoomLevel.value + (e.deltaY > 0 ? -0.1 : 0.1)));
      }
    };
  };

  const setupScrollHandler = () => {
    _scrollHandler = () => {
      if (!viewportRef.value) return;
      const newIndex = getPageIndexFromTop(viewportRef.value.scrollTop / zoomLevel.value);
      if (newIndex !== currentPageIndex.value && newIndex >= 0 && newIndex < pages.value.length) {
        currentPageIndex.value = newIndex;
      }
    };
  };

  const setupKeydownHandler = () => {
    _keydownHandler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const activeObj = canvas.value?.getActiveObject();
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (ctrl && key === 'a') {
        if (activeObj?.isEditing) return;
        e.preventDefault();
        const objects = canvas.value.getObjects().filter(
          (o) => o.id !== 'page-bg' && o.id !== 'page-bg-image' && o.selectable !== false
        );
        if (objects.length > 0) {
          canvas.value.discardActiveObject();
          canvas.value.setActiveObject(new fabric.ActiveSelection(objects, { canvas: canvas.value }));
          canvas.value.requestRenderAll();
        }
        return;
      }

      if (ctrl && key === 'z') {
        if (activeObj?.isEditing) return;
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }

      if (ctrl && key === 'y') {
        if (activeObj?.isEditing) return;
        e.preventDefault();
        redo();
        return;
      }

      if (ctrl && key === 'c') {
        if (activeObj && !activeObj.isEditing) {
          e.preventDefault();
          activeObj.clone((c) => { clipboard = c; });
        }
        return;
      }

      if (ctrl && key === 'v') {
        if (clipboard && canvas.value) {
          e.preventDefault();
          clipboard.clone((clonedObj) => {
            canvas.value.discardActiveObject();
            clonedObj.set({ left: clonedObj.left + 20, top: clonedObj.top + 20, evented: true, selectable: true });
            if (clonedObj.type === 'activeSelection') {
              clonedObj.canvas = canvas.value;
              clonedObj.forEachObject((o) => {
                o.id = 'obj_' + Date.now() + Math.random();
                canvas.value.add(o);
              });
              clonedObj.setCoords();
            } else {
              clonedObj.id = 'obj_' + Date.now() + Math.random();
              canvas.value.add(clonedObj);
            }
            clipboard.top += 20;
            clipboard.left += 20;
            canvas.value.setActiveObject(clonedObj);
            canvas.value.requestRenderAll();
            saveHistory();
          });
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeObj && !activeObj.isEditing) {
          e.preventDefault();
          removeSelectedObject();
        }
      }
    };
  };

  const attach = () => {
    setupWheelHandler();
    setupScrollHandler();
    setupKeydownHandler();

    if (viewportRef.value) {
      viewportRef.value.addEventListener('wheel', _wheelHandler, { passive: false });
      viewportRef.value.addEventListener('scroll', _scrollHandler);
    }
    window.addEventListener('keydown', _keydownHandler);
  };

  const detach = () => {
    if (_keydownHandler) window.removeEventListener('keydown', _keydownHandler);
    if (viewportRef.value) {
      if (_wheelHandler) viewportRef.value.removeEventListener('wheel', _wheelHandler);
      if (_scrollHandler) viewportRef.value.removeEventListener('scroll', _scrollHandler);
    }
    _wheelHandler = null;
    _scrollHandler = null;
    _keydownHandler = null;
    clipboard = null;
  };

  return { attach, detach };
}
