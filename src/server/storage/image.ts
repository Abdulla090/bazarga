import { AppError } from "../errors";

export type ImageType = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };

/** Detect the real image type from magic bytes (the client-sent MIME type is not trusted). */
export function sniffImage(buf: Uint8Array): ImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  )
    return { mime: "image/png", ext: "png" };
  if (
    buf.length >= 12 &&
    String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!) === "RIFF" &&
    String.fromCharCode(buf[8]!, buf[9]!, buf[10]!, buf[11]!) === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  return null;
}

export function validateImage(buf: Uint8Array, maxMb: number): ImageType {
  if (buf.byteLength === 0) throw new AppError("VALIDATION", "empty_file");
  if (buf.byteLength > maxMb * 1024 * 1024) throw new AppError("VALIDATION", "file_too_large");
  const t = sniffImage(buf);
  if (!t) throw new AppError("VALIDATION", "unsupported_image_type");
  return t;
}
