import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { CategoryMoveRequest, CategoryMoveResponse, ApiError } from "@/types/database";

export async function PUT(request: NextRequest) {
  let body: CategoryMoveRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_body", message: "요청 본문이 올바르지 않습니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  const { menuName, targetCategory } = body;

  if (!menuName || !targetCategory) {
    return NextResponse.json(
      { success: false, error: "missing_param", message: "menuName과 targetCategory가 필요합니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  // 메뉴 찾기
  const { data: menus, error: menuError } = await supabase
    .from("menus")
    .select("id, name, store_id, category_id")
    .eq("name", menuName);

  if (menuError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: menuError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  if (!menus || menus.length === 0) {
    return NextResponse.json(
      { success: false, error: "menu_not_found", message: `메뉴를 찾을 수 없습니다: ${menuName}` } satisfies ApiError,
      { status: 404 }
    );
  }

  const menu = menus[0];

  // 이전 카테고리 이름 조회
  const { data: prevCat } = await supabase
    .from("categories")
    .select("name")
    .eq("id", menu.category_id)
    .single();

  const previousCategory = prevCat?.name ?? "";

  // 대상 카테고리 찾기
  let { data: targetCats } = await supabase
    .from("categories")
    .select("id, name")
    .eq("store_id", menu.store_id)
    .eq("name", targetCategory);

  let targetCategoryId: string;

  if (!targetCats || targetCats.length === 0) {
    // 카테고리가 없으면 자동 생성
    const { data: allCats } = await supabase
      .from("categories")
      .select("display_order")
      .eq("store_id", menu.store_id)
      .order("display_order", { ascending: false })
      .limit(1);

    const nextOrder = (allCats?.[0]?.display_order ?? 0) + 1;

    const { data: newCat, error: createError } = await supabase
      .from("categories")
      .insert({ store_id: menu.store_id, name: targetCategory, display_order: nextOrder })
      .select("id")
      .single();

    if (createError || !newCat) {
      return NextResponse.json(
        { success: false, error: "db_error", message: "카테고리 자동 생성에 실패했습니다." } satisfies ApiError,
        { status: 500 }
      );
    }

    targetCategoryId = newCat.id;
  } else {
    targetCategoryId = targetCats[0].id;
  }

  // 메뉴의 카테고리 업데이트
  const { error: updateError } = await supabase
    .from("menus")
    .update({ category_id: targetCategoryId })
    .eq("id", menu.id);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: updateError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  // change_logs 기록
  await supabase.from("change_logs").insert({
    store_id: menu.store_id,
    action: "cat_move",
    target_type: "menu",
    target_name: menuName,
    before_data: { category: previousCategory },
    after_data: { category: targetCategory },
    status: "success",
  });

  const response: CategoryMoveResponse = {
    success: true,
    message: `${menuName}를 ${targetCategory} 카테고리로 이동했습니다.`,
    menu: {
      id: menu.id,
      name: menu.name,
      previousCategory,
      newCategory: targetCategory,
    },
  };

  return NextResponse.json(response);
}
