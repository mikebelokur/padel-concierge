import { useEffect, useRef, useState } from "react";

export function usePullToRefresh(
  onRefresh: () => Promise<unknown> | void,
  threshold = 72,
) {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const touchStartY = useRef<number | null>(null);
  const currentPullY = useRef(0);
  const isPulling = useRef(false);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    function getScrollTop(): number {
      const main = document.querySelector("main");
      return main ? main.scrollTop : window.scrollY;
    }

    function onTouchStart(e: TouchEvent) {
      if (isRefreshingRef.current) return;
      if (getScrollTop() > 2) return;
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (touchStartY.current === null || isRefreshingRef.current) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy <= 0) {
        currentPullY.current = 0;
        isPulling.current = false;
        setPullY(0);
        return;
      }
      isPulling.current = true;
      const damped = Math.min(dy * 0.42, threshold * 1.6);
      currentPullY.current = damped;
      setPullY(damped);
      if (dy > 8) e.preventDefault();
    }

    function onTouchEnd() {
      if (touchStartY.current === null) return;
      touchStartY.current = null;

      if (isPulling.current && currentPullY.current >= threshold * 0.58) {
        isPulling.current = false;
        currentPullY.current = 0;
        setPullY(0);
        isRefreshingRef.current = true;
        setIsRefreshing(true);
        Promise.resolve(onRefreshRef.current()).finally(() => {
          isRefreshingRef.current = false;
          setIsRefreshing(false);
        });
      } else {
        isPulling.current = false;
        currentPullY.current = 0;
        setPullY(0);
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [threshold]);

  return { pullY, isRefreshing };
}
