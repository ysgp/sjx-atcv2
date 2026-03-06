-- 為 sjx_questions 表添加 has_correct_answer 欄位和更新 question_type 約束
-- 執行此 SQL 在 Supabase Dashboard > SQL Editor

-- 步驟 1: 檢查所有現有的約束
SELECT con.conname AS constraint_name, 
       pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sjx_questions' 
AND con.contype = 'c';

-- 步驟 2: 刪除所有 question_type 相關的約束
DO $$ 
DECLARE
    constraint_rec RECORD;
BEGIN
    FOR constraint_rec IN 
        SELECT con.conname 
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'sjx_questions' 
        AND con.contype = 'c'
        AND con.conname LIKE '%question_type%'
    LOOP
        EXECUTE format('ALTER TABLE sjx_questions DROP CONSTRAINT IF EXISTS %I', constraint_rec.conname);
    END LOOP;
END $$;

-- 步驟 3: 添加 has_correct_answer 欄位
ALTER TABLE sjx_questions 
ADD COLUMN IF NOT EXISTS has_correct_answer text DEFAULT 'true';

-- 步驟 4: 更新所有現有題目為有正確答案
UPDATE sjx_questions 
SET has_correct_answer = 'true' 
WHERE has_correct_answer IS NULL;

-- 步驟 5: 修正不符合規範的 question_type 值
UPDATE sjx_questions 
SET question_type = 'single_choice' 
WHERE question_type IS NULL OR question_type = '' 
OR question_type NOT IN ('single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer');

-- 步驟 6: 刪除舊約束（如果存在）再添加新的
ALTER TABLE sjx_questions 
DROP CONSTRAINT IF EXISTS sjx_questions_question_type_check;

ALTER TABLE sjx_questions 
ADD CONSTRAINT sjx_questions_question_type_check 
CHECK (question_type IN ('single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer'));

-- 步驟 7: 驗證最終結果
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'sjx_questions'::regclass
AND contype = 'c';
