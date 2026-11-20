import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as Icons from "lucide-react";

const catalog = {
  basic:"Footprints",sprout:"Sprout",acorn:"Nut",clover:"Clover",sun:"Sun",moon:"MoonStar",flower:"Flower2",cloud:"CloudSun",leaf:"Leaf",coffee:"Coffee",bread:"Croissant",heart:"Heart",star:"Star",cat:"Cat",dog:"Dog",rabbit:"Rabbit",squirrel:"Squirrel",cherry:"Cherry",lemon:"Citrus",tulip:"Flower",maple:"MapleLeaf",snow:"Snowflake",umbrella:"Umbrella",rainbow:"Rainbow",butterfly:"BugPlay",bee:"Bug",ladybug:"BugOff",whale:"Waves",dolphin:"FishSymbol",penguin:"Bird",fox:"Origami",owl:"Bird",panda:"CircleDotDashed",unicorn:"Sparkle",rocket:"Rocket",planet:"Orbit",comet:"Telescope",crystal:"Gem",crown:"Crown",fire:"Flame",purple_heart:"HeartHandshake",blue_heart:"HeartPulse",magic:"WandSparkles",artist:"Palette",music:"Music2",trophy:"Trophy",medal:"Medal",galaxy:"Atom",phoenix:"Feather",royal_squirrel:"BadgeCent",aurora_crown:"Crown",modudadam_master:"BadgeCheck",
  operator_guardian:"ShieldCheck",operator_starseed:"BadgePlus",operator_master:"ShieldEllipsis",
  reward_sprout_keeper:"TreePine",reward_daily_collector:"LibraryBig",reward_rare_explorer:"Compass",reward_heroic_archivist:"Award",reward_legend_keeper:"ShieldHalf",reward_dadam_grandmaster:"BadgeCheck",
  kindness_100:"Heart",kindness_500:"HeartHandshake",kindness_1000:"Handshake",kindness_5000:"HeartCrack",kindness_10000:"Sparkles",
  misdeed_100:"CircleAlert",misdeed_500:"TriangleAlert",misdeed_1000:"ScanEye",misdeed_5000:"ShieldAlert",misdeed_10000:"Skull",
};
const rarities = {
  uncommon:["basic","sprout","acorn","clover","sun","moon","flower","cloud","leaf","coffee","bread","heart","star","cat","dog","rabbit","squirrel","cherry","lemon","reward_sprout_keeper","kindness_100","misdeed_100"],
  common:["tulip","maple","snow","umbrella","rainbow","butterfly","bee","ladybug","whale","dolphin","penguin","reward_daily_collector","kindness_500","misdeed_500"],
  rare:["fox","owl","panda","unicorn","rocket","planet","comet","crystal","crown","fire","reward_rare_explorer","kindness_1000","misdeed_1000"],
  epic:["purple_heart","blue_heart","magic","artist","music","trophy","medal","reward_heroic_archivist"],
  legendary:["galaxy","phoenix","royal_squirrel","reward_legend_keeper","kindness_5000","misdeed_5000"],
  mythic:["aurora_crown","modudadam_master","reward_dadam_grandmaster","kindness_10000","misdeed_10000"],
  operator:["operator_guardian","operator_starseed","operator_master"],
};
const baseHues={ uncommon:148,common:216,rare:265,epic:310,legendary:32,mythic:335,operator:220 };
const directory=join(process.cwd(),"public","brand","stamps","catalog","v3");
await mkdir(directory,{ recursive:true });
for (const [rarity,codes] of Object.entries(rarities)) {
  for (const code of codes) {
    const themedHue=code.startsWith("kindness_")?38:code.startsWith("misdeed_")?352:baseHues[rarity];
    const hue=(themedHue+hash(code)%25-12+360)%360;
    const operator=rarity==="operator";
    const dark=operator?"#08152f":`hsl(${hue} 78% 25%)`;const middle=operator?"#31569b":`hsl(${hue} 84% 47%)`;const light=operator?"#ffe59a":`hsl(${(hue+18)%360} 94% 76%)`;const glow=operator?"#ffd45c":`hsl(${(hue+35)%360} 100% 70%)`;
    const iconColor=["legendary","mythic","operator"].includes(rarity)?"#fff3a3":"#ffffff";
    const Icon=Icons[catalog[code]] || Icons.Badge;const id=`g-${code.replaceAll("_","-")}`;
    const icon=renderToStaticMarkup(createElement(Icon,{ strokeWidth:2.15,color:iconColor })).replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,"");
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${code}"><defs><linearGradient id="${id}" x1="7" y1="5" x2="57" y2="59"><stop stop-color="${light}"/><stop offset=".48" stop-color="${middle}"/><stop offset="1" stop-color="${dark}"/></linearGradient><radialGradient id="${id}-core"><stop stop-color="${middle}"/><stop offset="1" stop-color="${dark}"/></radialGradient><filter id="${id}-shadow"><feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="${middle}" flood-opacity=".72"/></filter><filter id="${id}-glow"><feDropShadow dx="0" dy="0" stdDeviation="1.6" flood-color="${iconColor}" flood-opacity=".98"/></filter></defs>${frameFor(rarity,id,glow,iconColor)}<circle cx="32" cy="32" r="15.5" fill="url(#${id}-core)" stroke="${iconColor}" stroke-opacity=".72" stroke-width="1.4"/><g transform="translate(14 14) scale(1.5)" fill="none" stroke="${iconColor}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}-glow)">${icon}</g></svg>`;
    await writeFile(join(directory,`${rarity}-${code}.svg`),svg,"utf8");
  }
}

