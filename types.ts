
export interface Artwork {
  id: number | string;
  title: string;
  artist: string;
  imageUrl: string;
}

export enum AppStep {
  UPLOAD_HOME,
  SELECT_ART,
  GENERATING,
  RESULT,
}

export type Language = 'en' | 'zh';

export interface EditOptions {
  baseImage: string;
  textPrompt?: string;
  frameMaterial?: string;
  mountingMethod?: string;
  glazingType?: string;
  frameColor?: string;
  maskImage?: string;
  newArtworkImage?: string;
}