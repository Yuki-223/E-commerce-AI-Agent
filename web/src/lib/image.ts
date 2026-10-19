/** Accepted upload types (WebHome: "支持 JPG / PNG"); WebP/HEIC-in-browser also decode fine. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

/**
 * Downscale to 1024 px on the long edge and re-encode as JPEG 0.7, the same
 * budget as GuideView.compressedJPEG, and return a data: URL for image_base64.
 */
export async function compressImage(file: Blob, maxSide = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.7)
}

export function firstImage(items: DataTransferItemList | FileList | null | undefined): File | null {
  if (!items) return null
  for (const item of Array.from(items as ArrayLike<DataTransferItem | File>)) {
    const file = item instanceof File ? item : item.kind === 'file' ? item.getAsFile() : null
    if (file && file.type.startsWith('image/')) return file
  }
  return null
}
