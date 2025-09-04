
import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

function fileToGenerativePart(base64: string) {
    const PURE_BASE64_REGEX = /^data:image\/(?:jpeg|png|webp|gif);base64,(.*)$/;
    const match = base64.match(PURE_BASE64_REGEX);
    if (!match) {
        throw new Error("Invalid base64 image format");
    }
    const data = match[1];
    const mimeType = base64.substring(5, base64.indexOf(';'));

    return {
        inlineData: {
            data,
            mimeType,
        },
    };
}

export const enhanceRoomPhoto = async (roomImageBase64: string): Promise<string> => {
  try {
    const roomPart = fileToGenerativePart(roomImageBase64);
    const prompt = `
      You are an AI interior design visualizer. Your task is to transform the provided photo of a room into a professional interior design rendering, often called an "effect drawing" (效果图).
      Do not simply enhance the photo. Instead, reinterpret it with a stylized, artistic vision.
      Follow these instructions:
      1.  **Stylize:** Convert the image into a clean, digital rendering. Smooth out textures and simplify details for a minimalist aesthetic.
      2.  **Color Palette:** Adopt a low-saturation, muted color palette, similar to Morandi colors. The mood should be calm, elegant, and sophisticated.
      3.  **Lighting:** Create soft, diffuse, and natural-looking lighting. Avoid harsh shadows or bright, overexposed areas. The goal is a gentle, ambient light that fills the space.
      4.  **Composition:** Maintain the original room layout, furniture, and core objects. Do not add, remove, or significantly alter the structural elements.
      5.  **Output:** Return only the stylized rendering of the room. The output must be a high-quality image, free of any text, watermarks, or other artifacts. It should look like a conceptual design rendering, not a photograph.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: [ roomPart, { text: prompt } ] },
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error('AI failed to enhance the image. Model response: ' + response.text);

  } catch (error) {
    console.error("Error calling Gemini API for enhancement:", error);
    throw new Error("Failed to enhance the photo. Please try again.");
  }
};

export const placeArtworkInRoom = async (roomImageBase64: string, artImageBase64: string): Promise<string> => {
  try {
    const roomPart = fileToGenerativePart(roomImageBase64);
    const artPart = fileToGenerativePart(artImageBase64);

    const prompt = `
      You are an expert interior designer AI. You will be given a stylized rendering of a room and a piece of artwork.
      Your task is to place the artwork onto a suitable wall in the room, creating a photorealistic and beautifully composed final image.
      Adhere to these principles for a flawless result:
      1.  **Wall Selection:** Identify the most prominent and suitable wall for art. This is typically a large, clear wall space, often a focal point (e.g., above a sofa, bed, or console table).
      2.  **Artwork Format:** The artwork must be presented within a perfect square frame or as a square canvas.
      3.  **Aesthetic Placement & Scaling:**
          *   **Eye-Level:** The center of the artwork should hang at an average eye-level, which is about 57-60 inches (145-152 cm) from the floor.
          *   **Proportion:** The artwork should be scaled appropriately for the wall and any furniture below it. A common rule is that the art should be about 2/3 the width of the furniture it hangs above. It must not be wider than the furniture.
          *   **Composition:** Place the art to create a harmonious and balanced composition within the room.
      4.  **Realistic Integration:**
          *   **Perspective:** Perfectly match the artwork's perspective and angle to the wall's geometry.
          *   **Lighting & Shadow:** Analyze the room's lighting. Cast subtle, realistic shadows on the wall from the artwork's frame. Apply soft highlights and tones to the artwork itself consistent with the room's light sources. This is crucial for a believable result.
      5.  **Final Output:** Produce only the final, high-resolution, photorealistic image. Do not add any text, explanations, or other artifacts. The result should look like a professional photograph of the room with the artwork installed.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: [ roomPart, artPart, { text: prompt } ] },
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error('No image was generated by the AI model. The model might have returned text instead: ' + response.text);

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate image. Please check your API key and try again.");
  }
};