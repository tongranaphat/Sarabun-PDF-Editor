<template>
  <header class="top-navbar">
    <div class="navbar-left">
      <h1 class="app-title" @click="$emit('go-home')" style="cursor: pointer" title="หน้าหลัก">
        ระบบสารบรรณ
      </h1>
    </div>

    <div class="navbar-right">
      <div class="zoom-group">
        <button @click="$emit('zoom-out')" class="btn-zoom-out" title="ซูมออก">
          <span class="zoom-out-icon"></span>
        </button>

        <div class="zoom-value-box">
          <span class="zoom-value-text">{{ Math.round(zoomLevel * 100) }}%</span>
        </div>

        <button @click="$emit('zoom-in')" class="btn-zoom-in" title="ซูมเข้า">
          <span class="zoom-in-icon"></span>
        </button>
      </div>

      <div class="undo-redo-group">
        <button @click="$emit('undo')" class="action-btn-text" title="ย้อนกลับ">
          <span class="icon-undo"></span>
          <span class="action-text">ย้อนกลับ</span>
        </button>
        <button @click="$emit('redo')" class="action-btn-text" title="ทำซ้ำ">
          <span class="icon-redo"></span>
          <span class="action-text">ทำซ้ำ</span>
        </button>
        <button @click="$emit('reset-project')" class="action-btn-text btn-reset-navbar" title="เริ่มใหม่จากต้นฉบับ">
          <svg class="reset-icon-navbar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
          <span class="action-text">เริ่มใหม่</span>
        </button>
      </div>

      <div class="divider-v"></div>

      <div class="action-group">
        <button @click="$emit('save-report')" class="btn-save-navbar" :disabled="isGenerating" title="บันทึกโปรเจกต์">
          <span class="btn-save-navbar-text">บันทึกโปรเจกต์</span>
        </button>

        <div class="export-dropdown-wrapper" ref="dropdownRef">
          <div class="export-btn-group">
            <button @click="$emit('generate-pdf')" class="btn-export-navbar" :disabled="isGenerating"
              title="ส่งออกเป็นไฟล์ PDF">
              <span class="btn-export-navbar-text">
                {{ isGenerating ? 'กำลังสร้าง...' : 'ส่งออก PDF' }}
              </span>
            </button>
            <button @click="toggleDropdown" class="btn-export-dropdown-toggle" :disabled="isGenerating"
              title="เลือกคุณภาพ PDF">
              <span class="dropdown-arrow" :class="{ open: showDropdown }">▾</span>
            </button>
          </div>
          <div class="export-dropdown-menu" v-if="showDropdown">
            <div class="dropdown-header">คุณภาพ PDF</div>
            <div :class="['dropdown-quality-item', { active: pdfQuality == '1' }]" @click="selectQuality('1')">
              <div class="quality-radio">
                <div class="quality-radio-inner" v-if="pdfQuality == '1'"></div>
              </div>
              <div class="quality-info">
                <span class="quality-title">ฉบับร่าง</span>
                <span class="quality-desc">ไฟล์เล็ก เหมาะสำหรับตรวจงาน</span>
              </div>
              <span class="quality-badge">1x</span>
            </div>
            <div :class="['dropdown-quality-item', { active: pdfQuality == '2' }]" @click="selectQuality('2')">
              <div class="quality-radio">
                <div class="quality-radio-inner" v-if="pdfQuality == '2'"></div>
              </div>
              <div class="quality-info">
                <span class="quality-title">มาตรฐาน</span>
                <span class="quality-desc">สมดุลระหว่างคุณภาพและขนาด</span>
              </div>
              <span class="quality-badge">2x</span>
            </div>
            <div :class="['dropdown-quality-item', { active: pdfQuality == '3' }]" @click="selectQuality('3')">
              <div class="quality-radio">
                <div class="quality-radio-inner" v-if="pdfQuality == '3'"></div>
              </div>
              <div class="quality-info">
                <span class="quality-title">ละเอียด(HD)</span>
                <span class="quality-desc">คมชัดสูง สำหรับจอ Retina</span>
              </div>
              <span class="quality-badge">3x</span>
            </div>
            <div :class="['dropdown-quality-item', { active: pdfQuality == '4' }]" @click="selectQuality('4')">
              <div class="quality-radio">
                <div class="quality-radio-inner" v-if="pdfQuality == '4'"></div>
              </div>
              <div class="quality-info">
                <span class="quality-title">สำหรับพิมพ์</span>
                <span class="quality-desc">ความละเอียดสูงสุด</span>
              </div>
              <span class="quality-badge">4x</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  zoomLevel: {
    type: Number,
    required: true
  },
  isGenerating: {
    type: Boolean,
    default: false
  },
  pdfQuality: {
    type: [String, Number],
    default: 2
  }
});

const emit = defineEmits([
  'go-home',
  'undo',
  'redo',
  'zoom-in',
  'zoom-out',
  'save-report',
  'generate-pdf',
  'reset-project',
  'update:pdfQuality'
]);

const showDropdown = ref(false);
const dropdownRef = ref(null);

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value;
};

const selectQuality = (quality) => {
  emit('update:pdfQuality', quality);
};

const handleClickOutside = (e) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    showDropdown.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.top-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 69px;
  background: #ffffff;
  border-top: 3.5px solid #2196f3;
  border-bottom: 1px solid #e3e3e3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 46px;
  z-index: 1000;
  box-sizing: border-box;

  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.navbar-left {
  display: flex;
  align-items: center;
  height: 100%;
}

