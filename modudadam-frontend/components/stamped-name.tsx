export function StampedName({ name, stamp, className = "", full = false }: { name: string; stamp?: string | null; className?: string; full?: boolean }) {
  return <span className={`stamped-name ${className}`.trim()} style={full ? { maxWidth:"none",overflow:"visible",flexShrink:0 } : undefined}>
    {stamp && <span className={`stamped-name-mark ${stampEffect(stamp)}`} aria-label="대표 스탬프">{stamp}</span>}
    <span className="stamped-name-text" style={full ? { overflow:"visible",textOverflow:"clip" } : undefined}>{name}</span>
  </span>;
}

function stampEffect(stamp: string) {
  if (["🛡️","⚜️","🦉"].includes(stamp)) return "stamp-effect-operator";
  if (["🌈👑","👑✨🌰","🌌👑"].includes(stamp)) return "stamp-effect-mythic";
  if (["🌌","🔥🪽","👑🐿️","👑✨"].includes(stamp)) return "stamp-effect-legendary";
  if (["💜","💙","✨","🎨","🎵","🏆","🏅","🏆✨"].includes(stamp)) return "stamp-effect-epic";
  return "";
}
