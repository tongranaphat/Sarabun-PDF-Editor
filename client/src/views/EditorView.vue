<template>
  <div class="app-layout">
    <TopNavbar :zoom-level="zoomLevel" :is-generating="isGenerating" :pdf-quality="pdfQuality" @go-home="goHome"
      @undo="undo" @redo="redo" @zoom-in="zoomIn" @zoom-out="zoomOut" @save-report="handleSaveProject"
      @generate-pdf="handleExport" @reset-project="handleReset" @update:pdfQuality="pdfQuality = $event" />

    <Sidebar :isOpen="isSidebarOpen" :isCanvasReady="isCanvasReady" :pages="pages" :currentPageIndex="currentPageIndex"
      :pdfId="currentPdfId" @toggle="toggleSidebar" @open="isSidebarOpen = true" @close="isSidebarOpen = false"
      @reset-canvas="goHome" @import-workspace="handleImportWorkspaceWrapper" @delete-page="handleDeletePage"
      @page-click="handleScrollToPage" @page-drop="handlePageDropWrapper" @add-signature-block="handleAddSignatureBlock"
      @add-custom-variable="() => { }" @refresh-stamp="handleRefreshStamp" />

    <main class="viewport" :class="{ 'full-width': !isSidebarOpen }" ref="viewportRef">
      <div class="scroll-center-helper">
        <div class="canvas-scaler" :style="{ opacity: isDocumentLoading ? 0 : 1, transition: 'opacity 0.2s ease' }"
          @drop="onDrop" @dragover.prevent>
          <div class="canvas-transform-layer">
            <div class="paper-shadow">
              <canvas id="c" :width="PAGE_WIDTH_CONST" :height="PAGE_HEIGHT_CONST"></canvas>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div v-if="canvas" class="floating-panel-anchor" :class="{ 'sidebar-closed': !isSidebarOpen }">
      <PropertiesPanel :canvas="canvas" />
    </div>

    <ExportOverlay :visible="exportOverlay.visible" :title="exportOverlay.title" :current="exportOverlay.current"
      :total="exportOverlay.total" :stage="exportOverlay.stage" />

    <SignatureModal :is-visible="signatureModal.visible" :sig-data="signatureModal.data"
      @confirm="handleSignatureConfirm" @cancel="handleSignatureCancel" />

    <FileNameModal :is-visible="fileNameModal.visible" :default-name="fileNameModal.defaultName"
      @confirm="handleFileNameConfirm" @cancel="handleFileNameCancel" />
  </div>
</template>


<script setup>
import { onMounted, ref, watch, nextTick, onUnmounted, computed } from 'vue';
import { fabric } from 'fabric';
import TopNavbar from '../components/TopNavbar.vue';
import PropertiesPanel from '../components/PropertiesPanel.vue';
import Sidebar from '../components/Sidebar.vue';
import ExportOverlay from '../components/ExportOverlay.vue';
import SignatureModal from '../components/SignatureModal.vue';
import FileNameModal from '../components/FileNameModal.vue';

import { useCanvas } from '../composables/useCanvas';
import { useDocument } from '../composables/useDocument';
import { useCanvasEvents } from '../composables/useCanvasEvents';
import { useEditablePdf } from '../composables/useEditablePdf';
import { usePageManager } from '../composables/usePageManager';
import { useExportPdf } from '../composables/useExportPdf';
import { useStampAutoAdd } from '../composables/useStampAutoAdd';
import { useRouteHandler } from '../composables/useRouteHandler';
import { useEditorStore } from '../stores/editorStore';
import { CANVAS_CONSTANTS } from '../constants/canvas';
import { showNotification } from '../utils/notifications';
import { yieldToMain } from '../utils/yieldToMain';
import apiService from '../services/apiService';

const currentPdfId = computed(() => {
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 1];
});

const canvasBaseDimensions = ref({ width: CANVAS_CONSTANTS.PAGE_WIDTH, height: CANVAS_CONSTANTS.PAGE_HEIGHT });
const isGenerating = ref(false);
const pdfQuality = ref(2);
const isCanvasReady = ref(false);
const isDocumentLoading = ref(true);
const PAGE_WIDTH_CONST = CANVAS_CONSTANTS.PAGE_WIDTH;
const PAGE_HEIGHT_CONST = CANVAS_CONSTANTS.PAGE_HEIGHT;

