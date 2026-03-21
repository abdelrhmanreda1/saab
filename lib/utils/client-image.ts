'use client';

export interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: Required<OptimizeImageOptions> = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
};

const PASSTHROUGH_TYPES = new Set([
  'image/svg+xml',
  'image/gif',
  'image/webp',
]);

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image for optimization'));
    image.src = src;
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to convert canvas to blob'));
          return;
        }

        resolve(blob);
      },
      type,
      quality
    );
  });

export const optimizeImageForUpload = async (
  file: File,
  options: OptimizeImageOptions = {}
): Promise<File> => {
  const normalizedOptions = { ...DEFAULT_OPTIONS, ...options };

  if (!file.type.startsWith('image/')) {
    return file;
  }

  if (PASSTHROUGH_TYPES.has(file.type)) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    const widthRatio = normalizedOptions.maxWidth / image.width;
    const heightRatio = normalizedOptions.maxHeight / image.height;
    const resizeRatio = Math.min(1, widthRatio, heightRatio);

    const targetWidth = Math.max(1, Math.round(image.width * resizeRatio));
    const targetHeight = Math.max(1, Math.round(image.height * resizeRatio));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const optimizedBlob = await canvasToBlob(
      canvas,
      'image/webp',
      normalizedOptions.quality
    );

    const optimizedName = file.name.replace(/\.[^.]+$/, '') || 'image';
    const optimizedFile = new File([optimizedBlob], `${optimizedName}.webp`, {
      type: 'image/webp',
    });

    return optimizedFile.size < file.size ? optimizedFile : file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
