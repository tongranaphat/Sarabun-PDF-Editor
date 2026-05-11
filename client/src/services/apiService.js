import axios from 'axios';

const MANUAL_API_BASE = import.meta.env.VITE_API_BASE_URL;

const BACKEND_PORT = import.meta.env.VITE_API_PORT || '4011';
const envApiUrl = import.meta.env.VITE_API_URL || '/api';

const API_BASE = MANUAL_API_BASE || `${window.location.origin.replace(/:\d+$/, '')}:${BACKEND_PORT}${envApiUrl}`;
const BACKEND_BASE = API_BASE.replace('/api', '');

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const machineId = localStorage.getItem('report_machine_id');
    if (machineId) {
      config.headers['X-Machine-ID'] = machineId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

const SdcApi = axios.create({
  baseURL: 'http://10.0.0.99/api/service',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': 'basic REDACTED_CREDENTIAL'
  }
});

const SdcApiUpload = axios.create({
  baseURL: 'http://10.0.0.99/api/service',
  headers: {
    'Accept': 'application/json',
    'Authorization': 'basic REDACTED_CREDENTIAL'
  }
});

export const apiService = {
  async decodeToken(token) {
    const response = await api.post('/auth/decode-token', { token });
    return response.data;
  },

  async getSarabanDocFileDetail(id) {
    const response = await SdcApi.get(`/saraban-doc/file-detail/${id}`);
    return response.data;
  },

  async savePdfToSdc(sdcId, fileBlob, fileName) {
    if (import.meta.env.VITE_SDC_DRY_RUN === 'true') {
      console.log('[SDC DRY RUN] savePdfToSdc called — not sending to real server');
      console.log('[SDC DRY RUN] sdcId:', sdcId);
      console.log('[SDC DRY RUN] fileName:', fileName || 'document.pdf');
      console.log('[SDC DRY RUN] fileSize:', fileBlob.size, 'bytes');
      return { dry_run: true, sdcId, fileName };
    }
    const formData = new FormData();
    formData.append('file', fileBlob, fileName || 'document.pdf');
    const response = await SdcApiUpload.post(
      `/saraban-doc/save-pdf-sign/${sdcId}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    const data = response.data;
    return data.saraban_doc_sign_attach || data.saraban_doc || data;
  },

  async getVariables() {
    const response = await api.get('/variables');
    return response.data;
  },

  async getSignatories(documentId) {
    const url = documentId ? `/signatories?documentId=${documentId}` : '/signatories';
    const response = await api.get(url);
    return response.data;
  },

  async importSignatories(transactions, documentId) {
    const response = await api.post('/signatories/import', { transactions, documentId });
    return response.data;
  },

  async importPdfFromUrl(url) {
    const response = await api.post('/pdf/import-url', { url });
    return response.data;
  },

  async importPdfLocal(localPath) {
    const response = await api.post('/pdf/import-local', { localPath });
    return response.data;
  },


  async prepareWorkspace(id) {
    const response = await api.get(`/pdf/workspace/${id}`);
    return response.data;
  },

  async savePdfState(formData) {
    const response = await api.post('/pdf/save-state', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async getStampMetadata(fileId = null) {
    const url = fileId ? `/pdf/stamp-metadata?fileId=${fileId}` : '/pdf/stamp-metadata';
    const response = await api.get(url);
    return response.data;
  },

  async resetToOriginal(id) {
    const response = await api.post(`/pdf/reset/${id}`);
    return response.data;
  },

  async cleanupTemp(id) {
    const response = await api.post(`/pdf/cleanup-temp/${id}`);
    return response.data;
  },


  async uploadPdf(formData) {
    const response = await api.post('/pdf/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async downloadBlob(url) {
    const fullUrl = url.startsWith('http') ? url : `${BACKEND_BASE}${url}`;
    const response = await api.get(fullUrl, { responseType: 'blob', baseURL: '' });
    return response.data;
  },


  async updateStampConfig(id, data) {
    const response = await api.put(`/stamp-config/${id}`, data);
    return response.data;
  },

  getBackendBase() {
    return BACKEND_BASE;
  },
};

export default apiService;
export { api, SdcApi, SdcApiUpload };