const exportOverlay = ref({ visible: false, title: '', current: 0, total: 1, stage: '' });
const showExportOverlay = (title, total = 1) => {
  exportOverlay.value = { visible: true, title, current: 0, total, stage: '' };
};
const updateExportProgress = (current, stage = '') => {
  exportOverlay.value.current = current;
  if (stage) exportOverlay.value.stage = stage;
};
const hideExportOverlay = () => { exportOverlay.value.visible = false; };

const signatureModal = ref({ visible: false, data: null });
const fileNameModal = ref({ visible: false, defaultName: '' });
let fileNameResolver = null;

const promptFileName = (defaultName) => {
  fileNameModal.value = { visible: true, defaultName };
  return new Promise((resolve) => { fileNameResolver = resolve; });
};
const handleFileNameConfirm = (name) => { fileNameModal.value.visible = false; if (fileNameResolver) fileNameResolver(name); };
const handleFileNameCancel = () => { fileNameModal.value.visible = false; if (fileNameResolver) fileNameResolver(null); };

const toggleSidebar = () => { isSidebarOpen.value = !isSidebarOpen.value; };

const {
  canvas, zoomLevel, viewportRef, initCanvas,
  zoomIn, zoomOut, fitToScreen, removeSelectedObject,
  setHistoryLock, saveHistory, resetHistory, undo, redo,
  addSignatureBlockToCanvas, addStampBlockToCanvas,
  setHistoryContext, isRemoteUpdating, updateCanvasDimensions,
  relinkSignatures, setCallbacks: setCanvasCallbacks, dispose: disposeCanvas
} = useCanvas();

const canvasHelpers = { resetHistory, saveHistory, setHistoryLock, addStampBlockToCanvas };

const {
  documentTitle, currentDocumentId, currentReportId,
  pages, currentPageIndex, isSidebarOpen, isPagesSidebarOpen,
  currentFileHandle, saveReport, resetCanvas, getDefaultPageImage,
  cleanFabricObject, preparePagesForSave, sanitizePagesData,
  handleUnifiedImport, processPdfToImages, saveFileWithFallback,
  setDocumentCallbacks, autoFitZoom
} = useDocument(canvas, zoomLevel, canvasHelpers);

if (setHistoryContext) setHistoryContext(pages, currentPageIndex);

const { initCanvasEvents, updateObjectClipPath } = useCanvasEvents(canvas, pages, currentPageIndex, saveHistory);
const { generateHybridPdfBlob, captureCanvasPageSafe } = useEditablePdf();

const pageManager = usePageManager(canvas, pages, currentPageIndex, zoomLevel, canvasBaseDimensions);
const { captureAllPages, buildExportProjectData, fetchVariableMap, restoreCanvasAfterCapture } = useExportPdf();
const { autoAddStamp, hasStampInState } = useStampAutoAdd();

const editorStore = useEditorStore();

const renderDeps = () => ({
  setHistoryLock,
  cleanFabricObject,
  updateObjectClipPath,
  saveHistory
});

const renderAllPages = async (options = {}) => {
  await pageManager.renderAllPages(options, renderDeps());
};

const { saveCurrentPageState, getPageTopOffset, getPageLeftOffset, getPageIndexFromTop, getWorkspaceMaxWidth, forceUnlockObject } = pageManager;

const resetCanvasWrapper = async () => {
  isDocumentLoading.value = true;
  await resetCanvas();
  zoomLevel.value = 1;
  await nextTick();
  await renderAllPages();
  saveHistory();
  isDocumentLoading.value = false;
};

const handleRefreshStamp = async () => {
  if (!currentPdfId.value || !canvas.value) return;
  await autoAddStamp(
    currentPdfId.value, addStampBlockToCanvas,
    saveCurrentPageState, preparePagesForSave,
    { refreshExisting: true, canvasRef: canvas }
  );
  setTimeout(() => handleSaveProject(true), 500);
};

