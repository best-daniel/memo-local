# Memo Local — PoC 1

메모 핵심 기능을 먼저 검증하는 정적 웹앱입니다. 설치할 외부 패키지는 없습니다. Vercel 배포에서는 공통 Google 설정을 정적 파일로 생성하는 Node 빌드를 실행합니다.

## 기능

- 내용 입력란 하나로 메모 작성, 수정, 삭제 (삭제 확인)
- 첫 줄은 제목으로 참고, 두 번째 줄부터 본문으로 표시
- 첫 줄이 비어 있거나 공백뿐이면 `제목 없음`으로 표시
- 한 줄만 입력해도 저장 가능; 입력 원문과 첫 줄 줄바꿈 보존
- 기존 제목/내용 메모도 하나의 입력란으로 읽고 편집 가능
- 제목/내용 검색, 작성일 최신순(기본) / 수정일 최신순 선택
- 작성/수정 시각, 전체 개수 표시
- 브라우저 localStorage 저장 (`memoapp.notes.v1`)
- JSON 가져오기·내보내기, 병합 미리보기, 병합 전 백업
- 저장 실패 시 입력 유지, 손상된 저장 데이터 덮어쓰기 방지
- 미저장 입력이 있을 때 이동 경고, 모바일 화면 지원
- Ctrl/Command + Enter 저장

## 로컬 실행

저장소 루트에서 실행:

```bash
python -m http.server 8000 --directory .
```

브라우저에서 http://localhost:8000 을 엽니다. localhost 또는 HTTPS로 실행하세요.

## Vercel 배포

저장소를 연결한 후 Root Directory를 `.`, Framework Preset을 `Other`로 선택합니다. Build Command는 `node build.cjs`, Output Directory는 `dist`입니다. Google Drive 사용을 위한 환경변수는 아래 운영자 최초 설정을 참고하세요.

## 저장 범위

현재 브라우저·프로필·사이트 주소(origin)에만 저장합니다. 주소가 바뀌면 다른 저장 공간을 사용하며 기기 간 동기화는 없습니다. 브라우저 데이터 삭제 또는 시크릿 모드 종료 시 데이터가 사라질 수 있습니다. 중요한 메모는 JSON으로 백업하세요. 다른 PC의 JSON 파일을 가져와 기존 메모와 병합할 수 있습니다. 저장 버튼으로 저장하며 자동 저장은 하지 않습니다. 외부 네트워크 요청이나 AI 호출은 없습니다.

## 이후 확장 계획

사용자 요청에 따라 AI API는 나중에 확장합니다. 이번 단계에는 구현하지 않습니다.

1. 별도 서버 API를 통한 AI 연동 (서버 환경변수에 API 키 보관)
2. 메모 하나에서 여러 일정 추출 및 일반 내용 요약
3. 일정 대시보드와 요약 목록

현재 메모는 `id`, `content`(전체 원문), `createdAt`, `updatedAt`으로 저장합니다. 제목과 본문은 원문에서 표시할 때만 나누며, 이후 별도 AI 분석 결과를 연결할 수 있습니다. 기존 `title`/`body` 형식은 `title + 줄바꿈 + body`로 읽어 들이고, 다음 저장 시 새 형식으로 기록합니다. 저장 키는 유지합니다.

## 수동 확인

1. 메모 저장 → 새로고침 후 유지 확인
2. 수정 → 수정 시각과 목록 순서 확인
3. 검색 → 제목과 내용 검색 확인
4. 삭제 취소 및 삭제 확인
5. 빈 내용 저장 차단, HTML 문자열이 텍스트로 표시되는지 확인
6. JSON 내보내기 → notes 데이터 확인
7. 저장소 접근 차단/용량 초과 시 저장 오류와 입력 유지 확인


## PC 간 JSON 이동

