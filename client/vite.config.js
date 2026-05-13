import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '../');
  const env = loadEnv(mode, envDir, '');

  return {
    envDir: '../',
    plugins: [
      vue(),

      {
        name: 'mjs-mime-fix',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.endsWith('.mjs')) {
              res.setHeader('Content-Type', 'application/javascript');
            }
            next();
          });
        }
      }
    ],
    server: {
      port: parseInt(env.VITE_DEV_PORT || '5174'),
      host: true
    },
    build: {
      assetsInlineLimit: 0
    },
    preview: {
      port: 4000,
      proxy: {
        '/api': {
          target: 'http://localhost:4010',
          changeOrigin: true
        },
        '/uploads': {
          target: 'http://localhost:4010',
          changeOrigin: true
        }
      }
    }
  };
});
