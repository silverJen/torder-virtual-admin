# PRD: 가상 티오더 어드민

> **문서 버전**: v1.0
> **작성일**: 2026-03-02
> **상태**: 초안

---

## 1. 프로젝트 개요

### 왜 만드는가?

채널톡 챗봇(V2 POC)이 고객 요청을 받아서 **티오더 어드민 API를 자동으로 호출**하는 시나리오를 테스트해야 합니다. 하지만 실제 티오더 어드민 API는 아직 연동할 수 없는 상태이므로, 동일한 동작을 하는 **가상 어드민**을 만들어서 PoC를 검증합니다.

### 어떻게 쓰는가?

```
고객이 채널톡에서 메뉴 수정 요청
    ↓
채널톡 챗봇(V2 POC)이 요청을 분석
    ↓
챗봇의 code 노드가 가상 어드민 API를 호출  ← 여기
    ↓
가상 어드민이 데이터를 실제로 변경
    ↓
가상 어드민 UI에서 변경 전/후를 눈으로 확인  ← 여기
```

### 누가 쓰는가?

| 사용자 | 하는 일 |
|--------|---------|
| 채널톡 챗봇 (자동) | API를 호출해서 메뉴 데이터를 조회/수정/삭제 |
| 기획자/개발자 (사람) | 가상 어드민 UI에서 챗봇이 변경한 결과를 확인 |

### 최종 목표

V2 POC의 핵심 질문 5가지에 답하는 것:

| # | 질문 | 가상 어드민의 역할 |
|---|------|-------------------|
| 1 | 챗봇이 안내/처리를 스스로 판단하는가? | S1 시나리오로 검증 (API 호출 없이 끝나는지) |
| 2 | 메뉴 조회 후 조건 분기가 동작하는가? | 메뉴 조회 API가 실제 데이터를 반환 |
| 3 | 자연어를 실행 가능한 계획으로 변환하는가? | 계획 실행 API가 성공/실패를 반환 |
| 4 | 계획대로 API를 순서대로 호출하는가? | 변경 로그에서 호출 순서 확인 |
| 5 | 대화를 이어가면서 반복 처리하는가? | UI에서 before/after 변경 이력 확인 |

---

## 2. 기술 스택

| 구성 요소 | 기술 | 설명 |
|-----------|------|------|
| **프론트엔드** | Next.js (App Router) | 가상 어드민 관리 화면 |
| **백엔드 API** | Next.js Route Handlers | 챗봇이 호출하는 API 엔드포인트 |
| **데이터베이스** | Supabase (PostgreSQL) | 매장, 메뉴, 카테고리, 변경 이력 저장 |
| **배포** | Vercel | 무료 플랜으로 배포 |

### 구성도

```
┌─────────────────┐         ┌──────────────────────────────────┐
│   채널톡 챗봇    │  API    │       가상 티오더 어드민 (Vercel)   │
│   (V2 POC)      │ ──────→ │                                    │
│                  │         │  ┌────────────┐  ┌─────────────┐  │
│  code 노드가     │         │  │ API Routes │  │   UI 화면    │  │
│  HTTP 요청 전송  │         │  │ /api/...   │→ │ 관리 + 로그  │  │
│                  │         │  └─────┬──────┘  └─────────────┘  │
└─────────────────┘         │        │                           │
                            │  ┌─────▼──────┐                   │
                            │  │  Supabase   │                   │
                            │  │ (PostgreSQL)│                   │
                            │  └─────────────┘                   │
                            └──────────────────────────────────┘
```

---

## 3. 데이터 모델

### 3.1 테이블 구조

#### `stores` — 매장 정보

> 티오더를 사용하는 식당/매장 정보입니다.

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `id` | uuid (PK) | 고유 식별자 | `550e8400-...` |
| `name` | text | 매장명 (지점명 포함) | `팔도휴게소(대전괴정점)` |
| `created_at` | timestamp | 생성일 | `2026-03-02T00:00:00Z` |

#### `categories` — 카테고리

> 매장 내 메뉴를 분류하는 그룹입니다. (예: 면류, 안주류, 음료)

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `id` | uuid (PK) | 고유 식별자 | `550e8400-...` |
| `store_id` | uuid (FK → stores) | 소속 매장 | |
| `name` | text | 카테고리명 | `면류` |
| `display_order` | integer | 표시 순서 (1부터 시작) | `1` |
| `created_at` | timestamp | 생성일 | |

