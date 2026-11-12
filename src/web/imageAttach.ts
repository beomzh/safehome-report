/**
 * 매물 화면 캡처 첨부. 브라우저에서 긴 변 1600px 이하 JPEG 로 줄여 data URL 로 만든다.
 * 이미지는 사용자가 "AI로 항목 추출"을 누를 때만 LLM 서버로 전송된다.
 */
export const MAX_ATTACH_IMAGES = 4;
const MAX_SIDE = 1600;
const ACCEPT = /^image\/(png|jpe?g|webp)$/;

/** 클립보드·파일 목록에서 지원하는 이미지 파일만 고른다 */
export function pickImageFiles(files: Iterable<File>): File[] {
  return [...files].filter((f) => ACCEPT.test(f.type));
}

/** 긴 변이 max 를 넘으면 비율을 지켜 줄인 크기를 돌려준다 */
export function fitSize(w: number, h: number, max = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: w, height: h };
  const k = max / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/** 이미지 파일을 줄인 JPEG data URL 로 바꾼다. 실패하면 null */
export async function fileToDataUrl(file: File): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(file);
    const { width, height } = fitSize(bmp.width, bmp.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close();
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}
