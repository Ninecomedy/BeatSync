// Bounded private Firestore thumbnail; no Storage bucket needed.
export async function profileThumbnail(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG or WebP image');
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const size = Math.min(bitmap.width, bitmap.height);
    ctx.drawImage(
      bitmap,
      (bitmap.width - size) / 2,
      (bitmap.height - size) / 2,
      size,
      size,
      0,
      0,
      128,
      128,
    );
    const photo = canvas.toDataURL('image/webp', 0.8);
    if (photo.length > 32768) throw new Error('Image is too detailed. Choose a simpler picture');
    return photo;
  } finally {
    bitmap.close();
  }
}
