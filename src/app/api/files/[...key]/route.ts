import { NextResponse } from "next/server";
import { LocalDiskStorage, storage } from "@/server/storage";
import { sniffImage } from "@/server/storage/image";

/** Serves locally-stored uploads (STORAGE_DRIVER=local). With S3/R2, images are served from S3_PUBLIC_URL instead. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const s = storage();
  if (!(s instanceof LocalDiskStorage)) return new NextResponse(null, { status: 404 });
  const k = key.join("/");
  if (!/^stores\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(k)) return new NextResponse(null, { status: 404 });
  try {
    const buf = await s.read(k);
    const type = sniffImage(buf);
    if (!type) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type.mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
