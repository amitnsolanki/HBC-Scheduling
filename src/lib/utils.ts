import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getLevelColorHex = (level?: string) => {
  switch (level) {
    case 'National': return '#000000'; // Black
    case 'Advanced': return '#EF4444'; // Red-500
    case 'Intermediate-Advanced': return '#F97316'; // Orange-500
    case 'Intermediate': return '#22C55E'; // Green-500
    case 'Intermediate-Beginner': return '#EAB308'; // Yellow-500
    case 'Beginner': return '#3B82F6'; // Blue-500
    default: return '#64748B'; // Slate-500
  }
};

export const getLevelTextColorClass = (level?: string) => {
  switch (level) {
    case 'National': return 'text-black font-bold';
    case 'Advanced': return 'text-red-500 font-bold';
    case 'Intermediate-Advanced': return 'text-orange-500 font-bold';
    case 'Intermediate': return 'text-green-500 font-bold';
    case 'Intermediate-Beginner': return 'text-yellow-500 font-bold';
    case 'Beginner': return 'text-blue-500 font-bold';
    default: return 'text-slate-500 font-bold';
  }
};

export function compressImage(file: File, maxWidth = 400, maxHeight = 400, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
