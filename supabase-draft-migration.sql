-- 建立草稿表 sjx_rating_drafts
-- 執行此 SQL 在 Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS sjx_rating_drafts (
    id SERIAL PRIMARY KEY,
    examiner_id TEXT NOT NULL,
    examiner_name TEXT NOT NULL,
    form_type TEXT NOT NULL CHECK (form_type IN ('atc', 'a321a339', 'a350')),
    pilot_name TEXT,
    callsign TEXT,
    draft_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_rating_drafts_examiner ON sjx_rating_drafts(examiner_id);
CREATE INDEX IF NOT EXISTS idx_rating_drafts_form_type ON sjx_rating_drafts(form_type);

-- 啟用 Row Level Security
ALTER TABLE sjx_rating_drafts ENABLE ROW LEVEL SECURITY;

-- 允許所有操作（因為使用 admin client）
CREATE POLICY "Allow all operations" ON sjx_rating_drafts FOR ALL USING (true);