#### `menus` — 메뉴 항목

> 매장에서 판매하는 개별 메뉴입니다.

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `id` | uuid (PK) | 고유 식별자 | `550e8400-...` |
| `store_id` | uuid (FK → stores) | 소속 매장 | |
| `category_id` | uuid (FK → categories) | 소속 카테고리 | |
| `name` | text | 메뉴명 | `베이컨크림수제비` |
| `price` | integer | 가격 (원) | `8900` |
| `image_url` | text (nullable) | 이미지 URL | `https://...` |
| `display_order` | integer | 카테고리 내 표시 순서 | `1` |
| `created_at` | timestamp | 생성일 | |

#### `pending_images` — 대기 중인 이미지

> 유저챗 웹훅으로 수신된 이미지를 임시 저장합니다. Task Node-6에서 chatId로 매칭하여 메뉴에 적용합니다.

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `id` | uuid (PK) | 고유 식별자 | |
| `chat_id` | text | 채널톡 채팅 ID | `abc123` |
| `image_url` | text | Supabase Storage permanent URL | `https://...supabase.co/storage/...` |
| `applied` | boolean | 메뉴에 적용 완료 여부 | `false` |
| `created_at` | timestamp | 수신 시각 | |

#### `change_logs` — 변경 이력

> 챗봇이 API를 통해 변경한 모든 이력을 기록합니다. before/after를 비교할 수 있습니다.

| 컬럼 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `id` | uuid (PK) | 고유 식별자 | |
| `store_id` | uuid (FK → stores) | 대상 매장 | |
| `action` | text | 작업 유형 | `img_change` |
| `target_type` | text | 대상 종류 | `menu` 또는 `category` |
| `target_name` | text | 대상 이름 | `베이컨크림수제비` |
| `before_data` | jsonb | 변경 전 상태 | `{"image_url": null}` |
| `after_data` | jsonb | 변경 후 상태 | `{"image_url": "https://..."}` |
| `status` | text | 결과 | `success` 또는 `error` |
| `created_at` | timestamp | 실행 시각 | |

### 3.2 테이블 관계도

```
stores (매장)
  │
  ├── categories (카테고리) — 1:N
  │     │
  │     └── menus (메뉴) — 1:N
  │
  └── change_logs (변경 이력) — 1:N

pending_images (대기 이미지) — 독립 테이블
  chat_id로 유저챗과 연결, applied로 적용 상태 관리
```

---

## 4. API 명세

> 아래 API는 V2 POC JSON의 code 노드(Node-C, Node-F)가 호출하는 형식과 **정확히 동일**합니다.
> 채널톡 code 노드에서 `<BASE_URL>`을 가상 어드민 URL로 교체하면 바로 동작해야 합니다.

### 4.1 매장 검색 + 메뉴 조회

챗봇이 고객에게 매장명을 확인한 후, 해당 매장의 메뉴 목록을 가져오는 API입니다.

**V2 POC 코드 (Node-C):**
```javascript
const response = await axios.get(`<BASE_URL>/stores/search`, {
  params: { name: storeName }
});
// response.data.menus 를 확인
```

**요청:**
```
GET /api/stores/search?name=팔도휴게소(대전괴정점)
```

**성공 응답 (200):**
```json
{
  "store": {
    "id": "550e8400-...",
    "name": "팔도휴게소(대전괴정점)"
  },
  "menus": [
    {
      "id": "menu-001",
      "name": "베이컨크림수제비",
      "category": "면류",
      "categoryId": "cat-001",
      "price": 8900,
      "imageUrl": null,
      "displayOrder": 1
    },
    {
      "id": "menu-002",
      "name": "왕돈까스",
      "category": "돈까스류",
      "categoryId": "cat-002",
      "price": 9500,
      "imageUrl": "https://example.com/dongkaseu.jpg",
      "displayOrder": 1
    }
  ],
  "categories": [
    {
      "id": "cat-001",
      "name": "면류",
      "displayOrder": 1,
      "menuCount": 3
    },
    {
      "id": "cat-002",
      "name": "돈까스류",
      "displayOrder": 2,
      "menuCount": 2
    }
  ]
}
```

**실패 응답 (404):**
```json
{
  "error": "store_not_found",
  "message": "매장을 찾을 수 없습니다: 존재하지않는매장"
}
```

