// ─── 테이블 Row 타입 ───

export type Store = {
  id: string;
  name: string;
  created_at: string;
};

export type Category = {
  id: string;
  store_id: string;
  name: string;
  display_order: number;
  created_at: string;
};

export type Menu = {
  id: string;
  store_id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string | null;
  display_order: number;
  created_at: string;
};

export type ChangeLog = {
  id: string;
  store_id: string;
  action: string;
  target_type: string;
  target_name: string;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  status: string;
  created_at: string;
};

export type PendingImage = {
  id: string;
  chat_id: string;
  image_url: string;
  applied: boolean;
  created_at: string;
};

// ─── Supabase Database 타입 ───

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: Store;
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          display_order: number;
          created_at?: string;
        };
        Update: {
          store_id?: string;
          name?: string;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      menus: {
        Row: Menu;
        Insert: {
          id?: string;
          store_id: string;
          category_id: string;
          name: string;
          price: number;
          image_url?: string | null;
          display_order: number;
          created_at?: string;
        };
        Update: {
          store_id?: string;
          category_id?: string;
          name?: string;
          price?: number;
          image_url?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      change_logs: {
        Row: ChangeLog;
        Insert: {
          id?: string;
          store_id: string;
          action: string;
          target_type: string;
          target_name: string;
          before_data: Record<string, unknown>;
          after_data: Record<string, unknown>;
          status: string;
          created_at?: string;
        };
        Update: {
          store_id?: string;
          action?: string;
          target_type?: string;
          target_name?: string;
          before_data?: Record<string, unknown>;
          after_data?: Record<string, unknown>;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pending_images: {
        Row: PendingImage;
        Insert: {
          id?: string;
          chat_id: string;
          image_url: string;
          applied?: boolean;
          created_at?: string;
        };
        Update: {
          chat_id?: string;
          image_url?: string;
          applied?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ─── API 요청 타입 ───

export interface CategoryMoveRequest {
  menuName: string;
  targetCategory: string;
}

export interface CategoryCreateRequest {
  categoryName: string;
  storeName: string;
}

export interface CategoryReorderRequest {
  categoryName: string;
  newPosition: number;
}

export interface ImageChangeRequest {
  menuName: string;
  chatId: string;
}

// ─── API 응답 타입 ───

export interface StoreSearchResponse {
  store: Pick<Store, "id" | "name">;
  menus: {
    id: string;
    name: string;
    category: string;
    categoryId: string;
    price: number;
    imageUrl: string | null;
    displayOrder: number;
  }[];
  categories: {
    id: string;
    name: string;
    displayOrder: number;
    menuCount: number;
  }[];
}

export interface CategoryMoveResponse {
  success: true;
  message: string;
  menu: {
    id: string;
    name: string;
    previousCategory: string;
    newCategory: string;
  };
}

export interface CategoryCreateResponse {
  success: true;
  message: string;
  category: {
    id: string;
    name: string;
    displayOrder: number;
  };
}

export interface CategoryDeleteResponse {
  success: true;
  message: string;
}

export interface CategoryReorderResponse {
  success: true;
  message: string;
  categories: {
    name: string;
    displayOrder: number;
  }[];
}

export interface ImageChangeResponse {
  success: true;
  message: string;
  menu: {
    id: string;
    name: string;
    previousImageUrl: string | null;
    newImageUrl: string | null;
  };
}

export interface ResetResponse {
  success: true;
  message: string;
  summary: {
    stores: number;
    categories: number;
    menus: number;
    changeLogsCleared: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
  message: string;
}
