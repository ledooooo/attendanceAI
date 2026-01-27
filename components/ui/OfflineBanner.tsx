// src/components/ui/OfflineBanner.tsx
import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  if (isOnline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white text-center py-3 z-50 flex items-center justify-center gap-2 font-bold shadow-lg animate-in slide-in-from-bottom">
      <WifiOff className="w-5 h-5" />
      <span className="text-sm">أنت غير متصل بالإنترنت. البيانات المعروضة قد تكون قديمة ولا يمكنك الحفظ الآن.</span>
    </div>
  );
}
