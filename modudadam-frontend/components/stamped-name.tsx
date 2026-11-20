import Image from "next/image";

export function StampedName({ name, stamp, className = "", full = false }: { name: string; stamp?: string | null; className?: string; full?: boolean }) {
  return <span className={`stamped-name ${className}`.trim()} style={full ? { maxWidth:"none",overflow:"visible",flexShrink:0 } : undefined}>
    {stamp && <StampMark stamp={stamp}/>}
    <span className="stamped-name-text" style={full ? { overflow:"visible",textOverflow:"clip" } : undefined}>{name}</span>
  </span>;
}
export function StampMark({ stamp, className="" }: { stamp:string;className?:string }) {
  const image=stamp.startsWith("/");
  return <span className={`stamped-name-mark ${stampEffect(stamp)} ${image ? "stamp-image-mark" : ""} ${className}`.trim()} aria-label="대표 스탬프">
    {image ? <Image src={stamp} alt="" aria-hidden="true" width={32} height={32}/> : stamp}
  </span>;
}

function stampEffect(stamp: string) {
  if (stamp.includes("kindness_10000")) return "stamp-effect-mythic stamp-prestige-kindness stamp-prestige-final";
  if (stamp.includes("kindness_5000")) return "stamp-effect-legendary stamp-prestige-kindness";
  if (stamp.includes("misdeed_10000")) return "stamp-effect-mythic stamp-prestige-misdeed stamp-prestige-final";
  if (stamp.includes("misdeed_5000")) return "stamp-effect-legendary stamp-prestige-misdeed";
  if (stamp.includes("operator_guardian")) return "stamp-effect-operator stamp-operator-guardian";
  if (stamp.includes("operator_starseed")) return "stamp-effect-operator stamp-operator-starseed";
  if (stamp.includes("operator_master")) return "stamp-effect-operator stamp-operator-master";
  if (stamp.includes("/operator-")) return "stamp-effect-operator";
  if (stamp.includes("/mythic-")) return "stamp-effect-mythic";
  if (stamp.includes("/legendary-")) return "stamp-effect-legendary";
  if (stamp.includes("/epic-")) return "stamp-effect-epic";
  if (stamp.includes("tier-operator")) return "stamp-effect-operator";
  if (stamp.includes("reputation-warning")) return "stamp-effect-warning";
  if (stamp.includes("reputation-kind") || stamp.includes("tier-mythic")) return "stamp-effect-mythic";
  if (stamp.includes("tier-legendary")) return "stamp-effect-legendary";
  if (stamp.includes("tier-epic")) return "stamp-effect-epic";
  if (["🛡️","⚜️","🦉"].includes(stamp)) return "stamp-effect-operator";
  if (["🌈👑","👑✨🌰","🌌👑"].includes(stamp)) return "stamp-effect-mythic";
  if (["🌌","🔥🪽","👑🐿️","👑✨"].includes(stamp)) return "stamp-effect-legendary";
  if (["💜","💙","✨","🎨","🎵","🏆","🏅","🏆✨"].includes(stamp)) return "stamp-effect-epic";
  return "";
}