**동작 규칙:**
- `name` 파라미터로 매장명을 **부분 일치** 검색합니다
- 매장이 없으면 404를 반환합니다
- 해당 매장의 전체 카테고리와 메뉴를 함께 반환합니다

---

### 4.2 카테고리 이동 (cat_move)

메뉴를 다른 카테고리로 옮기는 API입니다.

**V2 POC 코드 (Node-F):**
```javascript
case 'cat_move':
  res = await axios.put('<BASE_URL>/menus/category', task.params, { headers });
```

**요청:**
```
PUT /api/menus/category
Content-Type: application/json

{
  "menuName": "베이컨크림수제비",
  "targetCategory": "안주휴게소1"
}
```

**성공 응답 (200):**
```json
{
  "success": true,
  "message": "베이컨크림수제비를 안주휴게소1 카테고리로 이동했습니다.",
  "menu": {
    "id": "menu-001",
    "name": "베이컨크림수제비",
    "previousCategory": "면류",
    "newCategory": "안주휴게소1"
  }
}
```

**실패 응답 (404):**
```json
{
  "success": false,
  "error": "menu_not_found",
  "message": "메뉴를 찾을 수 없습니다: 베이컨크림수제비"
}
```

**동작 규칙:**
- `menuName`으로 메뉴를 찾고, `targetCategory`로 카테고리를 찾습니다
- 대상 카테고리가 없으면 **자동 생성**합니다 (실제 어드민 동작과 동일)
- 변경 전/후 상태를 `change_logs`에 기록합니다

---

### 4.3 카테고리 생성 (cat_create)

새 카테고리를 만드는 API입니다.

**V2 POC 코드 (Node-F):**
```javascript
case 'cat_create':
  res = await axios.post('<BASE_URL>/categories', task.params, { headers });
```

**요청:**
```
POST /api/categories
Content-Type: application/json

{
  "categoryName": "신메뉴",
  "storeName": "팔도휴게소(대전괴정점)"
}
```

**성공 응답 (201):**
```json
{
  "success": true,
  "message": "신메뉴 카테고리를 생성했습니다.",
  "category": {
    "id": "cat-new",
    "name": "신메뉴",
    "displayOrder": 5
  }
}
```

**실패 응답 (409):**
```json
{
  "success": false,
  "error": "category_exists",
  "message": "이미 존재하는 카테고리입니다: 신메뉴"
}
```

**동작 규칙:**
- 새 카테고리의 순서는 기존 카테고리 마지막에 추가됩니다
- 같은 이름의 카테고리가 이미 있으면 409 에러를 반환합니다
- `storeName`으로 매장을 특정합니다 (V2 POC에서 storeName이 memory에 저장되어 있으므로)

---

### 4.4 카테고리 삭제 (cat_delete)

빈 카테고리를 삭제하는 API입니다.

**V2 POC 코드 (Node-F):**
```javascript
case 'cat_delete':
  res = await axios.delete('<BASE_URL>/categories/' + encodeURIComponent(task.params.categoryName), { headers });
```

**요청:**
```
DELETE /api/categories/신메뉴
```

**성공 응답 (200):**
```json
{
  "success": true,
  "message": "신메뉴 카테고리를 삭제했습니다."
}
```

**실패 응답 (400):**
```json
{
  "success": false,
  "error": "category_not_empty",
  "message": "카테고리에 메뉴가 남아있어 삭제할 수 없습니다. (3개 메뉴)"
}
```

**동작 규칙:**
- **빈 카테고리만 삭제 가능**합니다 (메뉴가 하나라도 있으면 에러)
- 카테고리 삭제 후 나머지 카테고리의 순서를 자동으로 재정렬합니다

---

### 4.5 카테고리 순서 변경 (cat_reorder)

카테고리의 표시 순서를 변경하는 API입니다.

**V2 POC 코드 (Node-F):**
```javascript
case 'cat_reorder':
  res = await axios.put('<BASE_URL>/categories/reorder', task.params, { headers });
```

**요청:**
```
PUT /api/categories/reorder
Content-Type: application/json

{
  "categoryName": "안주휴게소1",
  "newPosition": 1
}
```

**성공 응답 (200):**
```json
{
  "success": true,
  "message": "안주휴게소1 카테고리를 1번째로 이동했습니다.",
  "categories": [
    { "name": "안주휴게소1", "displayOrder": 1 },
    { "name": "면류", "displayOrder": 2 },
    { "name": "돈까스류", "displayOrder": 3 }
  ]
}
```

