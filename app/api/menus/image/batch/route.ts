import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { BatchImageRequest, ApiError } from "@/types/database";

export async function POST(request: NextRequest) {
  let body: BatchImageRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_body", message: "요청 본문이 올바르지 않습니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  const { mappings } = body;

  if (!mappings || !Array.isArray(mappings) || mappings.length === 0) {
    return NextResponse.json(
      { success: false, error: "missing_param", message: "mappings 배열이 필요합니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  const results: { menuName: string; success: boolean; message: string }[] = [];

  for (const mapping of mappings) {
    const { menuName, pendingImageId } = mapping;

    if (!menuName || !pendingImageId) {
      results.push({ menuName: menuName || "(없음)", success: false, message: "menuName과 pendingImageId가 필요합니다." });
      continue;
    }

    // 1. pending_images에서 image_url 조회 (applied 무시 — 동일 이미지 재사용 지원)
    const { data: pendingImages, error: pendingError } = await supabase
      .from("pending_images")
      .select("id, image_url")
      .eq("id", pendingImageId)
      .limit(1);

    if (pendingError || !pendingImages || pendingImages.length === 0) {
      results.push({ menuName, success: false, message: `이미지를 찾을 수 없습니다: ${pendingImageId}` });
      continue;
    }

    const imageUrl = pendingImages[0].image_url;

    // 2. 메뉴 찾기
    const { data: menus, error: menuError } = await supabase
      .from("menus")
      .select("id, name, store_id, image_url")
      .eq("name", menuName);

    if (menuError || !menus || menus.length === 0) {
      results.push({ menuName, success: false, message: `메뉴를 찾을 수 없습니다: ${menuName}` });
      continue;
    }

    const menu = menus[0];
    const previousImageUrl = menu.image_url;

    // 3. 메뉴 image_url 업데이트
    const { error: updateError } = await supabase
      .from("menus")
      .update({ image_url: imageUrl })
      .eq("id", menu.id);

    if (updateError) {
      results.push({ menuName, success: false, message: `업데이트 실패: ${updateError.message}` });
      continue;
    }

    // 4. pending_images applied=true 마킹
    await supabase
      .from("pending_images")
      .update({ applied: true })
      .eq("id", pendingImageId);

    // 5. change_logs 기록
    const action = previousImageUrl ? "img_change" : "img_add";
    await supabase.from("change_logs").insert({
      store_id: menu.store_id,
      action,
      target_type: "menu",
      target_name: menuName,
      before_data: { image_url: previousImageUrl },
      after_data: { image_url: imageUrl },
      status: "success",
    });

    results.push({ menuName, success: true, message: "이미지 변경 완료" });
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: true,
    results,
    summary: { total: results.length, succeeded, failed },
  });
}
