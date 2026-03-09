import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { StoreSearchResponse, ApiError } from "@/types/database";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name");

  if (!name) {
    return NextResponse.json(
      { success: false, error: "missing_param", message: "name 파라미터가 필요합니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  // 부분 일치 검색 (공백/괄호를 와일드카드로 변환하여 유연한 매칭)
  const searchPattern = name.replace(/[\s()]+/g, "%");
  const { data: stores, error: storeError } = await supabase
    .from("stores")
    .select("id, name, is_editable")
    .ilike("name", `%${searchPattern}%`);

  if (storeError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: storeError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  if (!stores || stores.length === 0) {
    return NextResponse.json(
      { error: "store_not_found", message: `매장을 찾을 수 없습니다: ${name}` },
      { status: 404 }
    );
  }

  const store = stores[0];

  // 카테고리 조회
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, name, display_order")
    .eq("store_id", store.id)
    .order("display_order");

  if (catError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: catError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  // 메뉴 조회
  const { data: menus, error: menuError } = await supabase
    .from("menus")
    .select("id, name, category_id, price, image_url, display_order")
    .eq("store_id", store.id)
    .order("display_order");

  if (menuError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: menuError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  // 카테고리별 메뉴 수 계산
  const menuCountMap: Record<string, number> = {};
  for (const menu of menus ?? []) {
    menuCountMap[menu.category_id] = (menuCountMap[menu.category_id] || 0) + 1;
  }

  // 카테고리 ID → 이름 맵
  const categoryNameMap: Record<string, string> = {};
  for (const cat of categories ?? []) {
    categoryNameMap[cat.id] = cat.name;
  }

  const response: StoreSearchResponse = {
    store: { id: store.id, name: store.name, is_editable: store.is_editable },
    menus: (menus ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      category: categoryNameMap[m.category_id] ?? "",
      categoryId: m.category_id,
      price: m.price,
      imageUrl: m.image_url,
      displayOrder: m.display_order,
    })),
    categories: (categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      displayOrder: c.display_order,
      menuCount: menuCountMap[c.id] || 0,
    })),
  };

  return NextResponse.json(response);
}