const routeHandler = useRouteHandler({
  pages, currentPageIndex, currentReportId, currentDocumentId,
  documentTitle, isDocumentLoading, canvas,
  addStampBlockToCanvas, resetCanvasWrapper, resetCanvas,
  processPdfToImages, renderAllPages, autoFitZoom,
  sanitizePagesData, resetHistory, handleRefreshStamp,
  autoAddStamp, hasStampInState, saveCurrentPageState, preparePagesForSave
});

const triggerTempCleanup = () => {
  const idToClean = routeHandler.getActivePdfId() || (currentPdfId.value !== 'pdf' ? currentPdfId.value : null);
  if (idToClean && idToClean !== 'pdf') {
    const cleanupUrl = `${apiService.getBackendBase()}/api/pdf/cleanup-temp/${idToClean}`;
    if (navigator.sendBeacon) navigator.sendBeacon(cleanupUrl);
    else fetch(cleanupUrl, { method: 'POST', keepalive: true }).catch(() => { });
  }
};

watch(zoomLevel, async (newZoom, oldZoom) => {
  if (canvas.value && canvasBaseDimensions.value && viewportRef.value) {
    const viewport = viewportRef.value;
    const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / oldZoom;
    const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / oldZoom;
    canvas.value.setDimensions({
      width: canvasBaseDimensions.value.width * newZoom,
      height: canvasBaseDimensions.value.height * newZoom
    });
    canvas.value.setZoom(newZoom);
    canvas.value.requestRenderAll();
    await nextTick();
    viewport.scrollLeft = centerX * newZoom - viewport.clientWidth / 2;
    viewport.scrollTop = centerY * newZoom - viewport.clientHeight / 2;
  }
});

const goHome = () => {
  triggerTempCleanup();
  if (typeof window !== 'undefined' && window.history) window.history.pushState({}, '', '/');
  resetCanvasWrapper();
};

const handleReset = async () => {
  const fileIdToReset = window.location.pathname.split('/').pop();
  if (!fileIdToReset || fileIdToReset === 'pdf') {
    showNotification('ไม่พบ ID สำหรับการรีเซ็ต', 'error');
    return;
  }
  if (confirm('ข้อมูลทั้งหมดที่เคยแก้ไขจะหายไปทั้งหมด แน่ใจหรือไม่?')) {
    try {
      showNotification('กำลังรีเซ็ตข้อมูล...', 'info');
      await apiService.resetToOriginal(fileIdToReset);
      alert('รีเซ็ตสำเร็จ! ระบบกำลังโหลดไฟล์ต้นฉบับใหม่...');
      window.location.reload();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล';
      alert(errorMsg);
      showNotification('รีเซ็ตไม่สำเร็จ', 'error');
    }
  }
};

const handleImportWorkspaceWrapper = async () => {
  isDocumentLoading.value = true;
  await handleUnifiedImport();
  await nextTick();
  await renderAllPages();
  saveHistory();
  isDocumentLoading.value = false;
};

const handleAddSignatureBlock = (sigData) => { signatureModal.value = { visible: true, data: sigData }; };

const handleSignatureConfirm = (customText) => {
  if (!canvas.value || !signatureModal.value.data) return;
  const targetTop = getPageTopOffset(currentPageIndex.value) + 100;
  const targetLeft = getWorkspaceMaxWidth() / 2;
  addSignatureBlockToCanvas(signatureModal.value.data, targetLeft, targetTop, customText);
  signatureModal.value = { visible: false, data: null };
};

const handleSignatureCancel = () => { signatureModal.value = { visible: false, data: null }; };