1. A PC에서 **JSON 내보내기**를 눌러 파일을 B PC로 전달합니다.
2. B PC에서 입력 중인 메모를 저장하고 **JSON 가져오기**로 파일을 선택합니다.
3. 추가·갱신·중복·기존 최신 유지·충돌 개수를 확인합니다. 취소하면 변경되지 않습니다.
4. **백업 후 병합**을 누릅니다. 병합 전 백업 다운로드를 요청하고, 브라우저에도 직전 백업을 보관한 뒤 병합합니다. 브라우저 다운로드가 실제 완료됐는지 확인하세요.
5. 작성일 최신순으로 표시합니다. 수정일 최신순도 선택할 수 있습니다. 원래 ID·작성일·수정일·줄바꿈은 유지합니다.

### 병합 규칙

- 없는 ID: 추가. 같은 ID·같은 내용: 중복 제외하고 최신 수정 메타데이터 유지.
- 같은 ID·다른 내용: 수정일이 최신인 메모 적용. 더 오래된 파일은 기존 메모 유지.
- 같은 ID·동일 수정일·다른 내용: 기존 메모와 새 ID의 `충돌 사본`을 모두 보존합니다. `conflictOf`로 원래 ID를 기록하며 같은 파일을 다시 가져와도 사본을 중복 생성하지 않습니다.
- 파일에 없는 기존 메모는 삭제하지 않습니다. 삭제 이력은 전파하지 않습니다.
- 두 PC의 시계가 정확해야 수정일 기반 병합이 의도대로 동작합니다.
- `version: 1`, `exportedAt`, `notes` 형식만 허용합니다. 기존 title/body 백업도 읽습니다. 잘못된 날짜·빈 내용·중복 ID·알 수 없는 버전은 파일 전체를 거부합니다. 파일은 최대 10MB입니다.
- 미리보기 이후 데이터가 바뀌면 병합을 중단하고 다시 선택하도록 합니다.
- 백업 저장 실패 또는 메모 저장 실패 시 기존 메모를 유지합니다.

직전 병합 전 백업은 localStorage의 `memoapp.preImportBackup.v1`에 보관합니다. 복구가 필요하면 개발자 도구에서 해당 값을 JSON 파일로 저장한 뒤 가져올 수 있습니다. 백업 가져오기는 병합 방식이므로 전체 교체/되돌리기는 아닙니다.

```json
{
  "version": 1,
  "exportedAt": "2026-11-12T12:00:00.000Z",
  "notes": [
    {
      "id": "unique-memo-id",
      "content": "제목\n본문",
      "createdAt": "2026-11-10T10:00:00.000Z",
      "updatedAt": "2026-11-11T10:00:00.000Z"
    }
  ]
}
```

### 자동 검증

```bash
node --test transfer.test.cjs
```

## Google Drive — 일반 사용자는 연결 버튼만 사용

`feature/google_drive` 브랜치에서 작업합니다. 공통 메모 서버나 DB는 없습니다. 사용자가 선택한 Google 계정과 폴더에만 백업합니다. 연결은 선택이며, 연결하지 않아도 기존 브라우저 메모·JSON 기능을 사용할 수 있습니다. Google 스크립트는 연결 클릭 이후에만 로드합니다.

### 운영자 최초 설정 (사용자 입력 불필요)

1. 하나의 Google Cloud 프로젝트에서 Google Drive API, Google Picker API를 활성화합니다.
2. OAuth 동의 화면을 구성합니다. 개인 Google 계정 등 불특정 사용자에게 제공하려면 External 대상으로 설정하고 공개 사용 가능한 상태로 게시합니다. 테스트 모드에서는 등록한 테스트 계정만 사용할 수 있습니다. Google이 요구하는 정책/검증을 완료해야 합니다.
3. 웹 애플리케이션 OAuth Client ID를 생성합니다. Authorized JavaScript origins에 실제 운영·Preview Origin을 등록합니다. 경로와 와일드카드는 넣지 않습니다. 고정 브랜치 Preview 주소를 권합니다.
4. Picker API Key를 생성합니다. API와 HTTP referrer를 제한합니다. Google Picker 문서의 docs.google.com referrer 요구도 확인하세요. 동일 프로젝트의 숫자 Project Number를 확인합니다.
5. Vercel 프로젝트 → Settings → Environment Variables에 아래 값을 등록합니다. 이번 기능 테스트에는 Preview 환경을 선택합니다.

