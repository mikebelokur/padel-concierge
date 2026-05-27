type Props = {
  memberNumber?: number | null;
  badge?: string | null;
  size?: "sm" | "md";
};

export function isFoundingMember(memberNumber?: number | null, badge?: string | null) {
  return memberNumber === 1 || badge === "founding_member";
}

export function FoundingMemberPill({ memberNumber, badge, size = "sm" }: Props) {
  if (!isFoundingMember(memberNumber, badge)) return null;
  const num = memberNumber ?? 1;
  const padded = String(num).padStart(3, "0");
  return (
    <span
      className={`inline-flex items-center font-mono font-semibold rounded-full ${
        size === "md" ? "px-2 py-0.5 text-xs" : "px-1.5 py-px text-[10px]"
      }`}
      style={{
        color: "#D4AF37",
        background: "rgba(212,175,55,0.10)",
        border: "1px solid rgba(212,175,55,0.40)",
        letterSpacing: "0.05em",
      }}
      title="Founding Member"
    >
      #{padded}
    </span>
  );
}

export function foundingAvatarStyle(memberNumber?: number | null, badge?: string | null) {
  if (!isFoundingMember(memberNumber, badge)) return undefined;
  return {
    boxShadow: "0 0 0 1.5px #D4AF37",
  } as React.CSSProperties;
}

export function FoundingMemberRibbon() {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{
        color: "#0a0a0a",
        background: "linear-gradient(135deg, #D4AF37, #b8941f)",
        boxShadow: "0 2px 8px rgba(212,175,55,0.25)",
      }}
    >
      <span>★</span>
      <span>Founding Member</span>
    </div>
  );
}
