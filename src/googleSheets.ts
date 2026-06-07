import { auth, GoogleAuthProvider, signInWithPopup } from './firebase';
import { Scenario } from './types';

// Cache access token in memory during active session
let cachedAccessToken: string | null = null;

/**
 * Perform Google Authentication to request Google Sheets and Drive permissions
 */
export async function getGoogleAccessToken(): Promise<string> {
  if (cachedAccessToken) return cachedAccessToken;

  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  provider.addScope('https://www.googleapis.com/auth/drive.file');

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google OAuth Access Token을 받아오는데 실패했습니다.');
    }
    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
  } catch (error) {
    console.error('Google Sign In Error:', error);
    throw error;
  }
}

/**
 * Check if the user is authenticated with Google and has an active token
 */
export function hasActiveToken(): boolean {
  return cachedAccessToken !== null;
}

/**
 * Clear cached token
 */
export function clearGoogleToken() {
  cachedAccessToken = null;
}

/**
 * Creates a Google Spreadsheet for Scenario database
 */
export async function createScenarioSpreadsheet(accessToken: string, scenarios: Scenario[]): Promise<string> {
  // 1. Create the Spreadsheet container
  const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: `사회적 의사소통 가상체험 시나리오 및 상황 설명 데이터 (${new Date().toLocaleDateString('ko-KR')})`
      },
      sheets: [
        {
          properties: {
            title: '시나리오 목록',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        },
        {
          properties: {
            title: '퀘스트 상세 목록',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      ]
    })
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    throw new Error(`스프레드시트 생성 실패: ${errText}`);
  }

  const spreadsheet = await createResponse.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const sheets = spreadsheet.sheets;

  const scenarioSheetId = sheets[0].properties.sheetId;
  const questSheetId = sheets[1].properties.sheetId;

  // 2. Prepare Data
  // Scenario sheet data
  const scenarioHeaders = [
    '시나리오 ID', 
    '체험 월드', 
    '스테이지 번호', 
    '난이도', 
    '보스 스테이지 여부', 
    '스쿨핑 여부', 
    '상황 제목 (Title)', 
    '상황 설명 (Situation)', 
    '퀘스트 총 수'
  ];

  const scenarioRows = scenarios.map(sc => [
    sc.id,
    getWorldName(sc.world),
    sc.stage,
    getDifficultyName(sc.difficulty),
    sc.isBoss ? 'Y' : 'N',
    sc.isSchoolping ? 'Y' : 'N',
    sc.title,
    sc.situation,
    sc.quests.length
  ]);

  // Quest sheet data
  const questHeaders = [
    '시나리오 ID',
    '시나리오 제목',
    '퀘스트 번호',
    '퀘스트 ID',
    '인덱스(유형)',
    '퀘스트 질문 (Question)',
    '선택지 목록 (Options)',
    '정답 (Correct Answer)',
    '해설 설명 (Explanation)',
    '체험 힌트 (Hint)',
    '키워드 자가평가용 (Keywords)'
  ];

  const questRows: any[][] = [];
  scenarios.forEach(sc => {
    sc.quests.forEach((q, idx) => {
      const optionsText = q.options ? q.options.map((opt, oIdx) => `[${oIdx + 1}] ${opt}`).join('\n') : '-';
      const keywordsText = q.keywords ? q.keywords.join(', ') : '-';
      
      questRows.push([
        sc.id,
        sc.title,
        idx + 1,
        q.id || `q-${idx + 1}`,
        q.type === 'multiple-choice' ? '객관식' : q.type === 'short-answer' ? '주관식 단답형' : '서술형 수행',
        q.question,
        optionsText,
        q.correctAnswer,
        q.explanation || '-',
        q.hint || '-',
        keywordsText
      ]);
    });
  });

  // 3. Write data to cells
  const writeResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: "'시나리오 목록'!A1",
          values: [scenarioHeaders, ...scenarioRows]
        },
        {
          range: "'퀘스트 상세 목록'!A1",
          values: [questHeaders, ...questRows]
        }
      ]
    })
  });

  if (!writeResponse.ok) {
    const errText = await writeResponse.text();
    throw new Error(`데이터 입력 실패: ${errText}`);
  }

  // 4. Polish / Style the Sheet (BatchUpdate)
  // Let's add styling: Bold header rows, light grey/red background, grid outline, auto fit column width
  const stylingResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [
        // Style "시나리오 목록" Header Row
        {
          repeatCell: {
            range: {
              sheetId: scenarioSheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: scenarioHeaders.length
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.95, green: 0.90, blue: 0.90 }, // Soft reddish grey to align with the crimson admin dashboard
                textFormat: {
                  bold: true,
                  fontSize: 10,
                  foregroundColor: { red: 0.4, green: 0, blue: 0 }
                },
                alignment: { horizontal: 'CENTER', vertical: 'MIDDLE' }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,alignment)'
          }
        },
        // Style "퀘스트 상세 목록" Header Row
        {
          repeatCell: {
            range: {
              sheetId: questSheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: questHeaders.length
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.90, green: 0.92, blue: 0.96 }, // Soft blueish grey
                textFormat: {
                  bold: true,
                  fontSize: 10,
                  foregroundColor: { red: 0, green: 0.1, blue: 0.3 }
                },
                alignment: { horizontal: 'CENTER', vertical: 'MIDDLE' }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,alignment)'
          }
        },
        // Auto-resize columns for both sheets
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: scenarioSheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: scenarioHeaders.length
            }
          }
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId: questSheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: questHeaders.length
            }
          }
        }
      ]
    })
  });

  if (!stylingResponse.ok) {
    // Non-blocking but log error
    console.warn('스타일링 적용 실패:', await stylingResponse.text());
  }

  return spreadsheetId;
}

// Helpers for human readable names
function getWorldName(world: string): string {
  switch (world) {
    case 'forest': return '신비의 숲 (Forest)';
    case 'sea': return '속삭이는 바다 (Sea)';
    case 'city': return '회색빛 도시 (City)';
    case 'castle': return '공중 성곽 (Castle)';
    default: return world;
  }
}

function getDifficultyName(diff: string): string {
  switch (diff) {
    case 'easy': return '쉬움';
    case 'medium': return '보통';
    case 'hard': return '어려움';
    default: return diff;
  }
}
