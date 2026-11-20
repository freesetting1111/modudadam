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
const directory=join(process.cwd(),"public","brand","stamps","catalog","v2");
await mkdir(directory,{ recursive:true });
for (const [rarity,codes] of Object.entries(rarities)) {
  for (const code of codes) {
    const hue=(baseHues[rarity]+hash(code)%33-16+360)%360;
    const dark=`hsl(${hue} 78% 28%)`;const middle=`hsl(${hue} 82% 48%)`;const light=`hsl(${(hue+18)%360} 92% 78%)`;const glow=`hsl(${(hue+35)%360} 100% 72%)`;
    const iconColor=["legendary","mythic","operator"].includes(rarity)?"#fff3a3":"#ffffff";
    const Icon=Icons[catalog[code]] || Icons.Badge;const id=`g-${code.replaceAll("_","-")}`;
    const icon=renderToStaticMarkup(createElement(Icon,{ strokeWidth:2.15,color:iconColor })).replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,"");
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${code}"><defs><linearGradient id="${id}" x1="7" y1="5" x2="57" y2="59"><stop stop-color="${light}"/><stop offset=".48" stop-color="${middle}"/><stop offset="1" stop-color="${dark}"/></linearGradient><radialGradient id="${id}-core"><stop stop-color="${middle}"/><stop offset="1" stop-color="${dark}"/></radialGradient><filter id="${id}-shadow"><feDropShadow dx="0" dy="2" stdDeviation="2.6" flood-color="${middle}" flood-opacity=".65"/></filter><filter id="${id}-glow"><feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="${iconColor}" flood-opacity=".95"/></filter></defs><path d="M32 2 56 14v28L32 62 8 50V14Z" fill="url(#${id})" stroke="${glow}" stroke-width="2.4" filter="url(#${id}-shadow)"/><path d="M32 7 51 17v22L32 55 13 46V17Z" fill="#fff" fill-opacity=".18" stroke="#fff" stroke-opacity=".5"/><circle cx="32" cy="32" r="18" fill="url(#${id}-core)" stroke="#fff" stroke-opacity=".78" stroke-width="1.5"/><circle cx="50" cy="13" r="3.3" fill="#fff"/><path d="m13 20 2.2 4.4 4.4 2.2-4.4 2.2-2.2 4.4-2.2-4.4-4.4-2.2 4.4-2.2Z" fill="${iconColor}" opacity=".95"/><g transform="translate(14 14) scale(1.5)" fill="none" stroke="${iconColor}" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" filter="url(#${id}-glow)">${icon}</g></svg>`;
    await writeFile(join(directory,`${rarity}-${code}.svg`),svg,"utf8");
  }
}

function hash(value) { return [...value].reduce((total,character)=>((total*31)+character.charCodeAt(0))>>>0,0); }
