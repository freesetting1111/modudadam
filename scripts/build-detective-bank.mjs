import fs from "node:fs";
import path from "node:path";

const SOURCE_PATH = process.env.DETECTIVE_SOURCE_PATH || path.join(process.env.TEMP || ".", "modudadam-logic-mid.jsonl");
const OUTPUT_PATH = path.resolve("modudadam-backend/db/052_curated_detective_bank.sql");
const SOURCE_URL = "https://huggingface.co/datasets/Emulated-Inc/logic-grid-puzzles-training-pool";

const labels = {
  Forename: "이름", Pastry: "빵", Fish: "물고기", Lantern: "등불 색", Commute: "이동 수단",
  Scent: "향", Craft: "공예", Summit: "등반한 산", Sport: "운동", Language: "배우는 언어", Dessert: "후식",
};
const words = {
  Teodor:"테오도르", Marisol:"마리솔", Kwame:"콰메", Priya:"프리야", Ines:"이네스", Lachlan:"라클란",
  croissant:"크루아상", pretzel:"프레첼", scone:"스콘", focaccia:"포카치아", baguette:"바게트", strudel:"슈트루델",
  angelfish:"엔젤피시", rasbora:"라스보라", loach:"미꾸라지", tetra:"테트라", guppy:"구피", koi:"비단잉어",
  lilac:"라일락", slate:"슬레이트", bronze:"브론즈", indigo:"인디고", crimson:"크림슨", saffron:"사프란",
  tram:"트램", ferry:"페리", tandem:"2인 자전거", scooter:"스쿠터", gondola:"곤돌라", monorail:"모노레일",
  patchouli:"파촐리", vetiver:"베티버", cedarwood:"시더우드", neroli:"네롤리", jasmine:"재스민", bergamot:"베르가못",
  woodturning:"목선반", origami:"종이접기", weaving:"직조", pottery:"도예", calligraphy:"서예", bookbinding:"제본",
  Kinabalu:"키나발루", Elbrus:"엘브루스", Snowdon:"스노든", Etna:"에트나", Aconcagua:"아콩카과", Denali:"데날리",
  curling:"컬링", rowing:"조정", judo:"유도", archery:"양궁", fencing:"펜싱", netball:"넷볼",
  Swahili:"스와힐리어", Finnish:"핀란드어", Urdu:"우르두어", Quechua:"케추아어", Tagalog:"타갈로그어", Basque:"바스크어",
  baklava:"바클라바", mochi:"모찌", flan:"플란", tiramisu:"티라미수", trifle:"트라이플", sorbet:"소르베",
};
const ordinals = { first:1, second:2, third:3, fourth:4, fifth:5 };

