import { ref, nextTick } from 'vue';
import { fabric } from 'fabric';
import { CANVAS_CONSTANTS } from '../constants/canvas';

/**
 * Manages page rendering, navigation, state serialization, and layout calculations.
 * Extracted from EditorView.vue to reduce God Component complexity.
 */
export function usePageManager(canvas, pages, currentPageIndex, zoomLevel, canvasBaseDimensions) {
  let isRendering = false;


  const getWorkspaceMaxWidth = () => {
    let globalMaxWidth = 0;
    (pages.value || []).forEach((p) => {
      const w = Number(p.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
      if (w > globalMaxWidth) globalMaxWidth = w;
    });
    return globalMaxWidth;
  };

  const getPageLeftOffset = (pWidth) => {
    return (getWorkspaceMaxWidth() - (Number(pWidth) || CANVAS_CONSTANTS.PAGE_WIDTH)) / 2;
  };

  const getPageTopOffset = (index) => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const p = pages.value[i] || {};
      offset += (Number(p.height) || CANVAS_CONSTANTS.PAGE_HEIGHT) + CANVAS_CONSTANTS.PAGE_GAP;
    }
    return offset;
  };

  const getPageIndexFromTop = (y) => {
    let offset = 0;
    for (let i = 0; i < pages.value.length; i++) {
      const p = pages.value[i] || {};
      const h = Number(p.height) || CANVAS_CONSTANTS.PAGE_HEIGHT;
      if (y >= offset && y < offset + h + CANVAS_CONSTANTS.PAGE_GAP) return i;
      offset += h + CANVAS_CONSTANTS.PAGE_GAP;
    }
    return Math.max(0, pages.value.length - 1);
  };


  const forceUnlockObject = (obj) => {
    if (!obj) return;
    const isText = ['i-text', 'textbox', 'text'].includes(obj.type);
    const isImage = obj.type === 'image';

    obj.set({
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      padding: 5,
      lockMovementX: false,
      lockMovementY: false,
      lockRotation: false,
      lockScalingX: false,
      lockScalingY: false,
      lockUniScaling: false
    });

    obj.setControlsVisibility({
      mt: isImage, mb: isImage,
      ml: true, mr: true,
      tl: true, tr: true,
      bl: true, br: true,
      mtr: true
    });

    if (isText) obj.set('editable', true);
    obj.setCoords();
  };

  const cleanupCanvasObjects = () => {
    if (!canvas.value) return;
    const objects = canvas.value.getObjects();
    objects.forEach((obj) => {
      try {
        if (obj.clipPath) {
          if (typeof obj.clipPath.dispose === 'function') obj.clipPath.dispose();
          obj.clipPath = null;
        }
        if (typeof obj.off === 'function') obj.off();
        if (typeof obj.dispose === 'function') obj.dispose();
      } catch (e) {
        console.warn('Error cleaning up object:', e);
      }
    });
  };


  const renderAllPages = async (options = { infraOnly: false }, deps = {}) => {
    if (!canvas.value) return;
    if (isRendering) return;

    const { setHistoryLock, cleanFabricObject, updateObjectClipPath } = deps;

    isRendering = true;
    if (setHistoryLock) setHistoryLock(true);

    try {
      if (!options.infraOnly) {
        cleanupCanvasObjects();
        canvas.value.discardActiveObject();
        canvas.value.clear();
        canvas.value.setBackgroundColor(null, () => { });
      }

      if (!pages.value || !Array.isArray(pages.value) || pages.value.length === 0) {
        pages.value = [{ id: 0, background: null, objects: [] }];
      }

      const currentPages = pages.value;
      const actualZoom = zoomLevel.value || 1;
      let currentY = 0;
      let maxWidth = 0;

      for (const p of currentPages) {
        const w = Number(p.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
        if (w > maxWidth) maxWidth = w;
      }

      const objects = canvas.value.getObjects();
      const oldBgs = objects.filter(
        (o) => o.id === 'page-bg' || o.id === 'page-bg-image' || o.id === 'page-divider'
      );
      oldBgs.forEach((bg) => canvas.value.remove(bg));

      for (let i = 0; i < currentPages.length; i++) {
        const page = currentPages[i];
        const pWidth = Number(page.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
        const pHeight = Number(page.height) || CANVAS_CONSTANTS.PAGE_HEIGHT;
        const offsetTop = currentY;
        const offsetLeft = getPageLeftOffset(pWidth);

        const bgRect = new fabric.Rect({
          id: 'page-bg', left: offsetLeft, top: offsetTop,
          width: pWidth, height: pHeight, fill: '#ffffff',
          selectable: false, evented: false, excludeFromExport: true
        });
        canvas.value.add(bgRect);
        canvas.value.sendToBack(bgRect);

        if (page.dataUrl || page.background) {
          const urlToLoad = page.dataUrl || page.background;
          await new Promise((resolve) => {
            fabric.Image.fromURL(urlToLoad, (img) => {
              img.set({
                id: 'page-bg-image', left: offsetLeft, top: offsetTop,
                scaleX: pWidth / img.width, scaleY: pHeight / img.height,
                selectable: false, evented: false
              });
              canvas.value.add(img);
              canvas.value.moveTo(img, 1);
              resolve();
            }, { crossOrigin: 'anonymous' });
          });
        }

        if (!options.infraOnly && page.objects && page.objects.length > 0) {
          await new Promise((resolve) => {
            const rawObjects = JSON.parse(JSON.stringify(page.objects));
            const objectsToLoad = rawObjects.map((obj) =>
              cleanFabricObject ? cleanFabricObject(obj) : obj
            );

            fabric.util.enlivenObjects(objectsToLoad, (objs) => {
              const imageReloadPromises = [];

              objs.forEach((obj) => {
                if (obj.id === 'page-bg' || obj.id === 'page-bg-image') return;
                obj.set({ top: obj.top + offsetTop, left: obj.left + offsetLeft, _pageIndex: i });

                obj.clipPath = new fabric.Rect({
                  left: offsetLeft, top: offsetTop,
                  width: pWidth, height: pHeight,
                  fill: 'transparent', stroke: null, absolutePositioned: true
                });

                if (['text', 'i-text', 'textbox'].includes(obj.type)) obj.set('objectCaching', true);
                canvas.value.add(obj);
                forceUnlockObject(obj);

                if (obj.type === 'image' && obj.getSrc && obj.getSrc().startsWith('http')) {
                  const src = obj.getSrc();
                  const p = new Promise((imgResolve) => {
                    fabric.Image.fromURL(src, (freshImg) => {
                      if (freshImg._element) {
                        obj.setElement(freshImg._element);
                        obj.dirty = true;
                      }
                      imgResolve();
                    }, { crossOrigin: 'anonymous' });
                  });
                  imageReloadPromises.push(p);
                }
              });

              Promise.all(imageReloadPromises).then(() => {
                if (canvas.value) canvas.value.requestRenderAll();
                resolve();
              });
            });
          });
        }

        currentY += pHeight + CANVAS_CONSTANTS.PAGE_GAP;
      }

      if (options.infraOnly && updateObjectClipPath) {
        canvas.value.getObjects()
          .filter((o) => o.id !== 'page-bg' && o.id !== 'page-bg-image')
          .forEach((obj) => updateObjectClipPath(obj));
      }

      canvas.value.setWidth(maxWidth * actualZoom);
      canvas.value.setHeight(currentY * actualZoom);
      canvasBaseDimensions.value = { width: maxWidth, height: currentY };
      canvas.value.setZoom(actualZoom);
      canvas.value.requestRenderAll();

      document.fonts.ready.then(() => {
        if (canvas.value) canvas.value.requestRenderAll();
      });
    } finally {
      isRendering = false;
      if (setHistoryLock) setHistoryLock(false);
    }
  };


  let isSavingState = false;

  const saveCurrentPageState = () => {
    if (!canvas.value || isSavingState || !pages.value || pages.value.length === 0) return;
    isSavingState = true;
    try {
      if (canvas.value.getActiveObject()?.type === 'activeSelection') {
        canvas.value.discardActiveObject();
      }

      const allObjects = canvas.value.getObjects();
      const GAP = CANVAS_CONSTANTS.PAGE_GAP;
      const pageObjectMap = pages.value.map(() => []);

      const pageBounds = [];
      let currentY = 0;
      for (let i = 0; i < pages.value.length; i++) {
        const pHeight = Number(pages.value[i].height) || CANVAS_CONSTANTS.PAGE_HEIGHT;
        pageBounds.push({ top: currentY, bottom: currentY + pHeight + GAP });
        currentY += pHeight + GAP;
      }

      allObjects.forEach((obj) => {
        if (!obj || obj.id === 'page-bg' || obj.id === 'page-bg-image') return;
        if (typeof obj.top !== 'number' || isNaN(obj.top)) return;

        const center = obj.getCenterPoint();
        let pageIndex = 0;
        for (let i = 0; i < pageBounds.length; i++) {
          if (center.y >= pageBounds[i].top && center.y < pageBounds[i].bottom) {
            pageIndex = i;
            break;
          }
          if (i === pageBounds.length - 1 && center.y >= pageBounds[i].bottom) {
            pageIndex = i;
          }
        }

        pageIndex = Math.max(0, Math.min(pageIndex, pages.value.length - 1));
        if (!pageBounds[pageIndex]) return;

        try {
          const serialized = obj.toObject(['id', 'selectable', 'name', 'data', 'textBaseline', 'angle']);
          const pageTopY = pageBounds[pageIndex].top;
          const targetPageWidth = Number(pages.value[pageIndex]?.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
          const pageOffsetLeft = (getWorkspaceMaxWidth() - targetPageWidth) / 2;

          serialized.left = Math.round((obj.left - pageOffsetLeft) * 100) / 100;
          serialized.top = Math.round((obj.top - pageTopY) * 100) / 100;
          serialized.width = Math.round((obj.width || 0) * 100) / 100;
          serialized.height = Math.round((obj.height || 0) * 100) / 100;
          if (serialized.textBaseline === 'alphabetical') serialized.textBaseline = 'alphabetic';
          pageObjectMap[pageIndex].push(serialized);
        } catch (e) {
          console.error('Failed to serialize object:', e);
        }
      });

      pages.value.forEach((p, i) => {
        if (p) p.objects = pageObjectMap[i];
      });
    } finally {
      isSavingState = false;
    }
  };


  const scrollToPage = (viewportRef, index) => {
    if (!viewportRef?.value) return;
    viewportRef.value.scrollTo({
      top: getPageTopOffset(index) * zoomLevel.value,
      behavior: 'smooth'
    });
    currentPageIndex.value = index;
  };

  const loadPageToCanvas = async (index, deps = {}) => {
    if (typeof index === 'number' && index >= 0) currentPageIndex.value = index;
    await renderAllPages({}, deps);
  };

  const deletePage = async (index, deps = {}) => {
    if (!confirm(`Delete page ${index + 1}?`)) return;
    pages.value.splice(index, 1);
    pages.value.forEach((page, idx) => (page.id = idx));
    if (currentPageIndex.value >= pages.value.length)
      currentPageIndex.value = Math.max(0, pages.value.length - 1);
    await nextTick();
    await renderAllPages({}, deps);
    if (deps.saveHistory) deps.saveHistory();
  };

  const handlePageDrop = async ({ sourceIndex, targetIndex, position }, deps = {}) => {
    let insertionIndex = position === 'bottom' ? targetIndex + 1 : targetIndex;
    const [movedPage] = pages.value.splice(sourceIndex, 1);
    if (sourceIndex < insertionIndex) insertionIndex--;
    pages.value.splice(insertionIndex, 0, movedPage);
    pages.value.forEach((page, idx) => (page.id = idx));
    await nextTick();
    await renderAllPages({}, deps);
    if (deps.saveHistory) deps.saveHistory();
  };

  return {
    getWorkspaceMaxWidth,
    getPageLeftOffset,
    getPageTopOffset,
    getPageIndexFromTop,
    forceUnlockObject,
    cleanupCanvasObjects,
    renderAllPages,
    saveCurrentPageState,
    scrollToPage,
    loadPageToCanvas,
    deletePage,
    handlePageDrop
  };
}