| 환경변수 | 값 |
|---|---|
| `GOOGLE_CLIENT_ID` | 웹 OAuth Client ID (`…apps.googleusercontent.com`) |
| `GOOGLE_PICKER_API_KEY` | 제한을 설정한 브라우저용 Picker API Key |
| `GOOGLE_PROJECT_NUMBER` | 같은 Google Cloud 프로젝트의 숫자 Project Number |

Root Directory는 `.`, Build Command는 `node build.cjs`, Output Directory는 `dist`입니다. 추적된 vercel.json에 기본값이 있습니다. 기존 Vercel UI의 Build/Output override가 비어 있거나 위 값과 같도록 확인하고 환경변수 변경 후 재배포하세요.

빌드는 허용된 세 가지 공개 설정만 drive-config.js에 생성합니다. Client Secret·refresh token은 사용하지 않으며, Vercel Functions도 없습니다. 사용자가 설정값을 입력하거나 localStorage 설정으로 덮어쓸 수 없습니다. 예전 PoC 설정은 무시합니다. 공통 설정이 없어도 기본 메모 기능은 동작하지만 Google 연결은 준비되지 않았다는 안내를 표시합니다.

### 사용자 흐름

1. **Google Drive 연결** → 자신의 Google 계정 로그인·drive.file 권한 동의.
2. 연결 후 나타나는 **폴더 선택** → 본인 Drive의 쓰기 가능한 폴더 선택.
3. **Drive에 백업** → 현재 브라우저에 저장된 메모 전체를 날짜별 새 JSON으로 업로드. 기존 파일을 덮어쓰지 않습니다.
4. 다른 PC에서는 같은 계정 연결 → **Drive에서 가져오기** → JSON 선택 → 기존 병합 미리보기 → 백업 후 병합.
5. **연결 해제** → 메모리 토큰 제거 및 Google 권한 철회 요청. 로컬 메모·Drive 파일은 삭제하지 않습니다.

로그인만으로 자동 업로드하거나 자동 병합하지 않습니다. 로컬 메모는 브라우저 단위이며 Google 계정 전환이 로컬 메모를 분리/삭제하지 않습니다. 백업은 현재 연결된 계정에 사용자가 실행할 때만 저장합니다. 공유 PC에서는 백업 전에 연결된 계정을 확인하세요.

토큰은 메모리에서만 유지하고 새로고침·만료 시 다시 연결합니다. 폴더 ID는 OAuth Client ID와 Google 계정별로 기억하며 다른 PC에서는 다시 선택합니다. drive.file은 폴더 안의 모든 기존 파일 접근을 허용하는 권한이 아니므로 가져올 파일도 Picker로 선택합니다. 공유 드라이브 전용 동작과 백그라운드 자동 동기화는 포함하지 않습니다.

### 로컬 실행 및 검증

환경변수가 없으면 로컬 메모만 테스트할 수 있습니다. Drive 테스트에는 위 세 환경변수를 실행 환경에 설정한 후:

```bash
node build.cjs
python -m http.server 8000 --directory dist
node --test transfer.test.cjs drive-client.test.cjs config.test.cjs
```

Google OAuth에는 http://localhost:8000 Origin도 등록합니다. 모의 HTTP 테스트는 실제 Google 로그인/Picker 테스트를 대신하지 않습니다.


## 저장소 이전

현재 작업 저장소: https://github.com/best-daniel/memo-local

기존 playground1/memoapp의 현재 파일을 이 저장소 최상위로 옮겼습니다. 원래 Git 커밋 이력은 playground1에 남습니다. 기본 메모는 main, Google Drive 확장은 feature/google_drive에서 관리합니다. 브라우저 저장 키는 호환성을 위해 memoapp 접두사를 유지합니다. Vercel에서는 새 저장소와 Root Directory `.`를 지정해야 하며 기존 환경변수/도메인/OAuth Origin 설정은 별도로 확인해야 합니다.
