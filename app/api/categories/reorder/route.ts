import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { CategoryReorderRequest, CategoryReorderResponse, ApiError } from "@/types/database";

export async function PUT(request: NextRequest) {
  let body: CategoryReorderRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_body", message: "요청 본문이 올바르지 않습니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  const { categoryName, newPosition } = body;

  if (!categoryName || !newPosition) {
    return NextResponse.json(
      { success: false, error: "missing_param", message: "categoryName과 newPosition이 필요합니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  // 대상 카테고리 찾기
  const { data: targetCats, error: catError } = await supabase
    .from("categories")
    .select("id, store_id, name, display_order")
    .eq("name", categoryName);

  if (catError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: catError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  if (!targetCats || targetCats.length === 0) {
    return NextResponse.json(
      { success: false, error: "category_not_found", message: `카테고리를 찾을 수 없습니다: ${categoryName}` } satisfies ApiError,
      { status: 404 }
    );
  }

  const target = targetCats[0];
  const oldPosition = target.display_order;

  // 매장의 전체 카테고리 조회 (순서대로)
  const { data: allCats, error: allError } = await supabase
    .from("categories")
    .select("id, name, display_order")
    .eq("store_id", target.store_id)
    .order("display_order");

  if (allError || !allCats) {
    return NextResponse.json(
      { success: false, error: "db_error", message: "카테고리 목록 조회에 실패했습니다." } satisfies ApiError,
      { status: 500 }
    );
  }

  // 범위 검증
  if (newPosition < 1 || newPosition > allCats.length) {
    return NextResponse.json(
      { success: false, error: "invalid_position", message: `순서는 1~${allCats.length} 사이여야 합니다.` } satisfies ApiError,
      { status: 400 }
    );
  }

  // 순서 재배치: 대상을 배열에서 빼고 새 위치에 삽입
  const ordered = allCats.filter((c) => c.id !== target.id);
  ordered.splice(newPosition - 1, 0, { id: target.id, name: target.name, display_order: target.display_order });

  // DB 업데이트
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].display_order !== i + 1) {
      await supabase
        .from("categories")
        .update({ display_order: i + 1 })
        .eq("id", ordered[i].id);
    }
  }

  // change_logs 기록
  await supabase.from("change_logs").insert({
    store_id: target.store_id,
    action: "cat_reorder",
    target_type: "category",
    target_name: categoryName,
    before_data: { display_order: oldPosition },
    after_data: { display_order: newPosition },
    status: "success",
  });

  const response: CategoryReorderResponse = {
    success: true,
    message: `${categoryName} 카테고리를 ${newPosition}번째로 이동했습니다.`,
    categories: ordered.map((c, i) => ({
      name: c.name,
      displayOrder: i + 1,
    })),
  };

  return NextResponse.json(response);
}
