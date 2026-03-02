import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ImageChangeResponse, ApiError } from "@/types/database";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ menuName: string }> }
) {
  const { menuName } = await params;
  const decodedMenuName = decodeURIComponent(menuName);

  // 메뉴 찾기
  const { data: menus, error: menuError } = await supabase
    .from("menus")
    .select("id, name, store_id, image_url")
    .eq("name", decodedMenuName);

  if (menuError) {
    return NextResponse.json(
      { success: false, error: "db_error", message: menuError.message } satisfies ApiError,
      { status: 500 }
    );
  }

  if (!menus || menus.length === 0) {
    return NextResponse.json(
      { success: false, error: "menu_not_found", message: `메뉴를 찾을 수 없습니다: ${decodedMenuName}` } satisfies ApiError,
      { status: 404 }
    );
  }

  const menu = menus[0];
  const previousImageUrl = menu.image_url;

  // 이미지가 없어도 200 반환 (PRD: 변경 없음 표시)
  if (!previousImageUrl) {
    const response: ImageChangeResponse = {
      success: true,
      message: `${decodedMenuName}에 삭제할 이미지가 없습니다.`,
      menu: {
        id: menu.id,
        name: menu.name,
        previousImageUrl: null,
        newImageUrl: null,
      },
    };
    return NextResponse.json(response);
  }

  // 이미지 URL을 null로 업데이트
  const { error: updateError } = await supabase
    .from("menus")
    .update({ image_url: null })
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
    action: "img_delete",
    target_type: "menu",
    target_name: decodedMenuName,
    before_data: { image_url: previousImageUrl },
    after_data: { image_url: null },
    status: "success",
  });

  const response: ImageChangeResponse = {
    success: true,
    message: `${decodedMenuName} 이미지를 삭제했습니다.`,
    menu: {
      id: menu.id,
      name: menu.name,
      previousImageUrl,
      newImageUrl: null,
    },
  };

  return NextResponse.json(response);
}
