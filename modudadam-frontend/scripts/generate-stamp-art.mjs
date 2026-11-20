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
const colors={ uncommon:["#37a476","#b8f1d3"],common:["#4b75da","#c9dcff"],rare:["#7654d8","#d9caff"],epic:["#b544cb","#f2baff"],legendary:["#e58520","#ffe09a"],mythic:["#e3417d","#70d8ff"],operator:["#172747","#f5c85b"] };
const directory=join(process.cwd(),"public","brand","stamps","catalog");
await mkdir(directory,{ recursive:true });
for (const [rarity,codes] of Object.entries(rarities)) {
  for (const code of codes) {
    const [dark,light]=colors[rarity];const Icon=Icons[catalog[code]] || Icons.Badge;const id=`g-${code.replaceAll("_","-")}`;
    const icon=renderToStaticMarkup(createElement(Icon,{ size:30,strokeWidth:2.4,color:"#17233b" })).replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,"");
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${code}"><defs><linearGradient id="${id}" x1="8" y1="6" x2="56" y2="60"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${dark}" flood-opacity=".38"/></filter></defs><path d="M32 3 55 15v26L32 61 9 49V15Z" fill="url(#${id})" stroke="${dark}" stroke-width="2" filter="url(#s)"/><path d="M32 8 50 18v20L32 54 14 45V18Z" fill="#fff" fill-opacity=".24"/><circle cx="49" cy="14" r="3" fill="#fff" opacity=".9"/><path d="m12 23 4 2 2 4-2 4-4 2-2-2 2-4-2-4Z" fill="#fff" opacity=".65"/><g transform="translate(17 17)">${icon}</g></svg>`;
    await writeFile(join(directory,`${rarity}-${code}.svg`),svg,"utf8");
  }
}
