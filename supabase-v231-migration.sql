-- ============================================================================
-- SJX Training System v2.3.1 Migration
-- 密碼登入系統
-- ============================================================================

-- 新增密碼相關欄位到 sjx_students 表
ALTER TABLE sjx_students 
ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS password_changed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 設定預設密碼 (bcrypt hash of 'SJX12345')
-- 注意：這個 hash 是使用 bcrypt 產生的，實際部署時請確保使用正確的 hash
-- 預設密碼: SJX12345
-- 下面的 hash 需要在 Node.js 中使用 bcrypt 產生後替換

-- 為所有現有學員設定預設密碼（需要在應用程式中執行，因為需要 bcrypt）
-- UPDATE sjx_students SET password_hash = '<bcrypt_hash>', password_changed = FALSE WHERE password_hash IS NULL;

-- 建立索引提升查詢效能
CREATE INDEX IF NOT EXISTS idx_sjx_students_callsign_lower ON sjx_students (LOWER(callsign));

COMMENT ON COLUMN sjx_students.password_hash IS '密碼 bcrypt hash';
COMMENT ON COLUMN sjx_students.password_changed IS '是否已更改預設密碼';
COMMENT ON COLUMN sjx_students.last_login_at IS '最後登入時間';
