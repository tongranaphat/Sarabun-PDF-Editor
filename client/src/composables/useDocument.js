import { ref, computed, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import * as pdfjsLib from 'pdfjs-dist';

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
import { fabric } from 'fabric';
import { useEditorStore } from '../stores/editorStore';
import { apiService } from '../services/apiService';
import { CANVAS_CONSTANTS } from '../constants/canvas';

export function useDocument(canvas, zoomLevel, canvasHelpers = {}) {
  const { resetHistory, saveHistory, setHistoryLock, addStampBlockToCanvas } = canvasHelpers;

  const _documentCallbacks = {
    saveCurrentPageState: null,
    renderAllPages: null
  };

  const setDocumentCallbacks = (cbs = {}) => {
    if (cbs.saveCurrentPageState)
      _documentCallbacks.saveCurrentPageState = cbs.saveCurrentPageState;
    if (cbs.renderAllPages) _documentCallbacks.renderAllPages = cbs.renderAllPages;
  };

  const editorStore = useEditorStore();
  const {
    pages,
    currentPageIndex,
    currentDocumentId,
    currentReportId,
    documentTitle,
    isSidebarOpen
  } = storeToRefs(editorStore);

  const isPagesSidebarOpen = ref(false);

  const cleanFabricObject = (obj) => {
    if (!obj) return obj;
    if (obj.textBaseline === 'alphabetical') obj.textBaseline = 'alphabetic';
    if (obj.styles && typeof obj.styles === 'object') {
      for (const lineKey in obj.styles) {
        const line = obj.styles[lineKey];
        for (const charKey in line) {
          const charStyle = line[charKey];
          if (charStyle && charStyle.textBaseline === 'alphabetical')
            charStyle.textBaseline = 'alphabetic';
        }
      }
    }
    if ((obj.type === 'group' || obj.type === 'activeSelection') && Array.isArray(obj.objects)) {
      obj.objects = obj.objects.map(cleanFabricObject);
    }
    obj.selectable = true;
    obj.evented = true;
    if (['textbox', 'text', 'i-text'].includes(obj.type)) {
      obj.editable = true;
    }
    return obj;
  };

  const sanitizePagesData = (rawPages) => {
    if (!Array.isArray(rawPages)) return [];
    return rawPages.map((page) => ({
      ...page,
      objects: (page.objects || []).map((obj) => cleanFabricObject(JSON.parse(JSON.stringify(obj))))
    }));
  };

  const preparePagesForSave = () => {
    return pages.value.map((page) => ({
      id: page.id,
      background: page.background,
      originalBackgroundType: page.originalBackgroundType,
      width: page.width,
      height: page.height,
      objects: page.objects.map((obj) => {
        const serialized = JSON.parse(JSON.stringify(obj));
        const clean = cleanFabricObject(serialized);
        clean.left = Math.round(clean.left * 100) / 100;
        clean.top = Math.round(clean.top * 100) / 100;
        clean.width = Math.round(clean.width * 100) / 100;
        clean.height = Math.round(clean.height * 100) / 100;
        return clean;
      })
    }));
  };

  const autoFitZoom = () => {
    if (!pages.value || pages.value.length === 0) return;
    let maxWidth = 0;
    for (let i = 0; i < pages.value.length; i++) {
      const w = Number(pages.value[i].width) || CANVAS_CONSTANTS.PAGE_WIDTH;
      if (w > maxWidth) maxWidth = w;
    }
    if (maxWidth > 0) {
      let newZoom = CANVAS_CONSTANTS.PAGE_WIDTH / maxWidth;
      if (newZoom < CANVAS_CONSTANTS.MIN_ZOOM) newZoom = CANVAS_CONSTANTS.MIN_ZOOM;
      if (newZoom > CANVAS_CONSTANTS.MAX_ZOOM) newZoom = CANVAS_CONSTANTS.MAX_ZOOM;
      zoomLevel.value = Number(newZoom.toFixed(2));
    }
  };

  const isWorkspaceEmpty = () => {
    if (!pages.value || pages.value.length === 0) return true;
    if (pages.value.length > 1) return false;
    const p = pages.value[0];
    return !p.background && (!p.objects || p.objects.length === 0);
  };

  const processPdfToImages = async (file) => {
    const images = [];
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewportForImage = page.getViewport({ scale: 2 });
        const origViewport = page.getViewport({ scale: 1 });
        const cvs = document.createElement('canvas');
        cvs.width = viewportForImage.width;
        cvs.height = viewportForImage.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: viewportForImage })
          .promise;
        images.push({
          dataUrl: cvs.toDataURL('image/jpeg', 0.8),
          width: origViewport.width,
          height: origViewport.height
        });
      }
    } catch (e) {
      console.error(e);
      throw new Error('Failed to process PDF');
    }
    return images;
  };

  const saveReport = async (isSilent = false) => {
    if (!canvas.value) return;
    if (typeof _documentCallbacks.saveCurrentPageState === 'function')
      _documentCallbacks.saveCurrentPageState();

    const pagesData = preparePagesForSave();
    const payload = {
      id: currentReportId.value,
      name: documentTitle.value || 'Untitled Project',
      pages: pagesData,
      pageDimensions: pages.value.map((p) => ({ width: p.width, height: p.height })),
      status: 'DRAFT'
    };

    try {
      const res = await apiService.saveReport(payload);
      currentReportId.value = res.id;
      if (!isSilent) alert('Project Saved Successfully');
    } catch (e) {
      alert('Save Project failed: ' + (e.response?.data?.error || e.message));
      throw e;
    }
  };

  const resetCanvas = async () => {
    if (!canvas.value) return;
    editorStore.resetState();
    canvas.value.clear();
    canvas.value.setBackgroundColor(null, null);
    if (resetHistory) resetHistory();
  };
  const togglePagesSidebar = () => {
    isPagesSidebarOpen.value = !isPagesSidebarOpen.value;
  };

  const getDefaultPageImage = (index) => {
    return `data:image/svg+xml;base64,${btoa('<svg width="79" height="112" xmlns="http://www.w3.org/2000/svg"><rect width="79" height="112" fill="white"/></svg>')}`;
  };

  const saveFileWithFallback = async (blob, defaultFileName) => {
    if (window.showSaveFilePicker) {
      try {
        const options = {
          suggestedName: defaultFileName,
          types: [
            {
              description: 'PDF File',
              accept: { 'application/pdf': ['.pdf'] }
            }
          ]
        };
        const fileHandle = await window.showSaveFilePicker(options);
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        return { success: true, handle: fileHandle };
      } catch (err) {
        if (err.name === 'AbortError') return { success: false, aborted: true };
        console.warn('File picker failed, falling back to classic download:', err);
      }
    }

    try {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = defaultFileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      return { success: true, handle: null };
    } catch (fallbackErr) {
      console.error('Classic download failed:', fallbackErr);
      return { success: false, aborted: false };
    }
  };

  const currentFileHandle = ref(null);


  const handleUnifiedImport = async () => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = async (evt) => {
        const file = evt.target.files[0];
        if (!file) return resolve(false);
        try {
          if (!isWorkspaceEmpty()) {
            if (!confirm('Replace current workspace?')) return resolve(false);
          }

          if (file.type === 'application/pdf') {
            const formData = new FormData();
            formData.append('file', file);
            try {
              const res = await apiService.uploadPdf(formData);
              const savedFileId = res.id;

              const workspaceData = await apiService.prepareWorkspace(savedFileId);

              await resetCanvas();

              if (workspaceData.editState) {
                let parsedState = workspaceData.editState;
                while (typeof parsedState === 'string') parsedState = JSON.parse(parsedState);
                pages.value = sanitizePagesData(parsedState);
                autoFitZoom();
              } else {
                const blobData = await apiService.downloadBlob(workspaceData.tempPath);
                const downloadedFile = new File([blobData], file.name, { type: 'application/pdf' });
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
                }
              }

              currentPageIndex.value = 0;
              documentTitle.value = file.name.replace(/\.pdf$/i, '');

              if (typeof window !== 'undefined' && window.history) {
                window.history.pushState({}, '', `/pdf/${savedFileId}`);
              }

              if (!workspaceData.editState) {
                try {
                  const stampMeta = await apiService.getStampMetadata(savedFileId);
                  await nextTick();
                  if (typeof _documentCallbacks.renderAllPages === 'function') {
                    await _documentCallbacks.renderAllPages();
                  }
                  if (addStampBlockToCanvas) {
                    addStampBlockToCanvas(stampMeta);
                    setTimeout(async () => {
                      try {
                        const pagesData = preparePagesForSave();
                        const formData = new FormData();
                        formData.append('OriginalFileId', savedFileId);
                        formData.append('editState', JSON.stringify(pagesData));
                        await apiService.savePdfState(formData);
                      } catch (err) {
                        console.error('Failed to auto-save stamp block', err);
                      }
                    }, 500);
                  }
                } catch (e) {
                  console.warn('Failed to add auto stamp', e);
                }
              }
            } catch (uploadError) {
              console.error('Upload failed:', uploadError);

              await resetCanvas();
              const images = await processPdfToImages(file);
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
              }
            }
            return resolve(true);
          }

          alert('รองรับเฉพาะไฟล์ PDF เท่านั้น');
          resolve(false);
        } catch (err) {
          console.error('Import Failed:', err);
          alert('Import Failed: ' + err.message);
          resolve(false);
        }
      };
      input.click();
    });
  };

  return {
    documentTitle,
    currentDocumentId,
    currentReportId,
    pages,
    currentPageIndex,
    isSidebarOpen,
    currentFileHandle,

    saveReport,
    resetCanvas,
    togglePagesSidebar,
    getDefaultPageImage,
    cleanFabricObject,
    preparePagesForSave,
    sanitizePagesData,
    isPagesSidebarOpen,
    handleUnifiedImport,
    processPdfToImages,
    saveFileWithFallback,
    setDocumentCallbacks,
    autoFitZoom
  };
}
