import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ImageChangeRequest, ImageChangeResponse, ApiError } from "@/types/database";

export async function POST(request: NextRequest) {
  let body: ImageChangeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_body", message: "요청 본문이 올바르지 않습니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  const { menuName, chatId, pendingImageId } = body;

  if (!menuName || (!chatId && !pendingImageId)) {
    return NextResponse.json(
      { success: false, error: "missing_param", message: "menuName 필수, chatId 또는 pendingImageId 중 하나 필요" } satisfies ApiError,
      { status: 400 }
    );
  }

  // pending_images 조회: pendingImageId 직접 조회 또는 chatId 기반 최신 1장
  let pendingQuery;
  if (pendingImageId) {
    // ID 직접 조회 — applied 체크 안 함 (동일 이미지 여러 메뉴 적용 지원)
    pendingQuery = supabase.from("pending_images").select("id, image_url")
      .eq("id", pendingImageId).limit(1);
  } else {
    // 기존 방식: chatId로 최신 미적용 1장
    pendingQuery = supabase.from("pending_images").select("id, image_url")
      .eq("chat_id", chatId!).eq("applied", false)
      .order("created_at", { ascending: false }).limit(1);
  }

  const { data: pendingImages, error: pendingError } = await pendingQuery;

  if (pendingError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: pendingError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  if (!pendingImages || pendingImages.length === 0) {
    return NextResponse.json(
      { success: false, error: "no_pending_image", message: pendingImageId ? `이미지를 찾을 수 없습니다: ${pendingImageId}` : `chatId ${chatId}에 대한 대기 중인 이미지가 없습니다.` } satisfies ApiError,
      { status: 404 }
    );
  }

  const pendingImage = pendingImages[0];
  const imageUrl = pendingImage.image_url;

  // 메뉴 찾기
  const { data: menus, error: menuError } = await supabase
    .from("menus")
    .select("id, name, store_id, image_url")
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
  const previousImageUrl = menu.image_url;

  // 이미지 URL 업데이트
  const { error: updateError } = await supabase
    .from("menus")
    .update({ image_url: imageUrl })
    .eq("id", menu.id);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: updateError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  // pending_images를 applied=true로 업데이트
  await supabase
    .from("pending_images")
    .update({ applied: true })
    .eq("id", pendingImage.id);

  // change_logs 기록
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

  const response: ImageChangeResponse = {
    success: true,
    message: `${menuName} 이미지를 변경했습니다.`,
    menu: {
      id: menu.id,
      name: menu.name,
      previousImageUrl,
      newImageUrl: imageUrl,
    },
  };

  return NextResponse.json(response);
}
