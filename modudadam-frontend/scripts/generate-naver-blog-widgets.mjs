import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const outputDirectory=path.join(root,"public","brand","widgets","naver");
const mark=await readFile(path.join(root,"public","brand","modudadam-brand-mark.png"));
const markData=`data:image/png;base64,${mark.toString("base64")}`;

const widgets=[
  { file:"home",title:"모두다담 홈",subtitle:["생활 정보와 이야기가","모이는 커뮤니티"],accent:"#4f73d9",soft:"#edf3ff",icon:"home" },
  { file:"content",title:"콘텐츠",subtitle:["오늘 할 일을","한눈에 골라보세요"],accent:"#7257bd",soft:"#f3efff",icon:"content" },
  { file:"bounties",title:"현상금 질문",subtitle:["경험 있는 이웃에게","답을 요청해 보세요"],accent:"#ad7015",soft:"#fff4dc",icon:"bounties" },
  { file:"detective",title:"다담 추리방",subtitle:["단서를 비교하고","매일 사건을 풀어요"],accent:"#356596",soft:"#ebf4fb",icon:"detective" },
  { file:"taste",title:"취향 발견실",subtitle:["10문항으로 찾는","나의 생활 취향"],accent:"#825bbb",soft:"#f4effc",icon:"taste" },
  { file:"random",title:"랜덤 이야기",subtitle:["새로운 글을","우연히 만나보세요"],accent:"#c07818",soft:"#fff3df",icon:"random" },
];

const iconMarkup={
  home:'<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  content:'<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><path d="M14 17h6M17 14v6"/>',
  bounties:'<circle cx="12" cy="12" r="8"/><path d="M9.8 9.3a2.35 2.35 0 0 1 4.5 1c0 1.8-2.3 2-2.3 3.7M12 17.3h.01"/>',
  detective:'<path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6z"/><path d="M9.8 9.4a2.35 2.35 0 0 1 4.5 1c0 1.8-2.3 2-2.3 3.6M12 17h.01"/>',
  taste:'<path d="m12 3 1.25 3.75L17 8l-3.75 1.25L12 13l-1.25-3.75L7 8l3.75-1.25zM18.5 14l.75 2.25L21.5 17l-2.25.75L18.5 20l-.75-2.25L15.5 17l2.25-.75zM5 14l.6 1.9 1.9.6-1.9.6L5 19l-.6-1.9-1.9-.6 1.9-.6z"/>',
  random:'<circle cx="12" cy="12" r="9"/><path d="m15.7 8.3-2.1 5.3-5.3 2.1 2.1-5.3z"/><circle cx="12" cy="12" r="1"/>',
};

await mkdir(outputDirectory,{ recursive:true });

for(const widget of widgets) {
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="170" height="220" viewBox="0 0 170 220">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${widget.soft}"/><stop offset=".6" stop-color="#ffffff"/><stop offset="1" stop-color="${widget.soft}"/></linearGradient>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#1e2c48" flood-opacity=".12"/></filter>
  </defs>
  <rect x="1" y="1" width="168" height="218" rx="18" fill="url(#bg)" stroke="${widget.accent}" stroke-opacity=".3"/>
  <image href="${markData}" x="14" y="12" width="28" height="28"/>
  <text x="48" y="30" fill="#263247" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="13" font-weight="800">모두다담</text>
  <circle cx="85" cy="72" r="28" fill="#fff" filter="url(#shadow)"/>
  <g transform="translate(71 58) scale(1.17)" fill="none" stroke="${widget.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconMarkup[widget.icon]}</g>
  <text x="85" y="119" text-anchor="middle" fill="#1f2c42" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="18" font-weight="900" letter-spacing="-.5">${widget.title}</text>
  <text x="85" y="141" text-anchor="middle" fill="#68758a" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="12" font-weight="600">${widget.subtitle[0]}</text>
  <text x="85" y="158" text-anchor="middle" fill="#68758a" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="12" font-weight="600">${widget.subtitle[1]}</text>
  <rect x="22" y="178" width="126" height="30" rx="10" fill="${widget.accent}"/>
  <text x="85" y="198" text-anchor="middle" fill="#fff" font-family="Noto Sans KR, Malgun Gothic, sans-serif" font-size="12" font-weight="800">바로가기</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel:9,palette:true }).toFile(path.join(outputDirectory,`${widget.file}-170x220.png`));
}

console.log(`Generated ${widgets.length} Naver blog widgets in ${outputDirectory}`);
