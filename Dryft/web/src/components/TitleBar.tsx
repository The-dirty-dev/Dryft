'use client';

import { useEffect, useState } from 'react';
import {
  isElectron,
  getPlatform,
  minimizeWindow,
  maximizeWindow,
  closeWindow,
  onUpdateDownloaded,
  installUpdate,
} from '@/lib/electron';

export default function TitleBar() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [platform, setPlatform] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    setIsDesktop(isElectron());
    setPlatform(getPlatform());

    // Listen for updates
    onUpdateDownloaded(() => {
      setUpdateReady(true);
    });
  }, []);

  // Only render on desktop (non-macOS, since macOS uses native title bar)
  if (!isDesktop || platform === 'darwin') {
    return null;
  }

  const handleUpdate = () => {
    installUpdate();
  };

  return (
    <div className="h-8 bg-surface flex items-center justify-between select-none app-drag">
      {/* App title */}
      <div className="flex items-center gap-2 px-4">
        <span className="text-primary font-bold text-sm">Dryft</span>
      </div>

      {/* Update banner */}
      {updateReady && (
        <button
          onClick={handleUpdate}
          className="px-3 py-1 bg-primary/20 text-primary text-xs rounded hover:bg-primary/30 app-no-drag"
        >
          Update Ready - Click to Install
        </button>
      )}

      {/* Window controls */}
      <div className="flex app-no-drag">
        <button
          onClick={minimizeWindow}
          className="w-12 h-8 flex items-center justify-center hover:bg-white/10 transition-colors"
          title="Minimize"
        >
          <svg className="w-4 h-4 text-muted" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 13H5v-2h14v2z" />
          </svg>
        </button>
        <button
          onClick={maximizeWindow}
          className="w-12 h-8 flex items-center justify-center hover:bg-white/10 transition-colors"
          title="Maximize"
        >
          <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="1" strokeWidth="2" />
          </svg>
        </button>
        <button
          onClick={closeWindow}
          className="w-12 h-8 flex items-center justify-center hover:bg-red-500 transition-colors group"
          title="Close"
        >
          <svg className="w-4 h-4 text-muted group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
