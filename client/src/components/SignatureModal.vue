<template>
  <Transition name="modal">
    <div v-if="isVisible" class="modal-overlay" @click.self="handleCancel">
      <div class="modal-container">
        <div class="modal-header">
          <div class="header-title">
            <div class="header-icon-small">
              <span class="icon-signature-mini"></span>
            </div>
            <div class="header-text">
              <h3>เพิ่มข้อความส่วนบน</h3>
              <p v-if="sigData">{{ sigData.fullName }}</p>
            </div>
          </div>
          <button class="close-btn" @click="handleCancel">&times;</button>
        </div>

        <div class="modal-body">
          <textarea
            id="sigText"
            v-model="text"
            placeholder="พิมพ์ข้อความที่ต้องการ (ถ้ามี)..."
            ref="inputRef"
            rows="3"
          ></textarea>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="handleCancel">ยกเลิก</button>
          <button class="btn-primary" @click="handleConfirm">ตกลง</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  isVisible: Boolean,
  sigData: Object
});

const emit = defineEmits(['confirm', 'cancel']);

const text = ref('');
const inputRef = ref(null);

watch(
  () => props.isVisible,
  (newVal) => {
    if (newVal) {
      text.value = '';
      nextTick(() => {
        inputRef.value?.focus();
      });
    }
  }
);

const handleConfirm = () => {
  emit('confirm', text.value);
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
  background: rgba(30, 30, 40, 0.25);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-container {
  width: 100%;
  max-width: 400px;
  background: #ffffff;
  border-radius: 14px;
  box-shadow:
    0 15px 35px rgba(0, 0, 0, 0.12),
    0 5px 15px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  animation: modal-appear 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid #f0f0f0;
}

@keyframes modal-appear {
  from {
    transform: translateY(15px) scale(0.98);
    opacity: 0;
  }

  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

.modal-header {
  padding: 20px 24px 12px 24px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-small {
  width: 32px;
  height: 32px;
  background: #fff0f5;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f65189;
  font-size: 16px;
}

.icon-signature-mini::before {
  content: '✎';
}

.header-text h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #1a1a1a;
  font-family: 'Sarabun', sans-serif;
}

.header-text p {
  margin: 1px 0 0 0;
  font-size: 13px;
  color: #f65189;
  font-weight: 500;
}

.close-btn {
  background: transparent;
  border: none;
  color: #aaa;
  font-size: 22px;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
  transition: color 0.2s;
  margin-top: -4px;
}

.close-btn:hover {
  color: #666;
}

.modal-body {
  padding: 12px 24px 16px 24px;
}

textarea {
  width: 100%;
  padding: 14px;
  border: 1.5px solid #f0f0f0;
  border-radius: 10px;
  font-family: 'Sarabun', sans-serif;
  font-size: 15px;
  resize: none;
  transition: all 0.2s;
  box-sizing: border-box;
  background: #fafafa;
  line-height: 1.5;
  color: #333;
}

textarea:focus {
  outline: none;
  border-color: #f65189;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(246, 81, 137, 0.08);
}

.modal-footer {
  padding: 8px 24px 24px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

button {
  padding: 10px 22px;
  border-radius: 9px;
  font-family: 'Sarabun', sans-serif;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: #f8f8f8;
  border: 1px solid #f0f0f0;
  color: #777;
}

.btn-secondary:hover {
  background: #f0f0f0;
  color: #444;
}

.btn-primary {
  background: #f65189;
  border: none;
  color: white;
  box-shadow: 0 4px 10px rgba(246, 81, 137, 0.15);
}

.btn-primary:hover {
  background: #e0447a;
  transform: translateY(-1px);
  box-shadow: 0 6px 15px rgba(246, 81, 137, 0.25);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