const handleSaveProject = async (isSilent = false) => {
  if (!canvas.value) return;
  const pathSegments = window.location.pathname.split('/');
  const fileIdToSave = pathSegments[pathSegments.length - 1];
  if (!fileIdToSave || fileIdToSave === 'undefined' || fileIdToSave === 'pdf') {
    if (!isSilent) showNotification('ไม่พบ ID ของไฟล์ในระบบ', 'error');
    return;
  }

  try {
    if (!isSilent) { showExportOverlay('กำลังบันทึกไฟล์...', pages.value.length + 2); updateExportProgress(0, 'กำลังเตรียมข้อมูล...'); }
    saveCurrentPageState();

    const pagesData = preparePagesForSave();
    const projectData = { name: documentTitle.value || 'โปรเจกต์ไม่มีชื่อ', pages: pagesData, version: '1.0', timestamp: new Date().toISOString(), type: 'hybrid-project' };
    const variableMap = await fetchVariableMap();
    const qualityMultiplier = Number(pdfQuality.value) || 2;
    const originalPage = currentPageIndex.value;

    try {
      canvas.value.requestRenderAll();
      await renderAllPages();
      await nextTick();
      await nextTick();

      const canvasImages = await captureAllPages(
        canvas.value, pages.value, captureCanvasPageSafe,
        getPageTopOffset, getPageLeftOffset, getPageIndexFromTop,
        qualityMultiplier, isSilent ? null : updateExportProgress
      );

      if (canvasImages.length === 0) throw new Error('ไม่สามารถประมวลผลหน้ากระดาษได้');

      const exportProjectData = buildExportProjectData(projectData, canvas.value, getPageTopOffset);

      if (!isSilent) updateExportProgress(pages.value.length + 1, 'กำลังสร้าง PDF...');
      await yieldToMain();

      const pdfBlob = await generateHybridPdfBlob(canvasImages, exportProjectData, variableMap, null, 'report', 'flatten');

      if (!isSilent) updateExportProgress(pages.value.length + 2, 'กำลังบันทึกไปยังเซิร์ฟเวอร์...');
      await yieldToMain();

      const formData = new FormData();
      formData.append('OriginalFileId', fileIdToSave);
      formData.append('editState', JSON.stringify(pages.value));
      formData.append('pdfFile', pdfBlob, `edited_${fileIdToSave}.pdf`);
      await apiService.savePdfState(formData);

      if (!isSilent) showNotification('บันทึกไฟล์เรียบร้อย!', 'success');
      saveHistory();
    } finally {
      restoreCanvasAfterCapture(canvas.value);
      pageManager.loadPageToCanvas(originalPage, renderDeps());
    }
  } catch (e) {
    console.error('Save Project failed:', e);
    if (!isSilent) showNotification('เกิดข้อผิดพลาดในการบันทึกไฟล์: ' + e.message, 'error');
  } finally {
    if (!isSilent) hideExportOverlay();
  }
};

const handleExport = async () => {
  if (!canvas.value) return;
  try {
    saveCurrentPageState();
    const pagesData = preparePagesForSave();
    const projectData = { name: documentTitle.value || 'โปรเจกต์ไม่มีชื่อ', pages: pagesData, version: '1.0', timestamp: new Date().toISOString(), type: 'hybrid-project' };
    const variableMap = await fetchVariableMap();
    const qualityMultiplier = Number(pdfQuality.value) || 2;
    const originalPage = currentPageIndex.value;

    try {
      showExportOverlay('กำลังส่งออก PDF...', pages.value.length + 2);
      updateExportProgress(0, 'กำลังเตรียมข้อมูล...');
      canvas.value.requestRenderAll();
      await renderAllPages();
      await nextTick();

      const canvasImages = await captureAllPages(
        canvas.value, pages.value, captureCanvasPageSafe,
        getPageTopOffset, getPageLeftOffset, getPageIndexFromTop,
        qualityMultiplier, updateExportProgress
      );

      if (canvasImages.length === 0) throw new Error('ไม่สามารถประมวลผลหน้ากระดาษได้');

      const exportProjectData = buildExportProjectData(projectData, canvas.value, getPageTopOffset);
      updateExportProgress(pages.value.length + 1, 'กำลังสร้าง PDF...');
      await yieldToMain();

      const pdfBlob = await generateHybridPdfBlob(canvasImages, exportProjectData, variableMap, null, 'report', 'flatten');
      hideExportOverlay();
      updateExportProgress(pages.value.length + 2, 'กำลังบันทึกไฟล์...');
      await yieldToMain();

      let finalFileName = documentTitle.value || 'report';
      if (!window.showSaveFilePicker) {
        const chosenName = await promptFileName(finalFileName);
        if (chosenName === null) return;
        finalFileName = chosenName;
      }

      const saveResult = await saveFileWithFallback(pdfBlob, `${finalFileName}.pdf`);
      if (!saveResult.success) {
        if (saveResult.aborted) return;
        throw new Error('Save failed');
      }
      if (saveResult.handle) currentFileHandle.value = saveResult.handle;
      showNotification('ส่งออก PDF สำเร็จ!', 'success');
      saveHistory();
    } finally {
      restoreCanvasAfterCapture(canvas.value);
      pageManager.loadPageToCanvas(originalPage, renderDeps());
    }
  } catch (e) {
    console.error('Export failed:', e);
    showNotification('Export failed: ' + e.message, 'error');
  } finally {
    hideExportOverlay();
  }
};

