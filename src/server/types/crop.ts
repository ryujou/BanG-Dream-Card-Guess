export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  w: number;
  h: number;
}

export interface FaceBox extends Rect {
  conf: number;
  cls: number | null;
  label: string;
}

export interface CropResult extends Point {
  size?: number;
  image?: string;
  [key: string]: unknown;
}

export interface ScoredCrop extends Point {
  score: number;
}

export interface JimpLikeImage {
  bitmap: {
    width: number;
    height: number;
    data: Buffer;
  };
  clone(): {
    crop(options: Rect): {
      getBuffer(mime: string): Promise<Buffer>;
    };
  };
}