function hash(value) { return [...value].reduce((total,character)=>((total*31)+character.charCodeAt(0))>>>0,0); }
function frameFor(rarity,id,glow,iconColor) {
  const common=`fill="url(#${id})" stroke="${glow}" filter="url(#${id}-shadow)"`;
  if (rarity==="uncommon") return `<path d="M32 4 55 16v26L32 60 9 48V16Z" ${common} stroke-width="2"/><path d="M32 9 50 19v20L32 54 14 45V19Z" fill="#fff" fill-opacity=".16"/>`;
  if (rarity==="common") return `<path d="M32 2 55 11v23c0 14-9 23-23 28C18 57 9 48 9 34V11Z" ${common} stroke-width="2.3"/><path d="M32 8 49 15v18c0 10-6 18-17 23-11-5-17-13-17-23V15Z" fill="#fff" fill-opacity=".17"/>`;
  if (rarity==="rare") return `<path d="M32 1 52 9 63 32 52 55 32 63 12 55 1 32 12 9Z" ${common} stroke-width="2.4"/><path d="M32 7 48 14 57 32 48 50 32 57 16 50 7 32 16 14Z" fill="#fff" fill-opacity=".16"/><path d="M32 2v7M62 32h-7M32 62v-7M2 32h7" stroke="${iconColor}" stroke-width="2"/>`;
  if (rarity==="epic") return `<path d="M24 16C15 10 8 11 2 16c8 2 10 7 13 12-6-1-10 1-13 5 8 1 13 5 19 10M40 16c9-6 16-5 22 0-8 2-10 7-13 12 6-1 10 1 13 5-8 1-13 5-19 10" fill="url(#${id})" stroke="${glow}" stroke-width="2"/><path d="M32 3 53 17l-4 28-17 16-17-16-4-28Z" ${common} stroke-width="2.5"/><path d="M32 9 47 20l-3 22-12 12-12-12-3-22Z" fill="#fff" fill-opacity=".17"/><circle cx="9" cy="17" r="2" fill="${iconColor}"/><circle cx="55" cy="17" r="2" fill="${iconColor}"/>`;
  if (rarity==="legendary") return `<path d="m32 1 6 8 10-4 2 10 10 2-4 10 7 5-7 6 4 10-10 2-2 10-10-4-6 7-6-7-10 4-2-10-10-2 4-10-7-6 7-5-4-10 10-2 2-10 10 4Z" ${common} stroke-width="2.2"/><circle cx="32" cy="32" r="23" fill="#fff" fill-opacity=".12" stroke="${iconColor}" stroke-opacity=".65"/><circle cx="32" cy="32" r="19" fill="none" stroke="${iconColor}" stroke-opacity=".45" stroke-dasharray="2 3"/>`;
  if (rarity==="mythic") return `<ellipse cx="32" cy="32" rx="30" ry="16" fill="none" stroke="${glow}" stroke-width="2" transform="rotate(-22 32 32)"/><ellipse cx="32" cy="32" rx="30" ry="16" fill="none" stroke="${iconColor}" stroke-opacity=".6" transform="rotate(22 32 32)"/><path d="m32 1 5 8 9-5 1 10 11-1-5 9 9 5-8 6 7 8-10 2 3 10-10-2-2 11-8-7-7 7-3-10-10 2 2-10-10-2 7-8-8-6 9-5-5-9 11 1 1-10 9 5Z" ${common} stroke-width="2.2"/><path d="M22 10 27 3l5 7 5-7 5 7" fill="none" stroke="${iconColor}" stroke-width="2.2"/><circle cx="6" cy="25" r="2.2" fill="${iconColor}"/><circle cx="58" cy="39" r="2.2" fill="${iconColor}"/>`;
  return `<path d="M20 17 10 9 3 15l12 14C8 29 4 32 2 37c8 0 13 4 19 9M44 17l10-8 7 6-12 14c7 0 11 3 13 8-8 0-13 4-19 9" fill="url(#${id})" stroke="${glow}" stroke-width="2"/><path d="M17 13 24 5l8 8 8-8 7 8 8-4-5 14v21c-4 9-10 14-18 18-8-4-14-9-18-18V23L9 9Z" ${common} stroke-width="2.4"/><path d="M20 21h24v20c-3 7-7 11-12 14-5-3-9-7-12-14Z" fill="#fff" fill-opacity=".16" stroke="${iconColor}" stroke-opacity=".75"/><circle cx="32" cy="7" r="3" fill="${iconColor}"/>`;
}
