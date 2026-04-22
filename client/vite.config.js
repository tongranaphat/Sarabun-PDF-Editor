import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
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
    }
  };
});