**동작 규칙:**
- `newPosition`은 1부터 시작합니다
- 순서 변경 시 다른 카테고리의 순서도 자동으로 밀려납니다

---

### 4.6 이미지 업로드/변경 (img_change, img_add)

메뉴에 이미지를 추가하거나 기존 이미지를 교체하는 API입니다. `chatId`로 `pending_images` 테이블에서 웹훅이 저장해둔 최신 이미지를 조회하여 적용합니다.

**V2 POC 코드 (Node-F):**
```javascript
case 'img_change':
case 'img_add':
  res = await axios.post(BASE_URL + '/menus/image', {
    menuName: task.params.menuName,
    chatId: context.chatId
  }, { headers });
```

**요청:**
```
POST /api/menus/image
Content-Type: application/json

{
  "menuName": "베이컨크림수제비",
  "chatId": "abc123"
}
```

**성공 응답 (200):**
```json
{
  "success": true,
  "message": "베이컨크림수제비 이미지를 변경했습니다.",
  "menu": {
    "id": "menu-001",
    "name": "베이컨크림수제비",
    "previousImageUrl": null,
    "newImageUrl": "https://...supabase.co/storage/v1/object/public/menu-images/..."
  }
}
```

**실패 응답 (404) — 대기 이미지 없음:**
```json
{
  "success": false,
  "error": "no_pending_image",
  "message": "chatId abc123에 대한 대기 중인 이미지가 없습니다."
}
```

**동작 규칙:**
- `chatId`로 `pending_images`에서 최신 미적용 이미지를 조회합니다
- `menuName`으로 메뉴를 찾아 이미지 URL을 적용합니다
- 적용 후 `pending_images.applied`를 `true`로 업데이트합니다
- 변경 전/후 `image_url`을 `change_logs`에 기록합니다

---

### 4.6a 이미지 웹훅 수신 (유저챗 웹훅)

채널톡 유저챗 웹훅으로 수신된 이미지를 다운로드하여 Supabase Storage에 저장하는 엔드포인트입니다. 채널톡이 자동으로 호출합니다.

**요청 (채널톡 → 어드민 서버):**
```
POST /api/webhook/image
Content-Type: application/json

{
  "entity": {
    "chatId": "abc123",
    "files": [
      { "key": "pub-file/12345/photo.png", "name": "photo.png", "type": "image/png" }
    ]
  }
}
```

**성공 응답 (200):**
```json
{
  "success": true,
  "message": "1/1개 이미지 처리 완료",
  "chatId": "abc123",
  "results": [
    { "file": "photo.png", "status": "success", "imageUrl": "https://...supabase.co/storage/..." }
  ]
}
```

**동작 규칙:**
1. 웹훅 페이로드에서 `entity.files[].key` 추출
2. Channel.io File API로 signed URL 획득 (15분 TTL)
3. signed URL에서 이미지 다운로드
4. Supabase Storage(`menu-images` 버킷)에 업로드 → permanent URL 생성
5. `pending_images` 테이블에 `{chat_id, image_url}` 저장
6. 이미지가 아닌 파일은 스킵

---

### 4.7 이미지 삭제 (img_delete)

메뉴의 이미지를 제거하는 API입니다.

**V2 POC 코드 (Node-F):**
```javascript
case 'img_delete':
  res = await axios.delete('<BASE_URL>/menus/image/' + encodeURIComponent(task.params.menuName), { headers });
```

**요청:**
```
DELETE /api/menus/image/베이컨크림수제비
```

**성공 응답 (200):**
```json
{
  "success": true,
  "message": "베이컨크림수제비 이미지를 삭제했습니다.",
  "menu": {
    "id": "menu-001",
    "name": "베이컨크림수제비",
    "previousImageUrl": "https://example.com/bacon-cream-sujebi.jpg",
    "newImageUrl": null
  }
}
```

**동작 규칙:**
- 이미지가 없는 메뉴에 삭제 요청 시 200을 반환하되 변경 없음을 표시합니다

---

### 4.8 시드 데이터 초기화 (관리용)

테스트 데이터를 원래 상태로 되돌리는 API입니다. 반복 테스트를 위해 사용합니다.

**요청:**
```
POST /api/admin/reset
```

**성공 응답 (200):**
```json
{
  "success": true,
  "message": "시드 데이터로 초기화했습니다.",
  "summary": {
    "stores": 1,
    "categories": 5,
    "menus": 15,
    "changeLogsCleared": 23
  }
}
```

