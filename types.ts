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