const handleScrollToPage = (index) => pageManager.scrollToPage(viewportRef, index);
const handleDeletePage = (index) => pageManager.deletePage(index, renderDeps());
const handlePageDropWrapper = (payload) => pageManager.handlePageDrop(payload, renderDeps());

const addCustomTextToCanvas = (x, y) => {
  if (!canvas.value) return;
  if (x === undefined) x = (pages.value[currentPageIndex.value]?.width || CANVAS_CONSTANTS.PAGE_WIDTH) / 2;
  if (y === undefined) {
    let accTop = 0;
    for (let i = 0; i < currentPageIndex.value; i++)
      accTop += (pages.value[i].height || CANVAS_CONSTANTS.PAGE_HEIGHT) + CANVAS_CONSTANTS.PAGE_GAP;
    y = accTop + 100;
  }
  const text = new fabric.Textbox('พิมพ์ข้อความที่นี่...', {
    id: 'custom_text_' + Date.now(), left: x, top: y, width: 200,
    fontFamily: 'Sarabun', fontSize: 16, fill: '#000000', editable: true,
    padding: 5, textAlign: 'left', splitByGrapheme: true, objectCaching: false
  });
  forceUnlockObject(text);
  canvas.value.add(text);
  canvas.value.setActiveObject(text);
  canvas.value.requestRenderAll();
  saveCurrentPageState();
};

window.addCustomTextToCanvas = addCustomTextToCanvas;

const onDrop = (e) => {
  e.preventDefault();
  let x = 0, y = 0;
  if (canvas.value && typeof canvas.value.getPointer === 'function') {
    const pointer = canvas.value.getPointer(e);
    x = pointer.x; y = pointer.y;
  } else {
    const canvasContainer = document.querySelector('.canvas-container');
    const rect = canvasContainer ? canvasContainer.getBoundingClientRect() : (e.currentTarget?.getBoundingClientRect() || { left: 0, top: 0 });
    x = (e.clientX - rect.left) / (zoomLevel.value || 1);
    y = (e.clientY - rect.top) / (zoomLevel.value || 1);
  }
  const customText = e.dataTransfer.getData('customText');
  if (customText) addCustomTextToCanvas(x, y);
  const type = e.dataTransfer.getData('type');
  if (type === 'SIGNATURE_BLOCK') {
    const sigDataStr = e.dataTransfer.getData('sigData');
    if (sigDataStr) {
      try {
        addSignatureBlockToCanvas(JSON.parse(sigDataStr), x, y);
      } catch (error) { console.error('Drop parse error:', error); }
    }
  }
};

let _wheelHandler = null, _scrollHandler = null, _keydownHandler = null;

