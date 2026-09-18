/**
 * Avatar helpers: validate + client-side resize a picture picked from the
 * device gallery into a compact data URL (stored in the profile doc).
 */

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp';

/** Two-letter initials fallback ("JD" for John Doe, first letter of email otherwise). */
export function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  const source = parts[0] ?? email ?? 'U';
  return source.slice(0, 2).toUpperCase();
}

/** Load a File into an HTMLImageElement. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

/**
 * Validate and downscale an avatar file to a data URL.
 * Max 2MB input; rendered at most 320x320 to keep the profile doc small.
 */
export async function processAvatarFile(
  file: File,
): Promise<{ dataUrl: string } | { error: string }> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    return { error: 'Please choose a PNG, JPG or WebP image.' };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: 'That image is larger than 2 MB. Please pick a smaller one.' };
  }
  try {
    const img = await loadImage(file);
    const maxDim = 320;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { error: 'Your browser could not process that image.' };
    ctx.drawImage(img, 0, 0, w, h);
    let dataUrl = canvas.toDataURL('image/webp', 0.85);
    if (!dataUrl.startsWith('data:image/webp')) {
      // WebP export unsupported -> JPEG fallback
      dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    }
    return { dataUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not process that image.' };
  }
}