.app-title {
  text-align: left;
  font:
    normal normal bold 26px/34px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  letter-spacing: 0px;
  color: #000000;
  opacity: 1;
  margin: 0;
  white-space: nowrap;
}

.navbar-right {
  display: flex;
  align-items: center;
  height: 100%;
}

.zoom-group {
  display: flex;
  align-items: center;
}

.btn-zoom-out,
.btn-zoom-in {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.btn-zoom-out {
  width: 23px;
  height: 23px;
  margin-right: 10px;
}

.zoom-out-icon {
  width: 13px;
  height: 1px;
  background: #4d4d4d;
}

.zoom-value-box {
  width: 72px;
  height: 39px;
  background: #ffffff;
  border: 1px solid #e3e3e3;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zoom-value-text {
  width: 35px;
  height: 26px;
  text-align: center;
  font:
    normal normal normal 20px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  margin-top: 1px;
}

.btn-zoom-in {
  width: 23px;
  height: 23px;
  margin-left: 12px;
}

.zoom-in-icon {
  position: relative;
  width: 9px;
  height: 9px;
}

.zoom-in-icon::before,
.zoom-in-icon::after {
  content: '';
  position: absolute;
  background: #4d4d4d;
}

.zoom-in-icon::before {
  top: 4px;
  left: 0;
  width: 9px;
  height: 1px;
}

.zoom-in-icon::after {
  top: 0;
  left: 4px;
  width: 1px;
  height: 9px;
}

.undo-redo-group {
  display: flex;
  align-items: center;
  margin-left: 24px;
  gap: 24px;
}

.action-btn-text {
  display: flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

.icon-undo,
.icon-redo {
  width: 23px;
  height: 23px;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: 0% 0%;
}

.icon-undo {
  background-image: url('../assets/icons/undo.png');
}

.icon-redo {
  background-image: url('../assets/icons/redo.png');
}

.action-text {
  height: 26px;
  text-align: left;
  font:
    normal normal normal 20px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  white-space: nowrap;
}

.btn-reset-navbar {
  color: #d32f2f;
  transition: opacity 0.2s ease;
}

.btn-reset-navbar:hover {
  opacity: 0.7;
}

.btn-reset-navbar .action-text {
  color: #d32f2f;
  font-weight: bold;
}

.reset-icon-navbar {
  width: 18px;
  height: 18px;
  color: #d32f2f;
  transition: transform 0.3s ease;
}

.btn-reset-navbar:hover .reset-icon-navbar {
  transform: rotate(-45deg);
}

.divider-v {
  width: 1px;
  height: 49px;
  background: #e3e3e3;
  margin: 0 32px 0 46px;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-save-navbar {
  height: 39px;
  background: #f65189;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.btn-save-navbar:hover:not(:disabled) {
  opacity: 0.85;
}

.btn-save-navbar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-save-navbar-text {
  font:
    normal normal bold 20px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #ffffff;
  white-space: nowrap;
}

.export-dropdown-wrapper {
  position: relative;
}

.export-btn-group {
  display: flex;
  align-items: center;
  height: 39px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #f65189;
}

.btn-export-navbar {
  height: 100%;
  background: #ffffff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-export-navbar:hover:not(:disabled) {
  background: #fff5f8;
}

.btn-export-navbar:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-export-navbar-text {
  font:
    normal normal bold 20px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #f65189;
  white-space: nowrap;
}

.btn-export-dropdown-toggle {
  height: 100%;
  width: 32px;
  background: #ffffff;
  border: none;
  border-left: 1px solid #ffd5e3;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease;
  padding: 0;
}

.btn-export-dropdown-toggle:hover:not(:disabled) {
  background: #fff5f8;
}

.btn-export-dropdown-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dropdown-arrow {
  font-size: 14px;
  color: #f65189;
  transition: transform 0.2s ease;
  line-height: 1;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.export-dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 300px;
  background: #ffffff;
  border: 1px solid #e3e3e3;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 1001;
  padding: 8px 0;
  animation: dropdownFadeIn 0.15s ease-out;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-header {
  padding: 8px 16px 10px;
  font:
    normal normal bold 18px/24px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #666;
  border-bottom: 1px solid #f3f3f3;
  margin-bottom: 4px;
}

.dropdown-quality-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s ease;
  gap: 12px;
}

.dropdown-quality-item:hover {
  background: #fafafa;
}

.dropdown-quality-item.active {
  background: #fff9fb;
}

.quality-radio {
  width: 18px;
  height: 18px;
  border: 1.5px solid #e3e3e3;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dropdown-quality-item.active .quality-radio {
  border-color: #f65189;
}

.quality-radio-inner {
  width: 10px;
  height: 10px;
  background: #f65189;
  border-radius: 50%;
}

.quality-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.quality-title {
  font:
    normal normal bold 20px/26px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  line-height: 1;
}

.quality-desc {
  font:
    normal normal normal 16px/20px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #999;
  line-height: 1;
  margin-top: 2px;
}

.quality-badge {
  width: 40px;
  height: 22px;
  background: #ececec;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font:
    normal normal bold 16px/20px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #4d4d4d;
  flex-shrink: 0;
}

.dropdown-quality-item.active .quality-badge {
  background: #ffd5e3;
  color: #f65189;
}
</style>
