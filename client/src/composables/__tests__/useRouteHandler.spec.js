import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRouteHandler } from '../useRouteHandler';
import { ref } from 'vue';

describe('useRouteHandler', () => {
  let isDocumentLoading;
  let pages;
  let currentPageIndex;

  beforeEach(() => {
    isDocumentLoading = ref(false);
    pages = ref([]);
    currentPageIndex = ref(0);

    delete window.location;
    window.location = new URL('http://localhost:5174/');
  });

  it('should initialize empty project on root URL', async () => {
    const resetCanvasWrapper = vi.fn();
    const { handleRouteChange } = useRouteHandler({
      isDocumentLoading, pages, currentPageIndex,
      resetCanvasWrapper
    });

    await handleRouteChange();
    expect(resetCanvasWrapper).toHaveBeenCalled();
    expect(isDocumentLoading.value).toBe(false);
  });

  it('should detect existing project from path', async () => {
    window.location = new URL('http://localhost:5174/pdf/test-1234');

    const { handleRouteChange, isNewProject, getActivePdfId } = useRouteHandler(
      isDocumentLoading, pages, currentPageIndex,
      vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()
    );

    await handleRouteChange();

    expect(isNewProject.value).toBe(false);
    expect(getActivePdfId()).toBe('test-1234');
  });

  it('should detect localPath from query string', async () => {
    window.location = new URL('http://localhost:5174/?filepath=test.pdf');
    const { handleRouteChange } = useRouteHandler({
      isDocumentLoading, pages, currentPageIndex
    });

    await handleRouteChange();
    expect(isDocumentLoading.value).toBe(false);
  });
});
