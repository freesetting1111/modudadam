import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as Icons from "lucide-react";

const catalog = {
  basic:"Footprints",sprout:"Sprout",acorn:"Nut",clover:"Clover",sun:"Sun",moon:"MoonStar",flower:"Flower2",cloud:"CloudSun",leaf:"Leaf",coffee:"Coffee",bread:"Croissant",heart:"Heart",star:"Star",cat:"Cat",dog:"Dog",rabbit:"Rabbit",squirrel:"Squirrel",cherry:"Cherry",lemon:"Citrus",tulip:"Flower",maple:"MapleLeaf",snow:"Snowflake",umbrella:"Umbrella",rainbow:"Rainbow",butterfly:"BugPlay",bee:"Bug",ladybug:"BugOff",whale:"Waves",dolphin:"FishSymbol",penguin:"Bird",fox:"Origami",owl:"Bird",panda:"CircleDotDashed",unicorn:"Sparkle",rocket:"Rocket",planet:"Orbit",comet:"Telescope",crystal:"Gem",crown:"Crown",fire:"Flame",purple_heart:"HeartHandshake",blue_heart:"HeartPulse",magic:"WandSparkles",artist:"Palette",music:"Music2",trophy:"Trophy",medal:"Medal",galaxy:"Atom",phoenix:"Feather",royal_squirrel:"Squirrel",aurora_crown:"Crown",modudadam_master:"Squirrel",
  operator_guardian:"ShieldCheck",operator_starseed:"BadgePlus",operator_master:"ShieldEllipsis",
  reward_sprout_keeper:"TreePine",reward_daily_collector:"CalendarCheck2",reward_rare_explorer:"Compass",reward_heroic_archivist:"BookOpenCheck",reward_legend_keeper:"ShieldHalf",reward_dadam_grandmaster:"Gem",
  kindness_100:"Heart",kindness_500:"HeartHandshake",kindness_1000:"Handshake",kindness_5000:"Heart",kindness_10000:"Sparkles",
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
const palettes={
  uncommon:{ edge:"#34745f",faceA:"#f8fcfa",faceB:"#cce7dc",coreA:"#ffffff",coreB:"#e3f2ec",icon:"#245747",accent:"#6fc1a0",shadow:"#245747" },
  common:{ edge:"#315f9d",faceA:"#f6f9ff",faceB:"#cbdcf3",coreA:"#ffffff",coreB:"#e5eefb",icon:"#294f82",accent:"#72a1de",shadow:"#274a77" },
  rare:{ edge:"#6846a9",faceA:"#fbf8ff",faceB:"#d8c9f2",coreA:"#ffffff",coreB:"#eee7fb",icon:"#503188",accent:"#9c7bd2",shadow:"#462b78" },
  epic:{ edge:"#d16bb5",faceA:"#3b275e",faceB:"#20183f",coreA:"#4c2e70",coreB:"#251942",icon:"#fff8ff",accent:"#ff8ad2",shadow:"#1c1038" },
  legendary:{ edge:"#d4a438",faceA:"#28230f",faceB:"#11151f",coreA:"#3b3114",coreB:"#171923",icon:"#ffe596",accent:"#f6c44f",shadow:"#17120a" },
  mythic:{ edge:"#9b72ef",faceA:"#251744",faceB:"#0f1732",coreA:"#38215d",coreB:"#141a36",icon:"#fffaff",accent:"#62dfd3",shadow:"#0d1028" },
  operator:{ edge:"#f2c85c",faceA:"#192b4a",faceB:"#080f20",coreA:"#233e68",coreB:"#0b1529",icon:"#fff0a8",accent:"#60d9f2",shadow:"#050a14" },
};
const directory=join(process.cwd(),"public","brand","stamps","catalog","v8");
await mkdir(directory,{ recursive:true });
for (const [rarity,codes] of Object.entries(rarities)) {
  for (const code of codes) {
    const palette=palettes[rarity];
    const id=`s8-${code.replaceAll("_","-")}`;
    const themeAccent=code.startsWith("kindness_")?"#f0b83f":code.startsWith("misdeed_")?"#e55472":`hsl(${hash(code)%360} 58% 55%)`;
    const iconColor=code.startsWith("kindness_")&&!["epic","legendary","mythic","operator"].includes(rarity)?"#805712":code.startsWith("misdeed_")&&!["epic","legendary","mythic","operator"].includes(rarity)?"#8f2940":palette.icon;
    const Icon=Icons[catalog[code]] || Icons.Badge;
    const icon=renderToStaticMarkup(createElement(Icon,{ strokeWidth:2.35,color:iconColor })).replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,"");
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" role="img" aria-label="${code}"><defs><linearGradient id="${id}-face" x1="12" y1="7" x2="68" y2="73"><stop stop-color="${palette.faceA}"/><stop offset="1" stop-color="${palette.faceB}"/></linearGradient><linearGradient id="${id}-core" x1="25" y1="22" x2="57" y2="61"><stop stop-color="${palette.coreA}"/><stop offset="1" stop-color="${palette.coreB}"/></linearGradient><linearGradient id="${id}-theme" x1="16" y1="12" x2="65" y2="68"><stop stop-color="${palette.accent}"/><stop offset="1" stop-color="${themeAccent}"/></linearGradient><filter id="${id}-shadow" x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="${palette.shadow}" flood-opacity=".34"/></filter><filter id="${id}-icon" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="1" stdDeviation=".65" flood-color="${palette.shadow}" flood-opacity=".28"/></filter></defs>${frameFor(rarity,id,palette,themeAccent)}<path d="M40 22.5c10.2 0 18.5 7.8 18.5 17.5S50.2 57.5 40 57.5 21.5 49.7 21.5 40 29.8 22.5 40 22.5Z" fill="url(#${id}-core)" stroke="${palette.edge}" stroke-opacity=".82" stroke-width="1.5"/><path d="M27 28c5-5 17-7 25 0" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/><g transform="translate(22 22) scale(1.5)" fill="none" stroke="${iconColor}" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}-icon)">${icon}</g>${signatureFor(code,themeAccent,palette.icon)}</svg>`;
    await writeFile(join(directory,`${rarity}-${code}.svg`),svg,"utf8");
  }
}

function hash(value) { return [...value].reduce((total,character)=>((total*31)+character.charCodeAt(0))>>>0,0); }
function frameFor(rarity,id,palette,themeAccent) {
  const face=`fill="url(#${id}-face)" stroke="${palette.edge}" filter="url(#${id}-shadow)"`;
  if (rarity==="uncommon") return `<path d="M40 7 66 22v31L40 69 14 53V22Z" ${face} stroke-width="2.4"/><path d="M40 13 61 25v25L40 63 19 50V25Z" fill="none" stroke="#fff" stroke-opacity=".72" stroke-width="1.4"/><path d="M40 8v8" stroke="${themeAccent}" stroke-width="3" stroke-linecap="round"/>`;
  if (rarity==="common") return `<path d="M40 5 66 15v28c0 16-10 26-26 33C24 69 14 59 14 43V15Z" ${face} stroke-width="2.6"/><path d="M40 11 60 19v23c0 12-7 20-20 27-13-7-20-15-20-27V19Z" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/><path d="m17 18 7-3M63 18l-7-3" stroke="${themeAccent}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (rarity==="rare") return `<path d="M40 3 63 12 77 40 63 68 40 77 17 68 3 40 17 12Z" ${face} stroke-width="2.7"/><path d="M40 10 58 17 69 40 58 63 40 70 22 63 11 40 22 17Z" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6"/><path d="M40 4v10M76 40H66M40 76V66M4 40h10" stroke="url(#${id}-theme)" stroke-width="3" stroke-linecap="round"/>`;
  if (rarity==="epic") return `<path d="M26 18C17 10 8 10 2 16c9 3 12 9 15 16-7-2-12 1-16 6 10 1 17 7 25 14M54 18c9-8 18-8 24-2-9 3-12 9-15 16 7-2 12 1 16 6-10 1-17 7-25 14" fill="url(#${id}-theme)" stroke="${palette.edge}" stroke-width="2.3"/><path d="M40 4 65 19l-5 34-20 22-20-22-5-34Z" ${face} stroke-width="2.8"/><path d="M40 11 58 23l-4 27-14 17-14-17-4-27Z" fill="none" stroke="#fff" stroke-opacity=".48" stroke-width="1.6"/><circle cx="9" cy="18" r="2.6" fill="${themeAccent}"/><circle cx="71" cy="18" r="2.6" fill="${themeAccent}"/>`;
  if (rarity==="legendary") return `<path d="m40 2 7 9 12-5 2 12 12 2-5 12 9 8-9 8 5 12-12 2-2 12-12-5-7 9-7-9-12 5-2-12-12-2 5-12-9-8 9-8-5-12 12-2 2-12 12 5Z" ${face} stroke-width="2.5"/><circle cx="40" cy="40" r="29" fill="none" stroke="${palette.accent}" stroke-width="2"/><circle cx="40" cy="40" r="24" fill="none" stroke="#fff" stroke-opacity=".38" stroke-dasharray="3 4"/><path d="M40 5v8M75 40h-8M40 75v-8M5 40h8" stroke="${themeAccent}" stroke-width="3" stroke-linecap="round"/>`;
  if (rarity==="mythic") return `<ellipse cx="40" cy="40" rx="37" ry="20" fill="none" stroke="url(#${id}-theme)" stroke-width="2.4" transform="rotate(-23 40 40)"/><ellipse cx="40" cy="40" rx="37" ry="20" fill="none" stroke="${palette.edge}" stroke-width="2" transform="rotate(23 40 40)"/><path d="m40 3 6 9 10-6 2 12 12-1-5 11 11 5-9 8 8 9-12 3 4 12-12-2-3 12-10-8-8 8-4-12-12 3 3-12-12-3 8-9-9-8 11-5-5-11 12 1 2-12 10 6Z" ${face} stroke-width="2.6"/><path d="m27 14 6-9 7 9 7-9 6 9" fill="none" stroke="${palette.icon}" stroke-width="2.7"/><circle cx="8" cy="30" r="2.5" fill="${themeAccent}"/><circle cx="72" cy="52" r="2.5" fill="${palette.accent}"/>`;
  return `<path d="M24 20 12 9 4 17l14 17C10 34 5 38 2 45c10 0 17 5 24 12M56 20 68 9l8 8-14 17c8 0 13 4 16 11-10 0-17 5-24 12" fill="url(#${id}-theme)" stroke="${palette.edge}" stroke-width="2.4"/><path d="M19 15 28 5l12 10L52 5l9 10 10-5-7 18v25c-5 11-13 18-24 24-11-6-19-13-24-24V28L9 10Z" ${face} stroke-width="2.8"/><circle cx="40" cy="8" r="3.2" fill="${themeAccent}"/>`;
}

function signatureFor(code,accent,iconColor) {
  if (code.startsWith("kindness_")) return `<path d="M18 57c7 7 13 10 22 13 9-3 15-6 22-13" fill="none" stroke="${accent}" stroke-width="2.3" stroke-linecap="round"/>`;
  if (code.startsWith("misdeed_")) return `<path d="m17 58 6-2 3 6 6-3 4 6 5-5 5 5 4-6 6 3 3-6 6 2" fill="none" stroke="${accent}" stroke-width="2.3" stroke-linejoin="round"/>`;
  if (code.startsWith("reward_") || ["modudadam_master","royal_squirrel","aurora_crown"].includes(code)) return `<path d="m28 64 3-3 3 3 6-7 6 7 3-3 3 3" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<circle cx="18" cy="58" r="2.1" fill="${accent}"/><circle cx="62" cy="58" r="2.1" fill="${iconColor}" fill-opacity=".65"/>`;
}
