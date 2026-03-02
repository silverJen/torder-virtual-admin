import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { CategoryDeleteResponse, ApiError } from "@/types/database";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const categoryName = decodeURIComponent(name);

  // 카테고리 찾기
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, store_id, name, display_order")
    .eq("name", categoryName);

  if (catError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: catError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  if (!categories || categories.length === 0) {
    return NextResponse.json(
      { success: false, error: "category_not_found", message: `카테고리를 찾을 수 없습니다: ${categoryName}` } satisfies ApiError,
      { status: 404 }
    );
  }

  const category = categories[0];

  // 카테고리에 메뉴가 있는지 확인
  const { count, error: countError } = await supabase
    .from("menus")
    .select("id", { count: "exact", head: true })
    .eq("category_id", category.id);

  if (countError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: countError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  if (count && count > 0) {
    return NextResponse.json(
      { success: false, error: "category_not_empty", message: `카테고리에 메뉴가 남아있어 삭제할 수 없습니다. (${count}개 메뉴)` } satisfies ApiError,
      { status: 400 }
    );
  }

  // 카테고리 삭제
  const { error: deleteError } = await supabase
    .from("categories")
    .delete()
    .eq("id", category.id);

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: deleteError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  // 나머지 카테고리 순서 재정렬
  const { data: remainingCats } = await supabase
    .from("categories")
    .select("id, display_order")
    .eq("store_id", category.store_id)
    .order("display_order");

  if (remainingCats) {
    for (let i = 0; i < remainingCats.length; i++) {
      if (remainingCats[i].display_order !== i + 1) {
        await supabase
          .from("categories")
          .update({ display_order: i + 1 })
          .eq("id", remainingCats[i].id);
      }
    }
  }

  // change_logs 기록
  await supabase.from("change_logs").insert({
    store_id: category.store_id,
    action: "cat_delete",
    target_type: "category",
    target_name: categoryName,
    before_data: { name: categoryName, display_order: category.display_order },
    after_data: {},
    status: "success",
  });

  const response: CategoryDeleteResponse = {
    success: true,
    message: `${categoryName} 카테고리를 삭제했습니다.`,
  };

  return NextResponse.json(response);
}
