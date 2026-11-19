import json
import pathlib
import urllib.request
from argostranslate import translate

API = "https://ipip-api.ipsyc.io/api/v1/instruments"
OUT = pathlib.Path("modudadam-backend/db/053_curated_taste_bank.sql")

def load(instrument, locale=None):
    suffix = f"?include_scales=true&locale={locale}" if locale else "?include_scales=true"
    with urllib.request.urlopen(f"{API}/{instrument}{suffix}") as response:
        return json.load(response)

def sql(value):
    return "'" + str(value).replace("'", "''") + "'"

def dimension_for_neo(code):
    prefix = code.split("_")[0][0]
    return {"N":"neuroticism", "E":"extraversion", "O":"openness", "A":"agreeableness", "C":"conscientiousness"}[prefix]

def dimension_for_hexaco(code):
    if "_X_" in code: return "extraversion"
    if "_C_" in code: return "conscientiousness"
    if "_O_" in code: return "openness"
    if "_E_" in code or code == "FEARFULNESS": return "neuroticism"
    return "agreeableness"

neo = load("ipip-neo-300", "ko")
hexaco = load("ipip-hexaco-pi")
via = load("via-r")
items = []
seen_text = set()
seen_korean = set()

for scale in neo["scales"]:
    dim = dimension_for_neo(scale["code"])
    for member in scale.get("members") or []:
        normalized = " ".join(member["item_text"].lower().split())
        if normalized in seen_text or member["item_text"].strip() in seen_korean: continue
        seen_text.add(normalized)
        seen_korean.add(member["item_text"].strip())
        items.append({
            "source":"IPIP-NEO-300", "source_id":member["item_code"], "dimension":dim,
            "question":member["item_text"].strip(), "positive":member["polarity"] == "positive",
            "construct":scale["label"],
        })

for scale in hexaco["scales"]:
    dim = dimension_for_hexaco(scale["code"])
    for member in scale.get("members") or []:
        normalized = " ".join(member["item_text"].lower().split())
        if normalized in seen_text: continue
        translated = translate.translate(member["item_text"].strip(), "en", "ko")
        if translated in seen_korean: continue
        seen_text.add(normalized)
        seen_korean.add(translated)
        items.append({
            "source":"IPIP-HEXACO-PI", "source_id":member["item_code"], "dimension":dim,
            "question":translated,
            "positive":member["polarity"] == "positive", "construct":scale["label"],
        })
        if len(items) == 500: break
    if len(items) == 500: break

def dimension_for_via(code):
    if any(key in code for key in ("APPRECIATION", "CURIOSITY", "JUDGMENT", "LEARNING", "ORIGINALITY", "PERSPECTIVE", "SPIRITUALITY")):
        return "openness", False
    if any(key in code for key in ("HUMOR", "LEADERSHIP", "SOCIAL_", "ZEST")):
        return "extraversion", False
    if any(key in code for key in ("INDUSTRY", "PRUDENCE", "SELF_REGULATION")):
        return "conscientiousness", False
    if any(key in code for key in ("HOPE", "VALOR")):
        return "neuroticism", True
    return "agreeableness", False

for scale in via["scales"]:
    if len(items) >= 500: break
    dim,invert = dimension_for_via(scale["code"])
    for member in scale.get("members") or []:
        normalized = " ".join(member["item_text"].lower().split())
        if normalized in seen_text: continue
        translated = translate.translate(member["item_text"].strip(), "en", "ko")
        if translated in seen_korean: continue
        seen_text.add(normalized)
        seen_korean.add(translated)
        positive = member["polarity"] == "positive"
        items.append({
            "source":"IPIP-VIA-R", "source_id":member["item_code"], "dimension":dim,
            "question":translated, "positive":not positive if invert else positive, "construct":scale["label"],
        })
        if len(items) == 500: break
    if len(items) == 500: break

if len(items) != 500:
    raise RuntimeError(f"취향 문항이 {len(items)}개입니다.")
if len({item["source_id"] for item in items}) != 500:
    raise RuntimeError("원본 문항 ID가 중복되었습니다.")
if len({item["question"] for item in items}) != 500:
    raise RuntimeError("번역 문항이 중복되었습니다.")

labels = ["전혀 그렇지 않다", "그렇지 않은 편이다", "보통이다", "그런 편이다", "매우 그렇다"]
lines = [
    "BEGIN;", "",
    "ALTER TABLE taste_question_bank DROP CONSTRAINT IF EXISTS taste_question_bank_dimension_check;",
    "ALTER TABLE taste_question_bank ADD CONSTRAINT taste_question_bank_dimension_check",
    "  CHECK(dimension IN ('energy','rhythm','social','expression','neuroticism','extraversion','openness','agreeableness','conscientiousness'));",
    "ALTER TABLE taste_question_bank ADD COLUMN IF NOT EXISTS source_name varchar(80);",
    "ALTER TABLE taste_question_bank ADD COLUMN IF NOT EXISTS source_item_id varchar(120);",
    "ALTER TABLE taste_question_bank ADD COLUMN IF NOT EXISTS source_license varchar(40);",
    "ALTER TABLE taste_question_bank ADD COLUMN IF NOT EXISTS construct varchar(120);",
    "CREATE UNIQUE INDEX IF NOT EXISTS taste_question_bank_source_item_idx ON taste_question_bank(source_name,source_item_id) WHERE source_item_id IS NOT NULL;",
    "CREATE TABLE IF NOT EXISTS taste_question_exposures (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,question_id bigint NOT NULL REFERENCES taste_question_bank(id) ON DELETE CASCADE,seen_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,question_id));",
    "",
    "UPDATE taste_question_bank SET enabled=false WHERE source_item_id IS NULL;",
]
for index,item in enumerate(items,1):
    scores = [-2,-1,0,1,2] if item["positive"] else [2,1,0,-1,-2]
    options = json.dumps([{"label":label,"score":score} for label,score in zip(labels,scores)],ensure_ascii=False)
    lines.append(
        "INSERT INTO taste_question_bank(question_key,dimension,question,options,enabled,source_name,source_item_id,source_license,construct) VALUES(" +
        ",".join([
            sql(f"ipip-{index:03d}"),sql(item["dimension"]),sql(item["question"]),sql(options)+"::jsonb","true",
            sql(item["source"]),sql(item["source_id"]),sql("Public Domain"),sql(item["construct"]),
        ]) + ") ON CONFLICT(question_key) DO UPDATE SET dimension=EXCLUDED.dimension,question=EXCLUDED.question,options=EXCLUDED.options,enabled=true,source_name=EXCLUDED.source_name,source_item_id=EXCLUDED.source_item_id,source_license=EXCLUDED.source_license,construct=EXCLUDED.construct;"
    )

lines.extend(["", "DO $$", "DECLARE item_count integer; source_count integer; dimension_count integer;", "BEGIN",
    "  SELECT count(*),count(DISTINCT source_item_id),count(DISTINCT dimension) INTO item_count,source_count,dimension_count FROM taste_question_bank WHERE enabled;",
    "  IF item_count<>500 OR source_count<>500 OR dimension_count<>5 THEN",
    "    RAISE EXCEPTION '취향 문항 검증 실패: items %, sources %, dimensions %',item_count,source_count,dimension_count;",
    "  END IF;", "END $$;", "", "COMMIT;", ""])
OUT.write_text("\n".join(lines),encoding="utf-8")
print(f"{OUT}: {len(items)} items generated")