onMounted(async () => {
  await nextTick();
  initCanvas();
  isCanvasReady.value = true;
  initCanvasEvents();

  const routeHandled = await routeHandler.handleRouteChange();
  window.addEventListener('popstate', routeHandler.handleRouteChange);

  setCanvasCallbacks({ saveCurrentPageState, forceUnlockObject, renderAllPages });
  setDocumentCallbacks({ saveCurrentPageState, renderAllPages });

  if (!routeHandled) {
    if (!pages.value || pages.value.length === 0) pages.value = [{ id: 0, background: null, objects: [] }];
    renderAllPages();
  }
  isDocumentLoading.value = false;

  _wheelHandler = (e) => {
    if (e.ctrlKey) { e.preventDefault(); zoomLevel.value = Math.max(0.1, Math.min(3, zoomLevel.value + (e.deltaY > 0 ? -0.1 : 0.1))); }
  };
  _scrollHandler = () => {
    if (!viewportRef.value) return;
    const newIndex = getPageIndexFromTop(viewportRef.value.scrollTop / zoomLevel.value);
    if (newIndex !== currentPageIndex.value && newIndex >= 0 && newIndex < pages.value.length) currentPageIndex.value = newIndex;
  };
  if (viewportRef.value) {
    viewportRef.value.addEventListener('wheel', _wheelHandler, { passive: false });
    viewportRef.value.addEventListener('scroll', _scrollHandler);
  }

  let clipboard = null;
  _keydownHandler = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const activeObj = canvas.value?.getActiveObject();
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (ctrl && key === 'a') {
      if (activeObj?.isEditing) return;
      e.preventDefault();
      const objects = canvas.value.getObjects().filter((o) => o.id !== 'page-bg' && o.id !== 'page-bg-image' && o.selectable !== false);
      if (objects.length > 0) { canvas.value.discardActiveObject(); canvas.value.setActiveObject(new fabric.ActiveSelection(objects, { canvas: canvas.value })); canvas.value.requestRenderAll(); }
      return;
    }
    if (ctrl && key === 'z') { if (activeObj?.isEditing) return; e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctrl && key === 'y') { if (activeObj?.isEditing) return; e.preventDefault(); redo(); return; }
    if (ctrl && key === 'c') { if (activeObj && !activeObj.isEditing) { e.preventDefault(); activeObj.clone((c) => { clipboard = c; }); } return; }
    if (ctrl && key === 'v') {
      if (clipboard && canvas.value) {
        e.preventDefault();
        clipboard.clone((clonedObj) => {
          canvas.value.discardActiveObject();
          clonedObj.set({ left: clonedObj.left + 20, top: clonedObj.top + 20, evented: true, selectable: true });
          if (clonedObj.type === 'activeSelection') { clonedObj.canvas = canvas.value; clonedObj.forEachObject((o) => { o.id = 'obj_' + Date.now() + Math.random(); canvas.value.add(o); }); clonedObj.setCoords(); }
          else { clonedObj.id = 'obj_' + Date.now() + Math.random(); canvas.value.add(clonedObj); }
          clipboard.top += 20; clipboard.left += 20;
          canvas.value.setActiveObject(clonedObj); canvas.value.requestRenderAll(); saveHistory();
        });
      }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (activeObj && !activeObj.isEditing) { e.preventDefault(); removeSelectedObject(); }
    }
  };
  window.addEventListener('keydown', _keydownHandler);
  window.addEventListener('beforeunload', triggerTempCleanup);
  window.addEventListener('popstate', triggerTempCleanup);
});

onUnmounted(() => {
  window.removeEventListener('popstate', routeHandler.handleRouteChange);
  window.removeEventListener('beforeunload', triggerTempCleanup);
  if (_keydownHandler) window.removeEventListener('keydown', _keydownHandler);
  triggerTempCleanup();
  if (typeof disposeCanvas === 'function') disposeCanvas();
  if (viewportRef.value) {
    if (_wheelHandler) viewportRef.value.removeEventListener('wheel', _wheelHandler);
    if (_scrollHandler) viewportRef.value.removeEventListener('scroll', _scrollHandler);
  }
});
</script>

<style scoped>
.viewport {
  position: fixed;
  left: 392px;
  right: 0;
  top: 60px;
  bottom: 0;
  overflow: auto;
  background-color: #edeff0;
  display: flex;
  flex-direction: column;
  z-index: 10;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.viewport.full-width {
  left: 72px;
}

.floating-panel-anchor {
  position: fixed;
  top: 72px;
  left: 392px;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 50;
  pointer-events: none;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.floating-panel-anchor>* {
  pointer-events: auto;
}

.floating-panel-anchor.sidebar-closed {
  left: 72px;
}

.scroll-center-helper {
  min-width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: row;
  padding: 60px;
  box-sizing: border-box;
}

.canvas-scaler {
  margin: auto;
  position: relative;
  flex-shrink: 0;
}

.canvas-transform-layer {
  background-color: transparent;
  padding: 0;
  margin: 0;
  border-radius: 4px;
}

.paper-shadow {
  background: transparent;
  box-shadow: none;
  display: block;
}

.paper-shadow canvas {
  border-radius: 8px;
  display: block;
}
</style>
