import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { CategoryCreateRequest, CategoryCreateResponse, ApiError } from "@/types/database";

export async function POST(request: NextRequest) {
  let body: CategoryCreateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_body", message: "요청 본문이 올바르지 않습니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  const { categoryName, storeName } = body;

  if (!categoryName || !storeName) {
    return NextResponse.json(
      { success: false, error: "missing_param", message: "categoryName과 storeName이 필요합니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  // 매장 찾기
  const { data: stores, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .ilike("name", `%${storeName}%`);

  if (storeError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: storeError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  if (!stores || stores.length === 0) {
    return NextResponse.json(
      { success: false, error: "store_not_found", message: `매장을 찾을 수 없습니다: ${storeName}` } satisfies ApiError,
      { status: 404 }
    );
  }

  const storeId = stores[0].id;

  // 중복 카테고리 확인
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("store_id", storeId)
    .eq("name", categoryName);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { success: false, error: "category_exists", message: `이미 존재하는 카테고리입니다: ${categoryName}` } satisfies ApiError,
      { status: 409 }
    );
  }

  // 마지막 순서 조회
  const { data: lastCat } = await supabase
    .from("categories")
    .select("display_order")
    .eq("store_id", storeId)
    .order("display_order", { ascending: false })
    .limit(1);

  const nextOrder = (lastCat?.[0]?.display_order ?? 0) + 1;

  // 카테고리 생성
  const { data: newCat, error: createError } = await supabase
    .from("categories")
    .insert({ store_id: storeId, name: categoryName, display_order: nextOrder })
    .select("id, name, display_order")
    .single();

  if (createError || !newCat) {
    return NextResponse.json(
      { success: false, error: "db_error", message: "카테고리 생성에 실패했습니다." } satisfies ApiError,
      { status: 500 }
    );
  }

  // change_logs 기록
  await supabase.from("change_logs").insert({
    store_id: storeId,
    action: "cat_create",
    target_type: "category",
    target_name: categoryName,
    before_data: {},
    after_data: { name: categoryName, display_order: nextOrder },
    status: "success",
  });

  const response: CategoryCreateResponse = {
    success: true,
    message: `${categoryName} 카테고리를 생성했습니다.`,
    category: {
      id: newCat.id,
      name: newCat.name,
      displayOrder: newCat.display_order,
    },
  };

  return NextResponse.json(response, { status: 201 });
}
