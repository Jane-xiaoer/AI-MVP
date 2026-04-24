
import { GoogleGenAI, Modality } from "@google/genai";
import { EditOptions } from '../types';
import { resizeArtworkToMatchRoom } from '../utils/imageUtils';

function fileToGenerativePart(base64: string) {
    const PURE_BASE64_REGEX = /^data:image\/(?:jpeg|png|webp|gif);base64,(.*)$/;
    const match = base64.match(PURE_BASE64_REGEX);
    if (!match) {
        throw new Error("无效的 base64 图像格式");
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

const SINGLE_ARTWORK_PROMPT = `## 任务：替换艺术品
你的任务是精确地将【图像 1】墙壁上的所有旧艺术品替换为所提供的 1 件新艺术品。

## 输入图像
- **图像 1**: 室内背景。
- **图像 2**: 1 件新艺术品。

## ⚠️ 关于新艺术品图像的重要说明
为了匹配画幅，新艺术品图像可能在其周围添加了**透明边距**。
**你的任务是完全忽略这些透明区域。** 只操作图像中**实际可见、不透明的艺术品本身**。

## 核心指令
1.  **移除旧艺术品**: 识别并彻底移除【图像 1】墙上的所有现有画作、海报和装饰品。使用周围的墙壁纹理进行无缝修复，确保墙壁看起来干净、无痕迹。
2.  **放置新艺术品**: 将提供的**这 1 件新艺术品**布置在清理干净的墙面上，为它添加一个简约的黑色细画框。

## 绝对规则 (必须严格遵守)
1.  **数量必须为一**: 这是最重要的规则。最终图像中**必须**有且只有 **1** 件艺术品。墙上不能留有任何旧艺术品。
2.  **保持艺术品原样**:
    *   **内容**: 禁止修改新艺术品的内部内容或颜色。
    *   **形状**: 必须保持新艺术品原始的长宽比。禁止拉伸或扭曲。
3.  **背景不可修改**: 你的操作范围严格限制在墙壁区域。**绝对禁止**修改房间内的任何家具（沙发、桌子、灯等）、植物或窗户。
4.  **画幅保持不变**: 输出图像的尺寸必须与【图像 1】完全相同。禁止裁剪或改变画幅。
5.  **再次强调**: 必须同时满足以下三点：(1) 保持艺术作品的画面内容不变。(2) 保持艺术作品的原始长宽比。(3) 保持原始空间照片的画幅、家居等所有物品不变。

## 最终输出
- 只输出修改后的图像，不含任何文字。`;

export const placeArtworkInRoom = async (roomImageBase64: string, artImageBase64s: string[]): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("未配置 Gemini API Key。请联系应用管理员。");
  }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const roomPart = fileToGenerativePart(roomImageBase64);
    const artParts = artImageBase64s.map(art => fileToGenerativePart(art));
    
    const prompt = SINGLE_ARTWORK_PROMPT;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: [ roomPart, ...artParts, { text: prompt } ] },
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error('AI 模型没有生成图像。模型可能返回了文本：' + response.text);

  } catch (error) {
    console.error("调用 Gemini API 时出错：", error);
    throw new Error("生成图像失败。API Key 可能无效或服务暂时不可用。");
  }
};

const buildEditPrompt = (options: Omit<EditOptions, 'baseImage'>): string => {
  let prompt = `## 角色
你是一个精确的图像编辑 AI。你的任务是根据用户的指令修改一张已有的图片。你必须严格遵守指令，并且只修改被要求修改的部分，图像的其余部分必须保持绝对不变。

## 输入
1.  **基础图像**: 一张室内挂有艺术品的图片。
2.  **新艺术品**: (可选) 用于替换基础图像中现有艺术品的新图像。
3.  **遮罩图像**: (可选) 一张黑白图片，白色区域是你需要重点关注和修改的区域。
4.  **用户指令**: (可选) 一段描述修改需求的文字。

## 核心任务
根据以下提供的指令，修改基础图像。`;

  if (options.newArtworkImage) {
    prompt += `\n\n### 艺术品替换指令\n用提供的新艺术品图像，替换掉基础图像中墙上悬挂的所有艺术品。请保持新艺术品的原始长宽比和内容。如果装裱指令中未指定画框，请为它添加一个简约的黑色细画框。`;
  }

  if (options.textPrompt) {
    prompt += `\n\n### 文字指令\n"${options.textPrompt}"`;
    if (options.maskImage) {
      prompt += `\n此指令主要应用于遮罩图像中的白色高亮区域。`;
    }
  }

  if (options.frameMaterial || options.mountingMethod || options.glazingType || options.frameColor) {
      prompt += `\n\n### 装裱指令\n对图中的艺术品应用以下装裱规格：`;
      if (options.frameMaterial) {
          prompt += `\n- **画框材质**: 统一更换为 **${options.frameMaterial}** 风格。`;
      }
      if (options.frameColor) {
          prompt += `\n- **画框颜色**: 统一采用 **${options.frameColor}**。`;
      }
      if (options.mountingMethod) {
          prompt += `\n- **装裱方式**: 统一采用 **${options.mountingMethod}**。`;
      }
      if (options.glazingType) {
          prompt += `\n- **防护类型**: 统一使用 **${options.glazingType}** 进行防护。`;
      }
  }
  
  prompt += `

## 🚨 绝对核心指令 (MUST FOLLOW - NON-NEGOTIABLE)
1.  **最小化修改原则**: 只修改被明确要求修改的内容。如果指令是更换画框，那么除了画框之外，房间的任何其他部分（包括家具、墙壁颜色、光照、艺术品本身）都绝对不许改变。
2.  **背景神圣不可侵犯**: **绝对禁止** 以任何方式修改、替换或重新绘制房间内的任何家具、植物、窗户、门或任何非墙面物体。这些物体是不可编辑的。
3.  **画幅保持一致**: 输出图像的长宽比必须与基础图像完全相同。

## 输出格式
- 仅输出编辑后的图像文件。
- 无任何文字。`;

  return prompt;
};


export const editArtworkInRoom = async (options: EditOptions): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("未配置 Gemini API Key。请联系应用管理员。");
  }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const parts: any[] = [];

    parts.push(fileToGenerativePart(options.baseImage));

    if (options.newArtworkImage) {
      const paddedArt = await resizeArtworkToMatchRoom(options.baseImage, options.newArtworkImage);
      parts.push(fileToGenerativePart(paddedArt));
    }
    
    if (options.maskImage) {
      parts.push(fileToGenerativePart(options.maskImage));
    }
    
    const { baseImage, ...promptOptions } = options;
    const prompt = buildEditPrompt(promptOptions);
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error('AI 模型未能编辑图像。模型可能返回了文本：' + response.text);

  } catch (error) {
    console.error("调用 Gemini API 进行编辑时出错：", error);
    throw new Error("编辑图像失败。API Key 可能无效或服务暂时不可用。");
  }
};