---

## 5. UI 화면 설계

### 5.1 화면 구성

전체 화면은 1개의 메인 페이지로 구성하며, 왼쪽에서 매장/카테고리/메뉴를 탐색하고 오른쪽에서 상세 정보와 변경 이력을 확인합니다.

```
┌──────────────────────────────────────────────────────────────┐
│  🏪 가상 티오더 어드민                    [데이터 초기화]     │
├───────────────────────┬──────────────────────────────────────┤
│                       │                                      │
│  📁 면류 (3)          │  🍜 베이컨크림수제비                  │
│    ├ 베이컨크림수제비  │  ──────────────────                  │
│    ├ 짬뽕              │  카테고리: 면류                      │
│    └ 칼국수            │  가격: 8,900원                       │
│                       │                                      │
│  📁 돈까스류 (2)      │  📷 이미지:                          │
│    ├ 왕돈까스          │  ┌─────────────┐                    │
│    └ 치즈돈까스        │  │  (이미지     │                    │
│                       │  │   미리보기)  │                    │
│  📁 안주휴게소1 (3)   │  └─────────────┘                    │
│    ├ 모둠전            │                                      │
│    ├ 해물파전          │  ─── 변경 이력 ──────────────────    │
│    └ 골뱅이무침        │                                      │
│                       │  🔵 3분 전 — 이미지 변경              │
│  📁 음료 (2)          │    Before: (이미지 없음)              │
│    ├ 콜라              │    After:  bacon-cream.jpg           │
│    └ 사이다            │                                      │
│                       │  🔵 1분 전 — 카테고리 이동            │
│  📁 세트메뉴 (2)      │    Before: 면류                      │
│    ├ 돈까스+냉면세트   │    After:  안주휴게소1               │
│    └ 수제비+만두세트   │                                      │
│                       │                                      │
├───────────────────────┴──────────────────────────────────────┤
│  📋 전체 변경 로그                                  [펼치기]  │
│  ──────────────────────────────────────────────────────────  │
│  10:32:15  img_change   베이컨크림수제비  ✅ 성공             │
│  10:32:16  cat_move     베이컨크림수제비  ✅ 성공             │
│  10:30:05  cat_create   신메뉴           ✅ 성공             │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 화면 상세

#### 왼쪽 패널: 카테고리/메뉴 트리

- 매장의 카테고리를 폴더처럼 표시합니다
- 카테고리 옆에 메뉴 수를 표시합니다
- 카테고리를 클릭하면 펼침/접힘
- 메뉴를 클릭하면 오른쪽에 상세 정보 표시
- **챗봇이 변경한 항목은 하이라이트** 표시 (최근 변경된 메뉴/카테고리에 색상 배지)

#### 오른쪽 패널: 메뉴 상세 + 변경 이력

- 선택한 메뉴의 현재 상태 (이름, 카테고리, 가격, 이미지)
- 이미지가 있으면 미리보기 표시
- 해당 메뉴의 변경 이력을 시간 역순으로 표시
- 각 이력에 **Before / After** 비교 표시

#### 하단 패널: 전체 변경 로그

- 모든 API 호출 이력을 시간 역순으로 표시
- 각 로그에 시각, 작업 유형, 대상, 성공/실패 표시
- 접고 펼칠 수 있음

#### 데이터 초기화 버튼

- 우상단에 "데이터 초기화" 버튼
- 클릭하면 확인 팝업 후 시드 데이터로 복원
- 반복 테스트 시 사용

---

## 6. 시드 데이터

### 6.1 매장

| 매장명 | 설명 |
|--------|------|
| 팔도휴게소(대전괴정점) | S1~S3 테스트 시나리오용 메인 매장 |

### 6.2 카테고리

| 카테고리명 | 순서 | 메뉴 수 | 설명 |
|-----------|------|---------|------|
| 면류 | 1 | 3 | 베이컨크림수제비가 여기에 소속 |
| 돈까스류 | 2 | 2 | |
| 안주휴게소1 | 3 | 3 | S3 카테고리 이동 대상 |
| 음료 | 4 | 2 | |
| 세트메뉴 | 5 | 2 | |

### 6.3 메뉴

| 메뉴명 | 카테고리 | 가격 | 이미지 | 비고 |
|--------|---------|------|--------|------|
| 베이컨크림수제비 | 면류 | 8,900 | 없음 | S2, S3 테스트 대상 |
| 짬뽕 | 면류 | 7,500 | 있음 | |
| 칼국수 | 면류 | 7,000 | 있음 | |
| 왕돈까스 | 돈까스류 | 9,500 | 있음 | |
| 치즈돈까스 | 돈까스류 | 10,500 | 있음 | |
| 모둠전 | 안주휴게소1 | 15,000 | 있음 | |
| 해물파전 | 안주휴게소1 | 13,000 | 있음 | |
| 골뱅이무침 | 안주휴게소1 | 12,000 | 없음 | |
| 콜라 | 음료 | 2,000 | 있음 | |
| 사이다 | 음료 | 2,000 | 있음 | |
| 돈까스+냉면세트 | 세트메뉴 | 13,000 | 있음 | |
| 수제비+만두세트 | 세트메뉴 | 11,000 | 없음 | |

> **"이미지 있음"** 표시된 메뉴는 시드 데이터에 placeholder 이미지 URL을 넣어둡니다.

### 6.4 시나리오별 필요 데이터 매핑

| 시나리오 | 필요 데이터 | 초기 상태 |
|---------|------------|----------|
| S1 (재부팅 안내) | 매장 "팔도휴게소(대전괴정점)" | 매장 존재 (API 호출 없음) |
| S2 (이미지 변경) | 메뉴 "베이컨크림수제비" | 이미지 없는 상태 |
| S3-1턴 (이미지 변경) | 메뉴 "베이컨크림수제비" | 이미지 없는 상태 |
| S3-2턴 (카테고리 이동) | 카테고리 "안주휴게소1" | 베이컨크림수제비가 면류에 소속 |

---

## 7. 배포 가이드

### 7.1 프로젝트 생성

```bash
npx create-next-app@latest torder-virtual-admin --typescript --tailwind --app
cd torder-virtual-admin
```

### 7.2 Supabase 설정

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. SQL Editor에서 테이블 생성 (섹션 3의 데이터 모델에 따라)
3. 시드 데이터 삽입 (섹션 6의 데이터)
4. Project Settings → API에서 URL과 anon key 복사

### 7.3 환경 변수

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...          # Storage 업로드용 service_role key
CHANNELTALK_ACCESS_KEY=69a93d...                        # 채널톡 File API 인증
CHANNELTALK_ACCESS_SECRET=afbdb3...                     # 채널톡 File API 인증
```

