import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  try {
    console.log('로컬 웹 서버를 구동하는 중...');
    const server = await createServer({
      configFile: path.resolve(__dirname, './vite.config.ts'),
      root: path.resolve(__dirname, './'),
      server: {
        port: 3000,
        host: '0.0.0.0'
      }
    });
    await server.listen();
    console.log('Vite 개발 서버가 성공적으로 작동되었습니다!');
    server.printUrls();
  } catch (err) {
    console.error('Vite 구동 오류:', err);
  }
})();
