-- 002_add_is_editable.sql — 매장별 수정 가능 여부 (계약/MOU 기반)

ALTER TABLE stores ADD COLUMN is_editable boolean NOT NULL DEFAULT true;
