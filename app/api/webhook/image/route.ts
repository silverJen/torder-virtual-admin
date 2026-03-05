import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { ApiError } from "@/types/database";

const CHANNELTALK_ACCESS_KEY = process.env.CHANNELTALK_ACCESS_KEY!;
const CHANNELTALK_ACCESS_SECRET = process.env.CHANNELTALK_ACCESS_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_body", message: "요청 본문이 올바르지 않습니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  // 채널톡 웹훅 페이로드에서 필요한 정보 추출
  const entity = body.entity as Record<string, unknown> | undefined;
  if (!entity) {
    return NextResponse.json(
      { success: false, error: "invalid_payload", message: "entity가 없습니다." } satisfies ApiError,
      { status: 400 }
    );
  }

  const chatId = entity.chatId as string | undefined;
  const files = entity.files as Array<{ key: string; name: string; type: string }> | undefined;

  if (!chatId || !files || files.length === 0) {
    // 이미지가 없는 메시지 웹훅 — 무시
    return NextResponse.json({ success: true, message: "이미지 없는 메시지, 스킵" });
  }

  // 이미지 파일만 필터링
  const imageFiles = files.filter(f =>
    f.type?.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name)
  );

  if (imageFiles.length === 0) {
    return NextResponse.json({ success: true, message: "이미지 파일 없음, 스킵" });
  }

  const results = [];

  for (const file of imageFiles) {
    try {
      // 1. Channel.io File API로 signed URL 획득
      const signedUrlRes = await fetch(
        `https://api.channel.io/open/v5/user-chats/${chatId}/messages/file?key=${encodeURIComponent(file.key)}`,
        {
          headers: {
            "x-access-key": CHANNELTALK_ACCESS_KEY,
            "x-access-secret": CHANNELTALK_ACCESS_SECRET,
          },
        }
      );

      if (!signedUrlRes.ok) {
        results.push({ file: file.name, status: "error", message: `signed URL 획득 실패: ${signedUrlRes.status}` });
        continue;
      }

      const signedUrlData = await signedUrlRes.json();
      const signedUrl = signedUrlData.url || signedUrlData.signedUrl;

      if (!signedUrl) {
        results.push({ file: file.name, status: "error", message: "signed URL이 응답에 없습니다." });
        continue;
      }

      // 2. signed URL에서 이미지 다운로드
      const imageRes = await fetch(signedUrl);
      if (!imageRes.ok) {
        results.push({ file: file.name, status: "error", message: `이미지 다운로드 실패: ${imageRes.status}` });
        continue;
      }

      const imageBuffer = await imageRes.arrayBuffer();
      const contentType = imageRes.headers.get("content-type") || "image/png";

      // 3. Supabase Storage에 업로드
      const timestamp = Date.now();
      const ext = file.name.split(".").pop() || "png";
      const storagePath = `webhook/${chatId}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}.${ext}`;

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/menu-images/${storagePath}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": contentType,
          },
          body: imageBuffer,
        }
      );

      if (!uploadRes.ok) {
        const uploadErr = await uploadRes.text();
        results.push({ file: file.name, status: "error", message: `Supabase 업로드 실패: ${uploadErr}` });
        continue;
      }

      // 4. permanent public URL 생성
      const permanentUrl = `${SUPABASE_URL}/storage/v1/object/public/menu-images/${storagePath}`;

      // 5. pending_images 테이블에 저장
      const { error: dbError } = await supabase.from("pending_images").insert({
        chat_id: chatId,
        image_url: permanentUrl,
      });

      if (dbError) {
        results.push({ file: file.name, status: "error", message: `DB 저장 실패: ${dbError.message}` });
        continue;
      }

      results.push({ file: file.name, status: "success", imageUrl: permanentUrl });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      results.push({ file: file.name, status: "error", message: errMsg });
    }
  }

  return NextResponse.json({
    success: true,
    message: `${results.filter(r => r.status === "success").length}/${imageFiles.length}개 이미지 처리 완료`,
    chatId,
    results,
  });
}
