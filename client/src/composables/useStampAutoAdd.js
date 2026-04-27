import apiService from '../services/apiService';

/**
 * Centralized stamp auto-add logic.
 * Replaces 8+ duplicated patterns of "fetch stamp → add block → auto-save".
 */
export function useStampAutoAdd() {

  /**
   * Fetch stamp metadata and add block to canvas, then auto-save.
   * @param {string} fileId - The PDF file ID
   * @param {Function} addStampBlockToCanvas - Canvas stamp add function
   * @param {Function} saveCurrentPageState - State save function
   * @param {Function} preparePagesForSave - Pages serializer
   * @param {object} [options] - Extra options
   * @param {Function} [options.renderAllPages] - Render function to call before adding
   * @param {boolean} [options.refreshExisting] - If true, remove existing stamp first
   * @param {import('vue').Ref} [options.canvasRef] - Canvas ref for refresh mode
   */
  const autoAddStamp = async (fileId, addStampBlockToCanvas, saveCurrentPageState, preparePagesForSave, options = {}) => {
    if (!fileId || !addStampBlockToCanvas) return;

    try {
      const stampMeta = await apiService.getStampMetadata(fileId);

      if (options.refreshExisting && options.canvasRef?.value) {
        const objects = options.canvasRef.value.getObjects();
        const existingStamp = objects.find((obj) => obj.name === 'บล็อกเลขที่รับ');
        if (existingStamp) {
          const oldLeft = existingStamp.left;
          const oldTop = existingStamp.top;
          options.canvasRef.value.remove(existingStamp);
          addStampBlockToCanvas(stampMeta, oldLeft, oldTop);
        } else {
          addStampBlockToCanvas(stampMeta);
        }
      } else {
        addStampBlockToCanvas(stampMeta);
      }

      setTimeout(async () => {
        try {
          if (saveCurrentPageState) saveCurrentPageState();
          const pagesData = preparePagesForSave();
          const formData = new FormData();
          formData.append('OriginalFileId', fileId);
          formData.append('editState', JSON.stringify(pagesData));
          await apiService.savePdfState(formData);
        } catch (err) {
          console.error('Failed to auto-save stamp block', err);
        }
      }, 500);
    } catch (e) {
      console.warn('Failed to add auto stamp:', e);
    }
  };

  /**
   * Check if parsed state already contains a stamp block.
   */
  const hasStampInState = (parsedState) => {
    return (
      Array.isArray(parsedState) &&
      parsedState.some(
        (page) =>
          Array.isArray(page.objects) &&
          page.objects.some(
            (obj) =>
              (obj.id && String(obj.id).startsWith('stamp_')) ||
              obj.name === 'บล็อกเลขที่รับ'
          )
      )
    );
  };

  return {
    autoAddStamp,
    hasStampInState
  };
}
