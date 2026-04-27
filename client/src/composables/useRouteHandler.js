import { nextTick } from 'vue';
import apiService from '../services/apiService';

/**
 * Handles URL-based routing for importing and loading PDFs.
 * Extracted from EditorView.vue's 450+ line handleRouteChange function.
 */
export function useRouteHandler(deps) {
  const {
    pages,
    currentPageIndex,
    currentReportId,
    currentDocumentId,
    documentTitle,
    isDocumentLoading,
    canvas,
    addStampBlockToCanvas,
    resetCanvasWrapper,
    resetCanvas,
    processPdfToImages,
    renderAllPages,
    autoFitZoom,
    sanitizePagesData,
    resetHistory,
    handleRefreshStamp,
    autoAddStamp,
    hasStampInState,
    saveCurrentPageState,
    preparePagesForSave
  } = deps;

  let activePdfId = null;

  const getActivePdfId = () => activePdfId;

  /**
   * Load a workspace by file ID — handles both restored state and fresh PDF.
   */
  const loadWorkspace = async (fileId) => {
    activePdfId = fileId;
    const workspaceData = await apiService.prepareWorkspace(fileId);

    if (workspaceData.editState) {
      let parsedState = workspaceData.editState;
      while (typeof parsedState === 'string') parsedState = JSON.parse(parsedState);
      pages.value = parsedState;
      autoFitZoom();
      currentPageIndex.value = 0;
      await nextTick();

      const stampExists = hasStampInState(parsedState);

      await new Promise((r) =>
        setTimeout(async () => {
          if (typeof renderAllPages === 'function') await renderAllPages();
          if (stampExists) handleRefreshStamp();
          r();
        }, 500)
      );

      if (!stampExists) {
        await autoAddStamp(fileId, addStampBlockToCanvas, saveCurrentPageState, preparePagesForSave);
      }
    } else {
      const blobData = await apiService.downloadBlob(workspaceData.tempPath);
      const downloadedFile = new File([blobData], 'workspace_document.pdf', { type: 'application/pdf' });

      await resetCanvasWrapper();
      const images = await processPdfToImages(downloadedFile);
      if (images.length > 0) {
        pages.value = images.map((imgObj, idx) => ({
          id: Date.now() + idx,
          background: imgObj.dataUrl,
          width: imgObj.width,
          height: imgObj.height,
          objects: [],
          originalBackgroundType: 'PDF'
        }));
        autoFitZoom();
        currentPageIndex.value = 0;
        await renderAllPages();
        await autoAddStamp(fileId, addStampBlockToCanvas, saveCurrentPageState, preparePagesForSave);
      }
    }
  };

  /**
   * Handle direct URL import (e.g., /https://example.com/file.pdf)
   */
  const handleDirectUrlImport = async (fullHref) => {
    const directUrlMatch = fullHref.match(/\/(https?:\/\/.+)/i) || fullHref.match(/\/(https?:\/.+)/i);
    if (!directUrlMatch?.[1]) return false;

    let externalUrl = directUrlMatch[1];
    if (externalUrl.startsWith('https:/') && !externalUrl.startsWith('https://'))
      externalUrl = externalUrl.replace('https:/', 'https://');
    if (externalUrl.startsWith('http:/') && !externalUrl.startsWith('http://'))
      externalUrl = externalUrl.replace('http:/', 'http://');

    try {
      const data = await apiService.importPdfFromUrl(externalUrl);
      const newPdfId = data.OriginalFileId || data.id || data.fileId;
      if (newPdfId) {
        window.history.replaceState({}, '', `/pdf/${newPdfId}`);
        await loadWorkspace(newPdfId);
        return true;
      }
    } catch (error) {
      console.error('Direct URL Import Failed:', error);
      alert('ไม่สามารถดึงไฟล์จากลิงก์ที่ระบุได้ (นำเข้าไม่สำเร็จ)');
    }
    return false;
  };

  /**
   * Handle local file path import (e.g., /C:\path\to\file.pdf)
   */
  const handleLocalPathImport = async (decodedPath) => {
    const localPathMatch = decodedPath.match(/^\/(["']?[A-Za-z]:[\\\/].+)/);
    if (!localPathMatch?.[1]) return false;

    const localPath = localPathMatch[1];
    try {
      const data = await apiService.importPdfLocal(localPath);
      const newPdfId = data.OriginalFileId || data.id;
      if (newPdfId) {
        window.history.replaceState({}, '', `/pdf/${newPdfId}`);
        await loadWorkspace(newPdfId);
        return true;
      }
    } catch (error) {
      console.error('Local Import Failed:', error);
      alert('ไม่สามารถดึงไฟล์จากเครื่องได้ (ตรวจสอบว่าไฟล์มีอยู่จริง)');
    }
    return false;
  };

  /**
   * Handle filepath query param (e.g., /path/uploads/cache/file.pdf)
   */
  const handleFilePathParam = async (currentPath) => {
    const urlParams = new URLSearchParams(window.location.search);
    const openMatch = currentPath.match(/^\/path\/(.+)/i);
    let filepathParam = openMatch ? decodeURIComponent(openMatch[1]) : urlParams.get('filepath');
    if (!filepathParam) return false;

    filepathParam = '/' + filepathParam.replace(/^\/+/, '');
    try {
      const blobData = await apiService.downloadBlob(filepathParam);
      const originalUrlParam = urlParams.get('originalUrl');
      const filename = originalUrlParam || filepathParam.split('/').pop() || 'document.pdf';
      const downloadedFile = new File([blobData], filename, { type: 'application/pdf' });

      await resetCanvasWrapper();
      const images = await processPdfToImages(downloadedFile);
      if (images.length > 0) {
        pages.value = images.map((imgObj, idx) => ({
          id: Date.now() + idx,
          background: imgObj.dataUrl,
          width: imgObj.width,
          height: imgObj.height,
          objects: [],
          originalBackgroundType: 'PDF'
        }));
        autoFitZoom();
        currentPageIndex.value = 0;
        await renderAllPages();
      }
    } catch (error) {
      console.error('Failed to load PDF from filepath param:', error);
    }
    return true;
  };

  /**
   * Handle /pdf/:id route
   */
  const handlePdfIdRoute = async (currentPath) => {
    const pdfMatch = currentPath.match(/^\/pdf\/([a-zA-Z0-9-]+)/i);
    if (!pdfMatch?.[1]) return false;

    try {
      await loadWorkspace(pdfMatch[1]);
    } catch (error) {
      console.error('Failed to load PDF into workspace:', error);
      alert('Could not load the requested PDF.');
    }
    return true;
  };

  /**
   * Handle /history/:id route
   */
  const handleHistoryRoute = async (currentPath) => {
    const historyMatch = currentPath.match(/^\/history\/([a-zA-Z0-9-]+)/i);
    if (!historyMatch?.[1]) return false;

    try {
      const r = await apiService.getReportById(historyMatch[1]);
      if (r) {
        currentReportId.value = r.id;
        currentDocumentId.value = null;
        documentTitle.value = r.name;
        if (r.pages && Array.isArray(r.pages)) {
          pages.value = sanitizePagesData(JSON.parse(JSON.stringify(r.pages)));
          autoFitZoom();
          currentPageIndex.value = 0;
        }
        if (resetHistory) resetHistory();
        await nextTick();
        await renderAllPages();
      }
    } catch (error) {
      console.error('Failed to load history instance from URL:', error);
    }
    return true;
  };

  /**
   * Handle home route (/)
   */
  const handleHomeRoute = async (currentPath) => {
    if (currentPath !== '/' && currentPath !== '') return false;
    try {
      await resetCanvasWrapper();
    } catch (error) {
      console.error('Error resetting workspace on back navigation:', error);
    }
    return true;
  };

  /**
   * Main route change handler — dispatches to specific handlers.
   */
  const handleRouteChange = async () => {
    isDocumentLoading.value = true;
    try {
      const fullHref = window.location.href;
      if (await handleDirectUrlImport(fullHref)) return true;

      const decodedPath = decodeURIComponent(window.location.pathname);
      if (await handleLocalPathImport(decodedPath)) return true;

      const currentPath = window.location.pathname;
      if (await handleFilePathParam(currentPath)) return true;
      if (await handlePdfIdRoute(currentPath)) return true;
      if (await handleHistoryRoute(currentPath)) return true;
      if (await handleHomeRoute(currentPath)) return true;
    } finally {
      isDocumentLoading.value = false;
    }
  };

  return {
    handleRouteChange,
    getActivePdfId,
    loadWorkspace
  };
}
