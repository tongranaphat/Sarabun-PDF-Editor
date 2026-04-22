import { ref, computed, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import * as pdfjsLib from 'pdfjs-dist';

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
import { fabric } from 'fabric';
import { useEditorStore } from '../stores/editorStore';
import { apiService } from '../services/apiService';
import { showNotification } from '../utils/notifications';
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
    variables,
    pages,
    currentPageIndex,
    currentDocumentId,
    currentReportId,
    documentTitle,
    isPreviewMode,
    isSidebarOpen,
    groupedVariables
  } = storeToRefs(editorStore);

  const customVarName = ref('');
  const currentBackground = ref(null);
  const originalObjectStates = ref({});
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

  const sanitizeDocumentTitle = (name) => {
    return (name || 'Untitled')
      .replace(/<[^>]*>/g, '')
      .trim()
      .substring(0, 50)
      .replace(/[^a-z0-9\u0E00-\u0E7F _-]/gi, '_');
  };

  const getMachineId = editorStore.getMachineId;

  const isWorkspaceEmpty = () => {
    if (!pages.value || pages.value.length === 0) return true;
    if (pages.value.length > 1) return false;
    const p = pages.value[0];
    return !p.background && (!p.objects || p.objects.length === 0);
  };

  const checkIsGeneratedPdf = async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiService.checkPdfType(formData);
      return {
        id: res.id,
        type: res.type,
        embeddedLayout: res.embeddedLayout
      };
    } catch (e) {
      console.warn('Server Check PDF skipped/failed. Trying Client-side...', e);
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const metadata = await pdf.getMetadata();

      if (metadata && metadata.info) {
        const subject = metadata.info.Subject;
        if (subject && subject.startsWith('layout:')) {
          const base64Str = subject.substring(7);
          try {
            const binaryString = atob(base64Str);
            let jsonStr;

            if (binaryString.charCodeAt(0) === 0xfe && binaryString.charCodeAt(1) === 0xff) {
              const buf = new Uint8Array(binaryString.length - 2);
              for (let i = 2; i < binaryString.length; i++) buf[i - 2] = binaryString.charCodeAt(i);
              jsonStr = new TextDecoder('utf-16be').decode(buf);
            } else {
              try {
                jsonStr = decodeURIComponent(escape(binaryString));
              } catch {
                jsonStr = binaryString;
              }
            }

            const layout = JSON.parse(jsonStr);
            return { embeddedLayout: layout };
          } catch (parseErr) {
            console.error('Failed to parse client-side layout:', parseErr);
          }
        }
      }
    } catch (clientErr) {
      console.error('Client-side PDF check failed:', clientErr);
    }

    return null;
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

  const fetchVariables = editorStore.fetchVariables;

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

  const loadReportById = async (id) => {
    try {
      const r = await apiService.getReportById(id);
      if (r) {
        currentReportId.value = r.id;
        currentDocumentId.value = null;
        documentTitle.value = r.name;
        if (r.pages && Array.isArray(r.pages)) {
          pages.value = sanitizePagesData(JSON.parse(JSON.stringify(r.pages)));
          currentPageIndex.value = 0;
        }
        if (resetHistory) resetHistory();
      }
    } catch (e) {
      throw e;
    }
  };

  const resetCanvas = async () => {
    if (!canvas.value) return;
    editorStore.resetState();
    originalObjectStates.value = {};
    canvas.value.clear();
    canvas.value.setBackgroundColor(null, null);
    if (resetHistory) resetHistory();
  };

  const togglePreview = (forceMode) => {
    isPreviewMode.value = forceMode !== undefined ? forceMode : !isPreviewMode.value;
    if (!canvas.value) return;
    canvas.value.discardActiveObject();
    canvas.value.requestRenderAll();
  };

  const addBlankPage = () => {
    if (pages.value.length > 0 && typeof _documentCallbacks.saveCurrentPageState === 'function') {
      _documentCallbacks.saveCurrentPageState();
    }
    editorStore.addBlankPage();
  };

  const handleImportWorkspace = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (!isWorkspaceEmpty()) {
      if (!confirm('The workspace is not empty. Replace it?')) return;
    }

    await resetCanvas();

    if (file.type === 'application/pdf') {
      const metadata = await checkIsGeneratedPdf(file);
      let loaded = false;

      if (metadata && metadata.id) {
        if (metadata.type === 'report') {
          try {
            await loadReportById(metadata.id);
            loaded = true;
          } catch (err) {
            console.error('Report not found on server');
          }
        }
      }

      if (!loaded && metadata && metadata.embeddedLayout) {
        try {
          pages.value = sanitizePagesData(metadata.embeddedLayout);
          currentPageIndex.value = 0;
          loaded = true;
        } catch (err) {
          console.error('Failed to load embedded layout', err);
        }
      }

      if (loaded) {
        if (resetHistory) resetHistory();
        return;
      }

      try {
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
          currentPageIndex.value = 0;
        }
      } catch (err) {
        alert('Failed to process PDF');
      }
    } else {
      alert('รองรับเฉพาะไฟล์ PDF เท่านั้น');
    }
    if (resetHistory) resetHistory();
  };

  const handleImportAppend = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (pages.value.length > 0 && typeof _documentCallbacks.saveCurrentPageState === 'function') {
      _documentCallbacks.saveCurrentPageState();
    }

    const insertIndex = currentPageIndex.value + 1;
    let newPages = [];

    if (file.type === 'application/pdf') {
      const images = await processPdfToImages(file);
      newPages = images.map((imgObj, idx) => ({
        id: Date.now() + Math.random() + idx,
        background: imgObj.dataUrl,
        width: imgObj.width,
        height: imgObj.height,
        objects: [],
        originalBackgroundType: 'PDF'
      }));
    } else {
      alert('รองรับเฉพาะไฟล์ PDF เท่านั้น');
    }

    if (newPages.length > 0) {
      pages.value.splice(insertIndex, 0, ...newPages);
      currentPageIndex.value = insertIndex;
    }
  };

  const addCustomVariable = () => {
    const name = prompt('Enter variable name (letters, numbers, underscores only):');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
      alert(
        `Invalid variable name "${trimmed}". Use letters, numbers, and underscores only. Must start with a letter or underscore.`
      );
      return;
    }
    const alreadyExists = variables.value.some((v) => v.key === trimmed);
    if (alreadyExists) {
      alert(`Variable "${trimmed}" already exists.`);
      return;
    }
    variables.value.push({ category: 'Custom', label: trimmed, key: trimmed });
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

  const getFullProjectData = () => {
    return {
      name: documentTitle.value || 'Untitled Project',
      pages: preparePagesForSave(),
      version: '1.0',
      timestamp: new Date().toISOString(),
      type: 'hybrid-project'
    };
  };

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

              const backendUrl = apiService.getBackendBase();
              const workspaceData = await apiService.prepareWorkspace(savedFileId);

              await resetCanvas();

              if (workspaceData.editState) {
                let parsedState = workspaceData.editState;
                while (typeof parsedState === 'string') parsedState = JSON.parse(parsedState);
                pages.value = sanitizePagesData(parsedState);
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

  const loadProjectData = async (data, filename) => {
    await resetCanvas();
    documentTitle.value = data.name || filename.replace(/\.(json|pdf|drt)$/i, '');
    currentDocumentId.value = null;
    currentReportId.value = null;
    isPreviewMode.value = false;

    if (data.pages) {
      pages.value = sanitizePagesData(data.pages);
    }
    currentPageIndex.value = 0;
    if (resetHistory) resetHistory();
  };

  const ensureFileHandle = async () => {
    if (window.showSaveFilePicker && !currentFileHandle.value) {
      try {
        const options = {
          suggestedName: `${sanitizeDocumentTitle(documentTitle.value)}.pdf`,
          types: [
            {
              description: 'PDF Document',
              accept: { 'application/pdf': ['.pdf'] }
            }
          ]
        };
        currentFileHandle.value = await window.showSaveFilePicker(options);
        return !!currentFileHandle.value;
      } catch (err) {
        if (err.name === 'AbortError') return false;
        console.error('File picker failed:', err);
        return false;
      }
    }
    return true;
  };

  return {
    variables,
    customVarName,
    documentTitle,
    currentBackground,
    currentDocumentId,
    currentReportId,
    isPreviewMode,
    originalObjectStates,
    pages,
    currentPageIndex,
    isSidebarOpen,
    groupedVariables,

    fetchVariables,
    saveReport,
    resetCanvas,
    togglePreview,
    handleImportWorkspace,
    handleImportAppend,
    addBlankPage,
    addCustomVariable,
    togglePagesSidebar,
    getDefaultPageImage,
    cleanFabricObject,
    preparePagesForSave,
    sanitizePagesData,
    isPagesSidebarOpen,
    handleUnifiedImport,
    ensureFileHandle,
    processPdfToImages,
    saveFileWithFallback,
    setDocumentCallbacks
  };
}
