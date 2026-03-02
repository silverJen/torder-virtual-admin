-- 001_init.sql — 가상 티오더 어드민 테이블 생성

-- 매장
CREATE TABLE stores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 카테고리
CREATE TABLE categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name          text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 메뉴
CREATE TABLE menus (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name          text NOT NULL,
  price         integer NOT NULL DEFAULT 0,
  image_url     text,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 변경 이력
CREATE TABLE change_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_name text NOT NULL,
  before_data jsonb NOT NULL DEFAULT '{}',
  after_data  jsonb NOT NULL DEFAULT '{}',
  status      text NOT NULL DEFAULT 'success',
  created_at  timestamptz NOT NULL DEFAULT now()
);
