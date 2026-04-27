<template>
  <aside class="sidebar-container" @mouseleave="handleMouseLeave">
    <div class="sidebar-rail">
      <div class="rail-items">
        <button @click="handleTabClick('pages')" @mouseenter="handleMouseEnter('pages')" :class="[
          'rail-btn',
          { active: activeTab === 'pages' && isOpen, pinned: isPinned && activeTab === 'pages' }
        ]">
          <span class="rail-icon icon-page"></span>
          <span class="rail-label">หน้าหนังสือ</span>
        </button>

        <button @click="handleTabClick('data')" @mouseenter="handleMouseEnter('data')" :class="[
          'rail-btn',
          { active: activeTab === 'data' && isOpen, pinned: isPinned && activeTab === 'data' }
        ]">
          <span class="rail-icon icon-data"></span>
          <span class="rail-label">ข้อมูลเกษียณ</span>
        </button>
      </div>
    </div>

    <div class="sidebar-panel" :class="{ collapsed: !isOpen }">
      <div class="panel-header">
        <div class="panel-header-title" v-if="activeTab === 'pages'">
          <span class="panel-header-icon icon-pages"></span>
          <h3 class="panel-header-text">จัดการหน้าหนังสือ</h3>
        </div>

        <div class="panel-header-title" v-if="activeTab === 'data'">
          <span class="panel-header-icon icon-data-header"></span>
          <h3 class="panel-header-text">ข้อมูลเกษียณหนังสือ</h3>
        </div>
      </div>
      <div class="panel-content">
        <div v-if="activeTab === 'pages'" class="tab-pane-pages">
          <div class="pages-list" @mouseleave="clearDragState">
            <div v-for="(page, index) in pages" :key="page.id" :class="[
              'page-item-sidebar',
              {
                active: isOpen && currentPageIndex === index,
                disabled: !isCanvasReady,
                dragging: draggedPageIndex === index,
                'drag-target-top': dragOverIndex === index && dragPosition === 'top',
                'drag-target-bottom': dragOverIndex === index && dragPosition === 'bottom'
              }
            ]" draggable="true" @dragstart="onPageDragStart($event, index)"
              @dragover.prevent="onPageDragOver($event, index)" @drop="onPageDrop($event, index)"
              @dragend="onPageDragEnd" @click="isCanvasReady ? $emit('page-click', index) : null">
              <div class="page-entry">
                <div class="page-thumb">
                  <img :src="page.background || getDefaultPageImage(index)" :alt="`Page ${index + 1}`" />
                  <button class="del-page-btn" @click.stop="isCanvasReady ? $emit('delete-page', index) : null"
                    v-if="pages.length > 1">
                    <span class="icon-delete"></span>
                  </button>
                </div>
                <div class="page-info">
                  <span class="page-title">หน้า {{ index + 1 }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'data'" class="tab-pane-data">
          <div class="data-section" v-if="signatories.length > 0">
            <h4 class="label-small">เกษียณหนังสือ:</h4>
            <div class="var-list">
              <button v-for="sig in signatories" :key="sig.id" draggable="true"
                @dragstart="onSignatureDragStart($event, sig)" @click="$emit('add-signature-block', sig)"
                class="var-btn" :title="sig.position ? `${sig.fullName} (${sig.position})` : sig.fullName">
                <div class="var-btn-icon-holder"><span class="var-btn-icon">{ }</span></div>
                <span class="var-btn-text">
                  {{ sig.position ? `${sig.fullName} (${sig.position})` : sig.fullName }}
                </span>
              </button>
            </div>
          </div>

          <div class="data-section">
            <!-- <h4 class="label-small">ข้อความทั่วไป:</h4>
            <button @click="handleAddCustomText" class="var-btn" draggable="true"
              @dragstart="onCustomTextDragStart($event)">
              <div class="var-btn-icon-holder"><span class="var-btn-icon">{ }</span></div>
              <span class="var-btn-text">ข้อความอิสระ (พิมพ์เอง)</span>
            </button> -->
          </div>
          <!-- <div class="divider-line" style="margin-top: 15px"></div> -->
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiService from '../services/apiService';

const signatories = ref([]);

onMounted(async () => {
  try {
    signatories.value = await apiService.getSignatories();
  } catch (error) {
    console.error('Failed to load signatories:', error);
  }
});

const activeTab = ref('pages');
const isPinned = ref(false);

const handleMouseEnter = (tabId) => {
  activeTab.value = tabId;
  emit('open');
};

const handleMouseLeave = () => {
  if (!isPinned.value) {
    emit('close');
  }
};

const handleTabClick = (tabId) => {
  if (isPinned.value && activeTab.value === tabId) {
    isPinned.value = false;
    emit('close');
  } else {
    activeTab.value = tabId;
    isPinned.value = true;
    emit('open');
  }
};

const props = defineProps({
  isOpen: Boolean,
  pages: Array,
  currentPageIndex: Number,
  isCanvasReady: Boolean
});

const emit = defineEmits([
  'page-click',
  'delete-page',
  'page-drop',
  'add-signature-block',
  'open',
  'close'
]);

const draggedPageIndex = ref(null);
const dragOverIndex = ref(null);
const dragPosition = ref(null);

const getDefaultPageImage = (index) => {
  return `data:image/svg+xml;base64,${btoa('<svg width="79" height="112" xmlns="http://www.w3.org/2000/svg"><rect width="79" height="112" fill="white"/></svg>')}`;
};

const onPageDragStart = (e, index) => {
  draggedPageIndex.value = index;
};

const onPageDragOver = (e, index) => {
  if (draggedPageIndex.value === null || draggedPageIndex.value === index) return;
  const rect = e.currentTarget.getBoundingClientRect();
  dragOverIndex.value = index;
  dragPosition.value = e.clientY - rect.top > rect.height / 2 ? 'bottom' : 'top';
};

const clearDragState = () => {
  dragOverIndex.value = null;
  dragPosition.value = null;
};

const onPageDragEnd = () => {
  draggedPageIndex.value = null;
  clearDragState();
};

const onPageDrop = (e, targetIndex) => {
  const sourceIndex = draggedPageIndex.value;
  const position = dragPosition.value;
  clearDragState();
  if (sourceIndex === null || sourceIndex === targetIndex) return;
  emit('page-drop', { sourceIndex, targetIndex, position });
};


const onSignatureDragStart = (e, sig) => {
  e.dataTransfer.setData('type', 'SIGNATURE_BLOCK');
  e.dataTransfer.setData('sigData', JSON.stringify(sig));
  e.dataTransfer.effectAllowed = 'copy';
};

const handleAddCustomText = () => {
  if (window.addCustomTextToCanvas) {
    window.addCustomTextToCanvas(50, 50);
  }
};

const onCustomTextDragStart = (e) => {
  e.dataTransfer.setData('customText', 'true');
  e.dataTransfer.effectAllowed = 'copy';
};
</script>

<style scoped>
.sidebar-container {
  position: absolute;
  left: 0;
  top: 69px;
  bottom: 0;
  display: flex;
  z-index: 50;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.sidebar-rail {
  width: 85px;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #f3f3f3;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 18px;
  z-index: 52;
  box-sizing: border-box;
}

.rail-items {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.rail-btn {
  width: 67px;
  height: 66px;
  background: transparent;
  border: none;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s ease;
}

.rail-btn.active,
.rail-btn.pinned {
  background: #fff5f8;
}

.rail-icon {
  width: 22px;
  height: 22px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  margin-bottom: 2px;
}

.icon-page {
  background-image: url('../assets/icons/page.png');
}

.rail-btn.active .icon-page {
  background-image: url('../assets/icons/page-active.png');
}

.icon-data {
  background-image: url('../assets/icons/folder.png');
}

.rail-btn.active .icon-data {
  background-image: url('../assets/icons/folder-active.png');
}

.icon-placeholder {
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rail-label {
  font:
    normal normal normal 18px/24px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  margin-top: 2px;
}

.rail-btn.active .rail-label {
  font:
    normal normal bold 18px/24px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #f65189;
}

.sidebar-panel {
  width: 329px;
  height: 100%;
  background: #ffffff;
  border: 1px solid #f3f3f3;
  display: flex;
  flex-direction: column;
  z-index: 51;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
}

.sidebar-panel.collapsed {
  transform: translateX(-330px);
}

.panel-header {
  height: 69px;
  min-height: 69px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 17px;
  border-bottom: 1px solid #f3f3f3;
}

.panel-header-title {
  display: flex;
  align-items: center;
  gap: 9px;
}

.panel-header-icon {
  width: 20px;
  height: 20px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.icon-pages {
  background-image: url('../assets/icons/page-active.png');
}

.icon-data-header {
  background-image: url('../assets/icons/folder-active.png');
}

.panel-header-text {
  font:
    normal normal bold 21px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  margin: 0;
}

.panel-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  font-weight: bold;
}

.panel-content {
  flex: 1;
  width: 100%;
  overflow-y: auto;
  padding: 0px 0;
}

.panel-footer {
  width: 100%;
  background: #ffffff;
  padding: 15px 0 25px 0;
  display: flex;
  justify-content: center;
  z-index: 10;
}

.tab-pane-pages {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pages-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  padding-right: 5px;
  padding-top: 15px;
}

.page-item-sidebar {
  width: 298px;
  height: 108px;
  background: #f9f9f9 0% 0% no-repeat padding-box;
  border: 1px solid #f3f3f3;
  border-radius: 6px;
  margin-bottom: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  padding: 0 16px;
  box-sizing: border-box;
}

.page-item-sidebar.active {
  background: #f651891a 0% 0% no-repeat padding-box;
  border: 1px solid #ffd5e3;
}

.page-entry {
  display: flex;
  align-items: center;
  gap: 15px;
  width: 100%;
}

.page-thumb {
  position: relative;
  width: 70px;
  height: 92px;
  background: #ffffff 0% 0% no-repeat padding-box;
  border: 1px solid #f6f6f6;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.page-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.del-page-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #e74c3c;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  z-index: 10;
  transition: background 0.2s;
}

.page-item-sidebar:hover .del-page-btn {
  display: flex;
}

.del-page-btn:hover {
  background: #c0392b;
}

.page-title {
  text-align: left;
  font:
    normal normal normal 18px/24px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  letter-spacing: 0px;
  color: #000000;
}

.add-page-actions-sidebar {
  width: 298px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.add-pg-btn {
  width: 298px;
  height: 46px;
  background: #f65189 0% 0% no-repeat padding-box;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: left;
  font:
    normal normal bold 18px/24px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #ffffff;
  cursor: pointer;
  transition: opacity 0.2s;
}

.add-pg-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.add-pg-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.add-pg-btn.secondary {
  background: #ffffff 0% 0% no-repeat padding-box;
  border: 1px solid #f65189;
  color: #f65189;
}

.add-pg-btn.secondary:hover:not(:disabled) {
  background: #fff5f8;
  opacity: 1;
}

.page-item-sidebar.dragging {
  opacity: 0.5;
  border: 2px dashed #999;
}

.page-item-sidebar.drag-target-top {
  border-top: 3px solid #f65189;
}

.page-item-sidebar.drag-target-bottom {
  border-bottom: 3px solid #f65189;
}

.tab-pane-templates {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.save-pane-inner {
  width: 268px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.label-small {
  text-align: left;
  font:
    normal normal normal 18px/24px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  margin-top: 0px;
  margin-bottom: 15px;
}

.t-name {
  text-align: left;
  font:
    normal normal bold 20px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 219px;
}

.t-name.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-del {
  background: #e74c3c;
  border: none;
  border-radius: 50%;
  width: 23px;
  height: 23px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s ease;
}

.icon-delete {
  width: 16px;
  height: 16px;
  background: transparent url('../assets/icons/delete.svg') 0% 0% no-repeat padding-box;
  background-size: contain;
}

.tab-pane-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 15px;
}

.data-section {
  width: 298px;
}

.data-section:first-child {
  padding-bottom: 18px;
  margin-bottom: 15px;
  border-bottom: 1px solid #f3f3f3;
}

.label {
  text-align: left;
  font: 'TH Sarabun New', 'Sarabun', sans-serif;
  font:
    normal normal normal 21px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  margin: 0 0 10px 0;
  display: block;
}

.category-header {
  text-align: left;
  font:
    normal normal bold 21px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  opacity: 1;
  margin: 10px 0 10px 0;
  text-transform: none;
  letter-spacing: 0px;
}

.var-list {
  display: flex;
  flex-direction: column;
}

.var-group {
  display: flex;
  flex-direction: column;
}

.var-btn {
  width: 298px;
  height: 46px;
  background: #fff9fb 0% 0% no-repeat padding-box;
  border: 1px solid #ffd5e3;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.var-btn:hover:not(:disabled) {
  background: #fff9fb 0% 0% no-repeat padding-box;
  border: 1px solid #ffd5e3;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(246, 81, 137, 0.06);
}

.var-btn-icon-holder {
  width: 35px;
  height: 35px;
  background: #ffdfe9 0% 0% no-repeat padding-box;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12px;
}

.var-btn-icon {
  font:
    normal normal bold 21px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #f65189;
}

.var-btn-text {
  font:
    normal normal normal 18px/24px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 23px;
}

.sidebar-toggle {
  position: absolute;
  right: -46px;
  top: 23px;
  width: 46px;
  height: 46px;
  background: white;
  border: 1px solid #e0e0e0;
  border-left: none;
  border-radius: 0 9px 9px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.05);
  z-index: 51;
  color: #333;
}

.section {
  margin-bottom: 23px;
}

.section h3 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 16px;
  color: #666;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input[type='text'],
input:not([type]),
select {
  width: 100%;
  padding: 9px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-family: inherit;
  color: #333;
  background: #fff;
}

.divider-line {
  width: 298px;
  height: 1px;
  background: #f3f3f3;
  margin-bottom: 25px;
}
</style>
