import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiService } from '../services/apiService';
import { CANVAS_CONSTANTS } from '../constants/canvas';

import { v4 as uuidv4, validate as validateUuid } from 'uuid';

const getMachineId = () => {
  let id = localStorage.getItem('report_machine_id');
  if (!id || !validateUuid(id)) {
    id = uuidv4();
    localStorage.setItem('report_machine_id', id);
  }
  return id;
};

export const useEditorStore = defineStore('editor', () => {
  const pages = ref([{ id: 0, background: null, objects: [] }]);
  const currentPageIndex = ref(0);

  const currentDocumentId = ref(null);
  const currentReportId = ref(null);
  const documentTitle = ref('');
  const isSidebarOpen = ref(false);

  const deletePage = (index) => {
    pages.value.splice(index, 1);
    if (currentPageIndex.value >= pages.value.length) {
      currentPageIndex.value = Math.max(0, pages.value.length - 1);
    }
  };

  const resetState = () => {
    currentDocumentId.value = null;
    currentReportId.value = null;
    documentTitle.value = '';
    pages.value = [{ id: Date.now(), background: null, objects: [] }];
    currentPageIndex.value = 0;
  };

  return {
    pages,
    currentPageIndex,
    currentDocumentId,
    currentReportId,
    documentTitle,
    isSidebarOpen,
    deletePage,
    resetState,
    getMachineId
  };
});
