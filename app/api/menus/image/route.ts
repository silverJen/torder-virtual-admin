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

  const { menuName, imageUrl } = body;

  if (!menuName || !imageUrl) {
    return NextResponse.json(
      { success: false, error: "missing_param", message: "menuName과 imageUrl이 필요합니다." } satisfies ApiError,
      { status: 400 }
    );
  }

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
