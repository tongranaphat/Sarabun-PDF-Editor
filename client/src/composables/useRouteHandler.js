import { nextTick } from 'vue';
import apiService from '../services/apiService';
import { useEditorStore } from '../stores/editorStore';

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

  const editorStore = useEditorStore();

  let activePdfId = null;
  let activeSdcId = null;

  const getActivePdfId = () => activePdfId;
  const getActiveSdcId = () => activeSdcId;

  const loadWorkspace = async (fileId) => {
    activePdfId = fileId;
    const workspaceData = await apiService.prepareWorkspace(fileId);

    if (workspaceData.originalUrl) {
      const match = workspaceData.originalUrl.match(/[?&]sdcId=(\d+)/);
      if (match && match[1]) {
        activeSdcId = match[1];
        const sdcId = match[1];
        try {
          const docDetail = await apiService.getSarabanDocFileDetail(sdcId);
          if (docDetail && docDetail.transactions && Array.isArray(docDetail.transactions) && docDetail.transactions.length > 0) {
            const transactionsData = docDetail.transactions.map(t => ({
              fullName: t.created_by_name,
              prefixText: t.note
            }));
            await apiService.importSignatories(transactionsData, fileId);
            if (typeof deps.onSignatoriesImported === 'function') {
              deps.onSignatoriesImported(fileId);
            }
          }
        } catch (err) {
          console.error("Failed to re-fetch transactions for sdcId:", sdcId, err);
        }
      }
    }

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
          if (stampExists) handleRefreshStamp(fileId);
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

  const handlePdfIdRoute = async (currentPath) => {
    const pdfMatch = currentPath.match(/^\/pdf\/([a-zA-Z0-9-_]+)/i);
    if (!pdfMatch?.[1]) return false;

    try {
      await loadWorkspace(pdfMatch[1]);
    } catch (error) {
      console.error('Failed to load PDF into workspace:', error);
      alert('Could not load the requested PDF.');
    }
    return true;
  };

  const handleHistoryRoute = async (currentPath) => {
    const historyMatch = currentPath.match(/^\/history\/([a-zA-Z0-9-_]+)/i);
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

  const handleHomeRoute = async (currentPath) => {
    if (currentPath !== '/' && currentPath !== '') return false;
    try {
      await resetCanvasWrapper();
    } catch (error) {
      console.error('Error resetting workspace on back navigation:', error);
    }
    return true;
  };

  const handleSarabanDocRoute = async (currentPath) => {
    const sdcMatch = currentPath.match(/^\/(\d+)$/);
    if (!sdcMatch?.[1]) return false;

    try {
      const fileId = sdcMatch[1];
      activeSdcId = fileId;
      const docDetail = await apiService.getSarabanDocFileDetail(fileId);
      if (docDetail && docDetail.url) {
        const urlWithId = docDetail.url + (docDetail.url.includes('?') ? '&' : '?') + 'sdcId=' + fileId;
        const data = await apiService.importPdfFromUrl(urlWithId);
        const newPdfId = data.OriginalFileId || data.id || data.fileId;

        if (newPdfId) {
          window.history.replaceState({}, '', `/pdf/${newPdfId}`);
          await loadWorkspace(newPdfId);
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to load Saraban doc:', error);
      alert('ไม่สามารถโหลดข้อมูลไฟล์จากระบบได้');
    }
    return false;
  };

  const handleJwtTokenRoute = async (currentPath) => {
    const jwtMatch = currentPath.match(/^\/(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
    if (!jwtMatch?.[1]) return false;

    const token = jwtMatch[1];
    console.log('[JWT] Detected JWT token in URL, decoding...');

    try {
      const decoded = await apiService.decodeToken(token);
      console.log('[JWT] Token validated successfully');

      if (decoded.user_id || decoded.user_type) {
        sessionStorage.setItem('jwt_user_id', decoded.user_id ? String(decoded.user_id) : '');
        sessionStorage.setItem('jwt_user_type', decoded.user_type ? String(decoded.user_type) : '');
      }

      const docId = String(decoded.doc_attach_id);
      console.log('[JWT] Redirecting to clean URL via location.replace...');
      window.location.replace(`/${docId}`);
      return true;
    } catch (error) {
      console.error('[JWT] Failed to decode token:', error);
      alert('ไม่สามารถตรวจสอบสิทธิ์การเข้าถึงได้ (JWT ไม่ถูกต้อง)');
      return false;
    }
  };

  const handleRouteChange = async () => {
    const sessionUserId = sessionStorage.getItem('jwt_user_id');
    const sessionUserType = sessionStorage.getItem('jwt_user_type');
    if (sessionUserId || sessionUserType) {
      editorStore.setJwtUser(sessionUserId || null, sessionUserType || null);
    }

    isDocumentLoading.value = true;
    try {
      const fullHref = window.location.href;
      if (await handleDirectUrlImport(fullHref)) return true;

      const decodedPath = decodeURIComponent(window.location.pathname);
      if (await handleLocalPathImport(decodedPath)) return true;

      const currentPath = window.location.pathname;
      if (await handleJwtTokenRoute(currentPath)) return true;
      if (await handleSarabanDocRoute(currentPath)) return true;
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
    getActiveSdcId,
    loadWorkspace
  };
}
