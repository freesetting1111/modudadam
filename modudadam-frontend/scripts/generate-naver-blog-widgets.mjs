import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const outputDirectory=path.join(root,"public","brand","widgets","naver");

const toDataUrl=async(fileName)=>{
  const image=await readFile(path.join(root,"public","brand",fileName));
  return `data:image/png;base64,${image.toString("base64")}`;
};

const brandMark=await toDataUrl("modudadam-brand-mark.png");
const squirrel=await toDataUrl("modudadam-squirrel.png");
const guide=await toDataUrl("modudadam-guide.png");

const widgets=[
  {
    file:"home",label:"모두의 생활 커뮤니티",headline:["오늘의 이야기,","여기 다 담았어요"],cta:"둘러보기",hero:squirrel,
    background:["#23396f","#4c70cb"],accent:"#ffd270",text:"#ffffff",heroBox:[76,103,108,108],icon:"spark",
  },
  {
    file:"content",label:"오늘 뭐 하지?",headline:["심심할 틈 없는","오늘의 콘텐츠"],cta:"골라보기",hero:guide,
    background:["#42306f","#8064c6"],accent:"#f4d58b",text:"#ffffff",heroBox:[78,108,102,108],icon:"grid",
  },
  {
    file:"bounties",label:"경험이 답이 되는 곳",headline:["답이 필요한 순간,","현상금 질문"],cta:"질문 보기",hero:squirrel,
    background:["#fff2ca","#f5b841"],accent:"#9a5600",text:"#38230f",heroBox:[78,108,106,106],icon:"question",light:true,
  },
  {
    file:"detective",label:"매일 새로운 추리",headline:["오늘의 사건,","범인은 누구?"],cta:"사건 풀기",hero:guide,
    background:["#102f48","#176e78"],accent:"#78eadc",text:"#ffffff",heroBox:[82,108,100,108],icon:"search",
  },
  {
    file:"taste",label:"10문항 취향 테스트",headline:["나는 어떤","취향일까?"],cta:"취향 찾기",hero:squirrel,
    background:["#5c285d","#c65d76"],accent:"#ffd4a8",text:"#ffffff",heroBox:[78,106,108,108],icon:"heart",
  },
  {
    file:"random",label:"랜덤 이야기 여행",headline:["우연히 만나는","새로운 이야기"],cta:"한 편 만나기",hero:guide,
    background:["#244738","#579368"],accent:"#ffe09a",text:"#ffffff",heroBox:[81,108,102,108],icon:"compass",
  },
];

const iconMarkup={
  spark:'<path d="m12 3 1.3 4.1 4.2 1.3-4.2 1.3L12 14l-1.3-4.3-4.2-1.3 4.2-1.3z"/><path d="m18 14 .7 2.2 2.3.8-2.3.7L18 20l-.7-2.3L15 17l2.3-.8z"/>',
  grid:'<rect x="4" y="4" width="6" height="6" rx="1.4"/><rect x="14" y="4" width="6" height="6" rx="1.4"/><rect x="4" y="14" width="6" height="6" rx="1.4"/><rect x="14" y="14" width="6" height="6" rx="1.4"/>',
  question:'<path d="M8.8 9.2a3.4 3.4 0 0 1 6.6 1.2c0 2.6-3.4 2.8-3.4 5.1"/><path d="M12 19h.01"/>',
  search:'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/>',
  heart:'<path d="M20.2 8.8c0 5-8.2 10-8.2 10s-8.2-5-8.2-10A4.4 4.4 0 0 1 12 6.6a4.4 4.4 0 0 1 8.2 2.2z"/>',
  compass:'<circle cx="12" cy="12" r="8.5"/><path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4z"/>',
};

await mkdir(outputDirectory,{ recursive:true });

for(const widget of widgets) {
  const [heroX,heroY,heroWidth,heroHeight]=widget.heroBox;
  const buttonFill=widget.light?widget.text:"#ffffff";
  const buttonText=widget.light?"#ffffff":widget.background[0];
  const iconBackground=widget.light?"#ffffff":"rgba(255,255,255,.14)";
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="170" height="220" viewBox="0 0 170 220">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${widget.background[0]}"/><stop offset="1" stop-color="${widget.background[1]}"/></linearGradient>
    <radialGradient id="glow"><stop stop-color="${widget.accent}" stop-opacity=".32"/><stop offset="1" stop-color="${widget.accent}" stop-opacity="0"/></radialGradient>
    <clipPath id="card"><rect width="170" height="220" rx="20"/></clipPath>
    <filter id="heroShadow" x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#11182b" flood-opacity=".22"/></filter>
  </defs>
  <g clip-path="url(#card)">
    <rect width="170" height="220" fill="url(#bg)"/>
    <circle cx="150" cy="28" r="73" fill="url(#glow)"/>
    <circle cx="19" cy="202" r="56" fill="none" stroke="${widget.accent}" stroke-opacity=".14" stroke-width="14"/>
    <path d="M-8 151C38 128 72 156 112 133c25-14 48-5 70 10v85H-8z" fill="#ffffff" fill-opacity=".08"/>
    <image href="${widget.hero}" x="${heroX}" y="${heroY}" width="${heroWidth}" height="${heroHeight}" preserveAspectRatio="xMidYMid meet" filter="url(#heroShadow)"/>
  </g>
  <rect x=".75" y=".75" width="168.5" height="218.5" rx="19.25" fill="none" stroke="${widget.accent}" stroke-opacity=".55" stroke-width="1.5"/>
  <image href="${brandMark}" x="13" y="11" width="19" height="19"/>
  <text x="37" y="25" fill="${widget.text}" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="10.5" font-weight="800" letter-spacing="-.3">모두다담</text>
  <rect x="134" y="10" width="25" height="25" rx="9" fill="${iconBackground}" stroke="${widget.accent}" stroke-opacity=".5"/>
  <g transform="translate(138.5 14.5) scale(.67)" fill="none" stroke="${widget.accent}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${iconMarkup[widget.icon]}</g>
  <text x="13" y="54" fill="${widget.accent}" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="9.5" font-weight="800" letter-spacing=".3">${widget.label}</text>
  <text x="13" y="80" fill="${widget.text}" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="19" font-weight="900" letter-spacing="-.8">${widget.headline[0]}</text>
  <text x="13" y="105" fill="${widget.text}" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="19" font-weight="900" letter-spacing="-.8">${widget.headline[1]}</text>
  <g transform="translate(13 178)">
    <rect width="94" height="29" rx="14.5" fill="${buttonFill}"${widget.light?'':' fill-opacity=".96"'}/>
    <text x="14" y="19" fill="${buttonText}" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="11" font-weight="900">${widget.cta}</text>
    <path d="M76 10.5 81 14.5l-5 4M80 14.5H70" fill="none" stroke="${buttonText}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  </svg>`;

  await sharp(Buffer.from(svg))
    .png({ compressionLevel:9,palette:true })
    .toFile(path.join(outputDirectory,`${widget.file}-170x220.png`));
}

console.log(`Generated ${widgets.length} Naver blog widgets in ${outputDirectory}`);
