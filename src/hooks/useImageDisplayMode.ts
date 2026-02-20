import { useState } from 'react';

export type ImageDisplayMode = 'blurred' | 'full';

const STORAGE_KEY = 'hu_image_display_mode';

export function useImageDisplayMode() {
  const [mode, setMode] = useState<ImageDisplayMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'full' ? 'full' : 'blurred';
  });

  const toggle = () => {
    const next: ImageDisplayMode = mode === 'blurred' ? 'full' : 'blurred';
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return { mode, toggle };
}