function ko(value) { return words[value] || value; }
function q(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function json(value) { return q(JSON.stringify(value)); }

function entityMap(record) {
  const map = new Map();
  for (let column = 1; column < record.header.length; column++) {
    const type = record.header[column];
    for (const row of record.solution.rows) {
      const value = row[column];
      const translated = {
        Forename: `${ko(value)}`,
        Pastry: `${ko(value)} 빵을 사는 사람`,
        Fish: `${ko(value)}를 기르는 사람`,
        Lantern: `${ko(value)}색 등불을 건 사람`,
        Commute: `${ko(value)}로 이동하는 사람`,
        Scent: `${ko(value)} 향을 쓰는 사람`,
        Craft: `${ko(value)} 공예를 하는 사람`,
        Summit: `${ko(value)} 산을 오른 사람`,
        Sport: `${ko(value)}를 하는 사람`,
        Language: `${ko(value)}를 배우는 사람`,
        Dessert: `${ko(value)}를 후식으로 먹는 사람`,
      }[type];
      const aliases = {
        Forename: [value],
        Pastry: [`the person who buys the ${value}`, `the person who buys ${value}`],
        Fish: [`the person who keeps the ${value}`, `the person who keeps ${value}`],
        Lantern: [`the person with the ${value} lantern`],
        Commute: [`the person who commutes by ${value}`],
        Scent: [`the person who wears ${value}`],
        Craft: [`the person who practises ${value}`],
        Summit: [`the person who climbed ${value}`],
        Sport: [`the person who plays ${value}`],
        Language: [`the person learning ${value}`, `the person who is learning ${value}`],
        Dessert: [`the person who eats ${value}`, `the person who has ${value} for dessert`, `the person who orders the ${value}`],
      }[type];
      for (const alias of aliases || []) map.set(alias.toLowerCase(), translated);
    }
  }
  return map;
}

function entity(text, map) {
  const result = map.get(text.trim().toLowerCase());
  if (!result) throw new Error(`해석할 수 없는 단서 대상: ${text}`);
  return result;
}

function translateClue(clue, map) {
  const body = clue.replace(/^\d+\.\s*/, "").trim();
  let match;
  if ((match = body.match(/^There are (two|three) houses between (.+) and (.+)\.$/)))
    return `${entity(match[2],map)}과 ${entity(match[3],map)} 사이에는 ${match[1] === "two" ? 2 : 3}개의 방이 있습니다.`;
  if ((match = body.match(/^There is one house between (.+) and (.+)\.$/)))
    return `${entity(match[1],map)}과 ${entity(match[2],map)} 사이에는 방 하나가 있습니다.`;
  if ((match = body.match(/^(.+) and (.+) are next to each other\.$/)))
    return `${entity(match[1],map)}과 ${entity(match[2],map)}은(는) 서로 이웃한 방에 있습니다.`;
  if ((match = body.match(/^(.+) is directly left of (.+)\.$/)))
    return `${entity(match[1],map)}은(는) ${entity(match[2],map)}의 바로 왼쪽 방에 있습니다.`;
  if ((match = body.match(/^(.+) is directly right of (.+)\.$/)))
    return `${entity(match[1],map)}은(는) ${entity(match[2],map)}의 바로 오른쪽 방에 있습니다.`;
  if ((match = body.match(/^(.+) is somewhere to the (left|right) of (.+)\.$/)))
    return `${entity(match[1],map)}은(는) ${entity(match[3],map)}보다 ${match[2] === "left" ? "왼쪽" : "오른쪽"} 방에 있습니다.`;
  if ((match = body.match(/^(.+) is not in the (first|second|third|fourth|fifth) house\.$/)))
    return `${entity(match[1],map)}은(는) ${ordinals[match[2]]}번 방에 있지 않습니다.`;
  if ((match = body.match(/^(.+) is in the (first|second|third|fourth|fifth) house\.$/)))
    return `${entity(match[1],map)}은(는) ${ordinals[match[2]]}번 방에 있습니다.`;
  if ((match = body.match(/^(.+) is (.+)\.$/)))
    return `${entity(match[1],map)}과 ${entity(match[2],map)}은(는) 같은 사람입니다.`;
  throw new Error(`해석할 수 없는 단서 문장: ${body}`);
}

function sourceClues(record) {
  const clueSection = record.puzzle.split("## Clues:\n")[1];
  if (!clueSection) throw new Error(`${record.id}: 단서 구역 없음`);
  const map = entityMap(record);
  return clueSection.trim().split("\n").filter(Boolean).map((line) => translateClue(line,map));
}

function profile(row, headers) {
  return headers.slice(1).map((header,index) => `${labels[header]}: ${ko(row[index+1])}`).join(" · ");
}

function candidates(record, targetIndex) {
  const rows = record.solution.rows;
  const correct = rows[targetIndex].slice(1);
  const shifts = [
    [0,0,0,0,0], [0,1,2,3,4], [1,0,2,4,3], [2,1,0,4,3], [3,2,1,0,4],
    [4,3,2,1,0], [1,2,3,4,0], [2,3,4,0,1], [3,4,0,1,2], [4,0,1,2,3],
  ];
  const built = shifts.map((pattern) => pattern.map((shift,column) => rows[(targetIndex+shift)%5][column+1]));
  if (new Set(built.map((row) => row.join("|"))).size !== 10) throw new Error(`${record.id}: 선택지 중복`);
  if (built.filter((row) => row.every((value,index) => value === correct[index])).length !== 1) throw new Error(`${record.id}: 정답 개수 오류`);
  return built;
}

const raw = fs.readFileSync(SOURCE_PATH,"utf8").split("\n");
const records = [];
for (const line of raw) {
  try {
    const record = JSON.parse(line);
    if (record.size === "5*5") records.push(record);
  } catch { /* range 파일의 잘린 첫/마지막 행 제외 */ }
  if (records.length === 500) break;
}
if (records.length !== 500) throw new Error(`5×5 원본이 ${records.length}건뿐입니다.`);
if (new Set(records.map((record) => record.id)).size !== 500) throw new Error("원본 ID가 중복되었습니다.");

const out = [
  "BEGIN;",
  "",
  "-- 500개의 서로 다른 5×5 논리 퍼즐을 CC BY 4.0 원본에서 선별하고 한국어 사건형으로 각색했습니다.",
  `-- 원본: ${SOURCE_URL}`,
  "-- 각 원본은 공급 데이터의 제약 솔버로 유일해가 검증되어 있으며 source_payload에 원문 단서와 정답을 보존합니다.",
  "",
];

for (let i=0;i<records.length;i++) {
  const record = records[i];
  const caseNo = i+1;
  const targetIndex = (caseNo*7)%5;
  const clues = sourceClues(record);
  const target = record.solution.rows[targetIndex];
  const options = candidates(record,targetIndex);
  const categories = record.header.slice(1).map((header,column) => {
    const values = record.solution.rows.map((row) => ko(row[column+1])).join(", ");
    return `${labels[header]} 후보는 ${values}입니다.`;
  }).join(" ");
  const briefing = `서로 다른 다섯 사람이 왼쪽부터 1번에서 5번까지의 조사실에 한 명씩 있습니다. ${categories}\n\n수사 단서\n${clues.map((clue,n)=>`${n+1}. ${clue}`).join("\n")}`;
  const explanation = `단서를 모두 교차하면 ${targetIndex+1}번 방의 기록은 ${profile(target,record.header)}입니다. 전체 배치는 ${record.solution.rows.map((row,index)=>`${index+1}번(${profile(row,record.header)})`).join(" / ")} 순서로 하나만 성립합니다.`;
  const payload = { id:record.id, size:record.size, header:record.header, puzzle:record.puzzle, solution:record.solution, trace:record.trace };
  out.push(
    `INSERT INTO detective_cases(case_no,title,briefing,question,explanation,difficulty,enabled,source_dataset,source_record_id,source_url,source_license,source_payload)`,
    `VALUES(${caseNo},${q(`논리 사건 ${String(caseNo).padStart(3,"0")} · 다섯 방의 기록`)},${q(briefing)},${q(`${targetIndex+1}번 방에 있는 사람의 완전한 기록은 어느 것일까요?`)},${q(explanation)},5,true,`,
    `  'Emulated-Inc/logic-grid-puzzles-training-pool',${q(record.id)},${q(SOURCE_URL)},'CC BY 4.0',${json(payload)}::jsonb)`,
    `ON CONFLICT(case_no) DO UPDATE SET title=EXCLUDED.title,briefing=EXCLUDED.briefing,question=EXCLUDED.question,`,
    `  explanation=EXCLUDED.explanation,difficulty=EXCLUDED.difficulty,enabled=true,source_dataset=EXCLUDED.source_dataset,`,
    `  source_record_id=EXCLUDED.source_record_id,source_url=EXCLUDED.source_url,source_license=EXCLUDED.source_license,`,
    `  source_payload=EXCLUDED.source_payload,updated_at=now();`,
    `DELETE FROM detective_case_hints WHERE case_id=(SELECT id FROM detective_cases WHERE case_no=${caseNo});`,
    `DELETE FROM detective_case_suspects WHERE case_id=(SELECT id FROM detective_cases WHERE case_no=${caseNo});`,
    `INSERT INTO detective_case_suspects(case_id,suspect_code,name,statement,is_correct,sort_order) VALUES`,
    ...options.map((option,index) => `  ((SELECT id FROM detective_cases WHERE case_no=${caseNo}),'O${String(index+1).padStart(2,"0")}',${q(`수사 결론 ${index+1}`)},${q(profile(["",...option],record.header))},${index===0},${index+1})${index===9?";":","}`),
    `INSERT INTO detective_case_hints(case_id,hint_order,content) VALUES`,
    `  ((SELECT id FROM detective_cases WHERE case_no=${caseNo}),1,${q(`기록을 좁혀 보면 ${targetIndex+1}번 방의 ${labels[record.header[1]]}은(는) ${ko(target[1])}입니다.`)}),`,
    `  ((SELECT id FROM detective_cases WHERE case_no=${caseNo}),2,${q(`추가 대조 결과 ${labels[record.header[2]]}은(는) ${ko(target[2])}, ${labels[record.header[3]]}은(는) ${ko(target[3])}입니다.`)}),`,
    `  ((SELECT id FROM detective_cases WHERE case_no=${caseNo}),3,${q(`마지막 단서: ${labels[record.header[4]]}은(는) ${ko(target[4])}, ${labels[record.header[5]]}은(는) ${ko(target[5])}입니다.`)});`,
    "",
  );
}

out.push(`DO $$
DECLARE case_count integer; option_count integer; hint_count integer; source_count integer;
BEGIN
  SELECT count(*),count(DISTINCT source_record_id) INTO case_count,source_count
    FROM detective_cases WHERE case_no BETWEEN 1 AND 500 AND enabled;
  SELECT count(*) INTO option_count FROM detective_case_suspects s JOIN detective_cases c ON c.id=s.case_id WHERE c.case_no BETWEEN 1 AND 500;
  SELECT count(*) INTO hint_count FROM detective_case_hints h JOIN detective_cases c ON c.id=h.case_id WHERE c.case_no BETWEEN 1 AND 500;
  IF case_count<>500 OR source_count<>500 OR option_count<>5000 OR hint_count<>1500 THEN
    RAISE EXCEPTION '추리 은행 검증 실패: cases %, sources %, options %, hints %',case_count,source_count,option_count,hint_count;
  END IF;
  IF EXISTS (SELECT 1 FROM detective_case_suspects GROUP BY case_id HAVING count(*)<>10 OR count(*) FILTER(WHERE is_correct)<>1) THEN
    RAISE EXCEPTION '사건별 선택지 또는 정답 수 검증 실패';
  END IF;
END $$;

COMMIT;
`);

fs.writeFileSync(OUTPUT_PATH,out.join("\n"),"utf8");
console.log(`${OUTPUT_PATH}: ${records.length} cases generated`);
