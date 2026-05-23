interface Props {
  pullY: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({ pullY, isRefreshing, threshold = 72 }: Props) {
  const progress = Math.min(pullY / (threshold * 0.58), 1);
  const arrowRotate = progress * 180;
  const visible = pullY > 4 || isRefreshing;

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: 50,
        height: "52px",
        transform: `translateY(${isRefreshing ? 12 : pullY * 0.7 - 12}px)`,
        transition: isRefreshing ? "transform 0.38s cubic-bezier(0.34,1.56,0.64,1)" : "none",
        opacity: Math.min(progress * 2, 1),
      }}
    >
      <div
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "50%",
          background: "hsl(220 20% 10%)",
          border: "1px solid rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        }}
      >
        {isRefreshing ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            style={{
              animation: "ptr-spin 0.75s linear infinite",
            }}
          >
            <circle
              cx="9"
              cy="9"
              r="7"
              stroke="#D4AF37"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="30 14"
            />
            <style>{`@keyframes ptr-spin { to { transform: rotate(360deg); } }`}</style>
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            style={{
              transform: `rotate(${arrowRotate}deg)`,
              transition: "transform 0.18s ease",
              color: progress >= 1 ? "#D4AF37" : "rgba(255,255,255,0.5)",
            }}
          >
            <path
              d="M8 3v10M8 13l-4-4M8 13l4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
