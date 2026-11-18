BEGIN;

-- 과거에 같은 원본 문제가 여러 날짜에 연결된 경우 최초 배정만 보존합니다.
WITH duplicated AS (
  SELECT id,row_number() OVER(PARTITION BY source_prompt_id ORDER BY active_on,id) AS rn
    FROM daily_choices WHERE source_prompt_id IS NOT NULL
)
UPDATE daily_choices SET source_prompt_id=NULL,updated_at=now()
WHERE id IN (SELECT id FROM duplicated WHERE rn>1);

-- 하나의 원본 문제는 서비스 전체에서 단 한 날짜에만 배정할 수 있습니다.
CREATE UNIQUE INDEX IF NOT EXISTS daily_choices_source_prompt_unique_idx
  ON daily_choices(source_prompt_id) WHERE source_prompt_id IS NOT NULL;

COMMENT ON INDEX daily_choices_source_prompt_unique_idx IS
  '오늘의 선택 원본 문제 재사용 방지. 한 source_prompt_id는 한 날짜에만 배정된다.';

COMMIT;

-- 남은 미사용 문제 확인
-- SELECT COUNT(*) FROM choice_prompt_bank prompts
-- WHERE prompts.enabled
--   AND NOT EXISTS(SELECT 1 FROM daily_choices choices WHERE choices.source_prompt_id=prompts.id);
