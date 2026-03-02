# 가상 티오더 어드민

## 기술 스택
- Next.js 14 App Router + TypeScript + Tailwind
- Supabase (PostgreSQL)
- Vercel 배포

## 디렉토리 구조
app/api/ → API 라우트 (챗봇이 호출)
app/(admin)/ → 어드민 UI 페이지
components/ → 공용 컴포넌트
lib/ → supabase client, 유틸
types/ → TypeScript 타입 정의
docs/ → PRD 문서

## DB 테이블
- stores (id, name, created_at)
- categories (id, store_id, name, display_order, created_at)
- menus (id, store_id, category_id, name, price, image_url, display_order, created_at)
- change_logs (id, store_id, action, target_type, target_name, before_data, after_data, status, created_at)

## 코딩 규칙
- API 성공: { success: true, ... }
- API 실패: { success: false, error: "코드", message: "설명" }
- Supabase client는 lib/supabase.ts에서 import
- 컴포넌트에 'use client' 명시

## 참고
- docs/PRD_가상_티오더_어드민.md에 전체 API 명세와 시드 데이터 정의
