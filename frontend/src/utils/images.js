const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

export async function compressImage(file, maxEncodedLength = 150000) {
  if (!supportedImageTypes.includes(file.type)) {
    throw new Error(`${file.name} is not a supported image type`);
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not process the selected image');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.82;
  let image = canvas.toDataURL('image/jpeg', quality);
  while (image.length > maxEncodedLength && quality > 0.26) {
    quality -= 0.08;
    image = canvas.toDataURL('image/jpeg', quality);
  }
  if (image.length > maxEncodedLength) throw new Error(`${file.name} is too large after compression`);
  return image;
}