<template>
  <Transition name="modal">
    <div v-if="isVisible" class="modal-overlay" @click.self="handleCancel">
      <div class="modal-container">
        <div class="modal-header">
          <div class="header-title">
            <div class="header-icon-small">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
            </div>
            <div class="header-text">
              <h3>ตั้งชื่อไฟล์ก่อนส่งออก</h3>
              <p>ระบุชื่อไฟล์ที่ต้องการ (ระบบจะเติม .pdf ให้โดยอัตโนมัติ)</p>
            </div>
          </div>
          <button class="close-btn" @click="handleCancel">&times;</button>
        </div>

        <div class="modal-body">
          <div class="input-group">
            <input
              type="text"
              v-model="fileName"
              placeholder="ชื่อไฟล์..."
              ref="inputRef"
              @keyup.enter="handleConfirm"
            />
            <span class="file-ext">.pdf</span>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="handleCancel">ยกเลิก</button>
          <button class="btn-primary" @click="handleConfirm">ดาวน์โหลด PDF</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  isVisible: Boolean,
  defaultName: String
});

const emit = defineEmits(['confirm', 'cancel']);

const fileName = ref('');
const inputRef = ref(null);

watch(
  () => props.isVisible,
  (newVal) => {
    if (newVal) {
      fileName.value = props.defaultName || 'report';
      nextTick(() => {
        inputRef.value?.focus();
        inputRef.value?.select();
      });
    }
  }
);

const handleConfirm = () => {
  if (!fileName.value.trim()) {
    alert('กรุณาระบุชื่อไฟล์');
    return;
  }
  emit('confirm', fileName.value.trim());
};

const handleCancel = () => {
  emit('cancel');
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(30, 30, 40, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.modal-container {
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.15),
    0 5px 15px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  animation: modal-appear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  border: 1px solid #f0f0f0;
}

@keyframes modal-appear {
  from {
    transform: translateY(20px) scale(0.95);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.modal-header {
  padding: 24px 24px 16px 24px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-icon-small {
  width: 40px;
  height: 40px;
  background: #fff0f5;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f65189;
  font-size: 20px;
}



.header-text h3 {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  color: #1a1a1a;
  font-family: 'Sarabun', sans-serif;
}

.header-text p {
  margin: 4px 0 0 0;
  font-size: 14px;
  color: #666;
  font-weight: 400;
  font-family: 'Sarabun', sans-serif;
}

.close-btn {
  background: transparent;
  border: none;
  color: #bbb;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
  transition: all 0.2s;
  margin-top: -6px;
}

.close-btn:hover {
  color: #f65189;
  transform: rotate(90deg);
}

.modal-body {
  padding: 8px 24px 20px 24px;
}

.input-group {
  display: flex;
  align-items: center;
  background: #f8f9fa;
  border: 2px solid #eee;
  border-radius: 12px;
  padding: 0 16px;
  transition: all 0.2s;
}

.input-group:focus-within {
  border-color: #f65189;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(246, 81, 137, 0.1);
}

input {
  flex: 1;
  padding: 14px 0;
  border: none;
  background: transparent;
  font-family: 'Sarabun', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: #333;
  outline: none;
}

.file-ext {
  color: #aaa;
  font-weight: 600;
  font-size: 16px;
  padding-left: 8px;
}

.modal-footer {
  padding: 10px 24px 24px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

button {
  padding: 12px 24px;
  border-radius: 10px;
  font-family: 'Sarabun', sans-serif;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f0f0f0;
  border: 1px solid #e5e5e5;
  color: #666;
}

.btn-secondary:hover {
  background: #e5e5e5;
  color: #333;
}

.btn-primary {
  background: #f65189;
  border: none;
  color: white;
  box-shadow: 0 4px 12px rgba(246, 81, 137, 0.2);
}

.btn-primary:hover {
  background: #e0447a;
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(246, 81, 137, 0.3);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
