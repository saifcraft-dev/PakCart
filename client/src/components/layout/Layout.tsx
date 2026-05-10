import React, { lazy, Suspense, useEffect, useState } from 'react';
import Header from './Header';
import Footer from './Footer';
import AnnouncementBanner from './AnnouncementBanner';
import MobileBottomNav from './MobileBottomNav';

const AnnouncementPopup = lazy(() => import('./AnnouncementPopup'));
const AIChatWidget = lazy(() => import('@/components/AIChatWidget'));

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [deferredReady, setDeferredReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onIdle = () => setDeferredReady(true);
    const ric = (window as any).requestIdleCallback;
    if (typeof ric === 'function') {
      const id = ric(onIdle, { timeout: 3000 });
      return () => {
        const cic = (window as any).cancelIdleCallback;
        if (typeof cic === 'function') cic(id);
      };
    }
    const timer = window.setTimeout(onIdle, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AnnouncementBanner />
      <Header />
      <main className="flex-1 pb-16 lg:pb-0">{children}</main>
      <div className="hidden lg:block">
        <Footer />
      </div>
      <MobileBottomNav />
      {deferredReady && (
        <Suspense fallback={null}>
          <AnnouncementPopup />
          <AIChatWidget />
        </Suspense>
      )}
    </div>
  );
};

export default Layout;
