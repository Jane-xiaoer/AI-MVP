
/**
 * Loads an image from a base64 string.
 * @param base64 - The base64 string of the image.
 * @returns A promise that resolves with the loaded HTMLImageElement.
 */
const loadImage = (base64: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = base64;
  });
};

/**
 * Resizes an artwork image to match the aspect ratio of a room image by adding transparent padding.
 * This ensures that the AI model receives images with consistent aspect ratios, preventing it
 * from altering the final output's dimensions.
 * @param roomImageBase64 - The base64 string of the room background image.
 * @param artImageBase64 - The base64 string of the artwork image.
 * @returns A promise that resolves with the new base64 string of the padded artwork.
 */
export const resizeArtworkToMatchRoom = async (
  roomImageBase64: string,
  artImageBase64: string
): Promise<string> => {
  try {
    const [roomImg, artImg] = await Promise.all([
      loadImage(roomImageBase64),
      loadImage(artImageBase64),
    ]);

    const roomAspectRatio = roomImg.naturalWidth / roomImg.naturalHeight;
    const artAspectRatio = artImg.naturalWidth / artImg.naturalHeight;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    let destWidth: number, destHeight: number;
    let canvasWidth: number, canvasHeight: number;

    // Determine the canvas size based on the artwork and the room's aspect ratio
    if (artAspectRatio > roomAspectRatio) {
      // Artwork is wider than the room's aspect ratio
      canvasWidth = artImg.naturalWidth;
      canvasHeight = artImg.naturalWidth / roomAspectRatio;
    } else {
      // Artwork is taller than or equal to the room's aspect ratio
      canvasHeight = artImg.naturalHeight;
      canvasWidth = artImg.naturalHeight * roomAspectRatio;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Calculate dimensions to draw the artwork, maintaining its aspect ratio
    const scale = Math.min(
      canvas.width / artImg.naturalWidth,
      canvas.height / artImg.naturalHeight
    );
    destWidth = artImg.naturalWidth * scale;
    destHeight = artImg.naturalHeight * scale;

    // Center the artwork on the canvas
    const x = (canvas.width - destWidth) / 2;
    const y = (canvas.height - destHeight) / 2;
    
    // The canvas is transparent by default
    ctx.drawImage(artImg, x, y, destWidth, destHeight);
    
    // We can use PNG to preserve transparency
    return canvas.toDataURL('image/png');

  } catch (error) {
    console.error('Failed to resize artwork:', error);
    // Fallback to the original image if processing fails
    return artImageBase64;
  }
};
