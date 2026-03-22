import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ApiError } from "@/types/database";

export async function GET(request: NextRequest) {
  const chatId = request.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json(
      { success: false, error: "missing_param", message: "chatId is required" } satisfies ApiError,
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("pending_images")
    .select("id, image_url, created_at")
    .eq("chat_id", chatId)
    .eq("applied", false)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { success: false, error: "db_error", message: error.message } satisfies ApiError,
      { status: 500 }
    );
  }

  const images = (data || []).map((img, index) => ({
    index,
    id: img.id,
    imageUrl: img.image_url,
    createdAt: img.created_at,
  }));

  return NextResponse.json({ success: true, images, count: images.length });
}
