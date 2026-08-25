import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// firebase-applet-config.json 로드
const configPath = path.resolve(__dirname, './firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error('설정 파일을 찾을 수 없습니다: firebase-applet-config.json');
  process.exit(1);
}

const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runMigration() {
  console.log('--- 40스테이지 강제 개방 마이그레이션 시작 ---');
  try {
    const usersCol = collection(db, 'users');
    const snapshot = await getDocs(usersCol);
    
    console.log(`총 ${snapshot.size}명의 사용자를 발견했습니다.`);
    
    // 1부터 40까지의 stage-X 배열 생성
    const targetStages = Array.from({ length: 40 }, (_, i) => `stage-${i + 1}`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const userDoc of snapshot.docs) {
      const uid = userDoc.id;
      const data = userDoc.data();
      const currentUnlocked = data.unlockedStages || [];
      
      // 기존 unlockedStages 배열과 targetStages 병합 (중복 제거)
      const mergedUnlocked = Array.from(new Set([...currentUnlocked, ...targetStages]));
      
      // 만약 이미 40스테이지까지 다 포함하고 있고 개수가 같다면 업데이트 건너뛰기 가능 (최적화)
      if (currentUnlocked.length === mergedUnlocked.length && targetStages.every(stage => currentUnlocked.includes(stage))) {
        console.log(`[Skip] User: ${uid} (이미 40스테이지 이상 개방됨)`);
        successCount++;
        continue;
      }
      
      try {
        await updateDoc(doc(db, 'users', uid), {
          unlockedStages: mergedUnlocked
        });
        console.log(`[Success] User: ${uid} (기존: ${currentUnlocked.length}개 -> 변경 후: ${mergedUnlocked.length}개)`);
        successCount++;
      } catch (err) {
        console.error(`[Fail] User: ${uid} 업데이트 실패:`, err);
        failCount++;
      }
    }
    
    console.log(`\n--- 마이그레이션 완료 ---`);
    console.log(`성공: ${successCount}건`);
    console.log(`실패: ${failCount}건`);
  } catch (error) {
    console.error('마이그레이션 중 오류 발생:', error);
  }
}

runMigration();
