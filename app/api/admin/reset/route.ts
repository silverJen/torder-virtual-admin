import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ResetResponse, ApiError } from "@/types/database";

const SEED_STORE_NAME = "팔도휴게소(대전괴정점)";

const SEED_CATEGORIES = [
  { name: "면류", display_order: 1 },
  { name: "돈까스류", display_order: 2 },
  { name: "안주휴게소1", display_order: 3 },
  { name: "음료", display_order: 4 },
  { name: "세트메뉴", display_order: 5 },
];

const SEED_MENUS = [
  { name: "베이컨크림수제비", category: "면류", price: 8900, image_url: null, display_order: 1 },
  { name: "짬뽕", category: "면류", price: 7500, image_url: "https://placehold.co/400x300?text=짬뽕", display_order: 2 },
  { name: "칼국수", category: "면류", price: 7000, image_url: "https://placehold.co/400x300?text=칼국수", display_order: 3 },
  { name: "왕돈까스", category: "돈까스류", price: 9500, image_url: "https://placehold.co/400x300?text=왕돈까스", display_order: 1 },
  { name: "치즈돈까스", category: "돈까스류", price: 10500, image_url: "https://placehold.co/400x300?text=치즈돈까스", display_order: 2 },
  { name: "모둠전", category: "안주휴게소1", price: 15000, image_url: "https://placehold.co/400x300?text=모둠전", display_order: 1 },
  { name: "해물파전", category: "안주휴게소1", price: 13000, image_url: "https://placehold.co/400x300?text=해물파전", display_order: 2 },
  { name: "골뱅이무침", category: "안주휴게소1", price: 12000, image_url: null, display_order: 3 },
  { name: "콜라", category: "음료", price: 2000, image_url: "https://placehold.co/400x300?text=콜라", display_order: 1 },
  { name: "사이다", category: "음료", price: 2000, image_url: "https://placehold.co/400x300?text=사이다", display_order: 2 },
  { name: "돈까스+냉면세트", category: "세트메뉴", price: 13000, image_url: "https://placehold.co/400x300?text=돈까스+냉면세트", display_order: 1 },
  { name: "수제비+만두세트", category: "세트메뉴", price: 11000, image_url: null, display_order: 2 },
];

export async function POST() {
  // 1. change_logs 삭제 (카운트 먼저)
  const { count: logCount } = await supabase
    .from("change_logs")
    .select("id", { count: "exact", head: true });

  const changeLogsCleared = logCount ?? 0;

  // 2. 기존 데이터 삭제 (순서 중요: FK 종속성)
  const { error: delMenus } = await supabase.from("menus").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delMenus) {
    return NextResponse.json(
      { success: false, error: "db_error", message: `메뉴 삭제 실패: ${delMenus.message}` } satisfies ApiError,
      { status: 500 }
    );
  }

  const { error: delCats } = await supabase.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delCats) {
    return NextResponse.json(
      { success: false, error: "db_error", message: `카테고리 삭제 실패: ${delCats.message}` } satisfies ApiError,
      { status: 500 }
    );
  }

  const { error: delLogs } = await supabase.from("change_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delLogs) {
    return NextResponse.json(
      { success: false, error: "db_error", message: `로그 삭제 실패: ${delLogs.message}` } satisfies ApiError,
      { status: 500 }
    );
  }

  const { error: delStores } = await supabase.from("stores").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delStores) {
    return NextResponse.json(
      { success: false, error: "db_error", message: `매장 삭제 실패: ${delStores.message}` } satisfies ApiError,
      { status: 500 }
    );
  }

  // 3. 매장 생성
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .insert({ name: SEED_STORE_NAME })
    .select("id")
    .single();

  if (storeError || !store) {
    return NextResponse.json(
      { success: false, error: "db_error", message: "매장 생성에 실패했습니다." } satisfies ApiError,
      { status: 500 }
    );
  }

  // 4. 카테고리 생성
  const categoryIdMap: Record<string, string> = {};

  for (const cat of SEED_CATEGORIES) {
    const { data: newCat, error: catError } = await supabase
      .from("categories")
      .insert({ store_id: store.id, name: cat.name, display_order: cat.display_order })
      .select("id")
      .single();

    if (catError || !newCat) {
      return NextResponse.json(
        { success: false, error: "db_error", message: `카테고리 생성 실패: ${cat.name}` } satisfies ApiError,
        { status: 500 }
      );
    }

    categoryIdMap[cat.name] = newCat.id;
  }

  // 5. 메뉴 생성
  const menuInserts = SEED_MENUS.map((m) => ({
    store_id: store.id,
    category_id: categoryIdMap[m.category],
    name: m.name,
    price: m.price,
    image_url: m.image_url,
    display_order: m.display_order,
  }));

  const { error: menuError } = await supabase.from("menus").insert(menuInserts);

  if (menuError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: `메뉴 생성 실패: ${menuError.message}` } satisfies ApiError,
      { status: 500 }
    );
  }

  const response: ResetResponse = {
    success: true,
    message: "시드 데이터로 초기화했습니다.",
    summary: {
      stores: 1,
      categories: SEED_CATEGORIES.length,
      menus: SEED_MENUS.length,
      changeLogsCleared,
    },
  };

  return NextResponse.json(response);
}