### 7.4 Vercel 배포

1. GitHub에 코드를 푸시합니다
2. [vercel.com](https://vercel.com)에서 Import Repository
3. Environment Variables에 위 환경 변수 추가
4. Deploy 클릭

배포가 완료되면 `https://torder-virtual-admin.vercel.app` 형태의 URL이 생성됩니다.

### 7.5 V2 POC JSON 연동

배포된 URL을 V2 POC JSON의 placeholder에 넣으면 됩니다:

```
변경 전: <BASE_URL>/stores/search
변경 후: https://torder-virtual-admin.vercel.app/api/stores/search
```

인증이 없으므로 `<AUTH_TOKEN>` 부분은 아무 값이나 넣어도 동작합니다.

---

## 8. PoC 범위 외 (향후 확장)

아래 기능은 V2 PoC 검증 후 필요에 따라 추가합니다:

| 기능 | 이유 |
|------|------|
| 옵션 추가/삭제/순서변경 | 가장 복잡한 기능, PoC 이후 |
| 배너/로고 이미지 | 메뉴 이미지와 규격이 다름 |
| 타 지점 이미지 참조 | 매장 간 데이터 접근 필요 |
| 상품명 변경 | V2 taskQueue type에 없음 |
| 메뉴 노출 시간 설정 | V2 taskQueue type에 없음 |
| 이미지 규격 검증 (2MB) | Supabase Storage 버킷에서 2MB 제한 설정으로 대체 |
| ~~실제 이미지 파일 업로드~~ | ✅ 유저챗 웹훅 → 어드민 서버 직접 저장 방식으로 구현 완료 |

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-03-02 | v1.0 초안 작성 |
| 2026-03-05 | v1.1 이미지 웹훅 아키텍처 — pending_images 테이블 추가, /api/webhook/image 엔드포인트 추가, /api/menus/image를 chatId 방식으로 변경, 환경 변수 3개 추가 |
