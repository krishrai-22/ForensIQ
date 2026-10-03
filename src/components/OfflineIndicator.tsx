/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [prevOnline, setPrevOnline] = useState(isOnline);

  useEffect(() => {
    if (!prevOnline && isOnline) {
      // Just reconnected
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(timer);
    }
    setPrevOnline(isOnline);
  }, [isOnline, prevOnline]);

  if (showReconnected) {
    return (
      <div className="fixed bottom-16 sm:bottom-4 left-4 z-40 flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-md">
        <Wifi className="w-3.5 h-3.5 text-slate-700" />
        <span>Back online &bull; Ready to sync</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed bottom-16 sm:bottom-4 left-4 z-40 flex items-center gap-2 rounded-md bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-medium text-white shadow-md">
        <WifiOff className="w-3.5 h-3.5 text-slate-300" />
        <span>Offline Mode &bull; Local capture active</span>
      </div>
    );
  }

  return null;
};
