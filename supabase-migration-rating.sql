-- 更新 sjx_results 表的 exam_type 約束以支援 Rating 類型
-- 執行此 SQL 在 Supabase Dashboard > SQL Editor

-- 步驟 1: 檢查現有的約束
SELECT con.conname AS constraint_name, 
       pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sjx_results' 
AND con.contype = 'c';

-- 步驟 2: 刪除舊的 exam_type 約束
ALTER TABLE sjx_results 
DROP CONSTRAINT IF EXISTS sjx_results_exam_type_check;

-- 步驟 3: 添加新的約束（包含 rating 類型）
ALTER TABLE sjx_results 
ADD CONSTRAINT sjx_results_exam_type_check 
CHECK (exam_type IN ('quiz', 'final', 'rating_atc', 'rating_a350', 'rating_a321a339'));

-- 步驟 4: 驗證最終結果
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'sjx_results'::regclass
AND contype = 'c';
