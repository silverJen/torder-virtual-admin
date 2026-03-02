'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDate, formatPrice } from '@/lib/utils';
import type { ChangeLog } from '@/types/database';

// ─── 상수 ───

const STORE_NAME = '팔도휴게소(대전괴정점)';
const RECENT_MS = 5 * 60 * 1000; // 5분 이내 변경은 하이라이트
const POLL_INTERVAL = 3000;

const ACTION_LABELS: Record<string, string> = {
  img_change: '이미지 변경',
  img_add: '이미지 추가',
  img_delete: '이미지 삭제',
  cat_move: '카테고리 이동',
  cat_create: '카테고리 생성',
  cat_delete: '카테고리 삭제',
  cat_reorder: '순서 변경',
};

// ─── 타입 ───

interface StoreMenu {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  price: number;
  imageUrl: string | null;
  displayOrder: number;
}

interface StoreCategory {
  id: string;
  name: string;
  displayOrder: number;
  menuCount: number;
}

interface StoreData {
  store: { id: string; name: string };
  menus: StoreMenu[];
  categories: StoreCategory[];
}

// ─── 유틸 ───

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return formatDate(dateStr);
}

function formatBeforeAfter(log: ChangeLog): { before: string; after: string } {
  const b = log.before_data;
  const a = log.after_data;

  switch (log.action) {
    case 'img_change':
    case 'img_add':
    case 'img_delete':
      return {
        before: (b?.image_url as string) || '(이미지 없음)',
        after: (a?.image_url as string) || '(이미지 없음)',
      };
    case 'cat_move':
      return {
        before: (b?.category as string) || '-',
        after: (a?.category as string) || '-',
      };
    case 'cat_create':
      return { before: '-', after: (a?.name as string) || '-' };
    case 'cat_delete':
      return { before: (b?.name as string) || '-', after: '(삭제됨)' };
    case 'cat_reorder':
      return {
        before: `${b?.display_order ?? '-'}번째`,
        after: `${a?.display_order ?? '-'}번째`,
      };
    default:
      return { before: JSON.stringify(b), after: JSON.stringify(a) };
  }
}

// ─── 메인 컴포넌트 ───

export default function AdminPage() {
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [logExpanded, setLogExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── 데이터 페치 ───

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/stores/search?name=${encodeURIComponent(STORE_NAME)}`
      );
      if (res.ok) {
        const data: StoreData = await res.json();
        setStoreData(data);
        // 최초 로드 시 전체 카테고리 펼침
        setExpandedCats((prev) =>
          prev.size === 0 ? new Set(data.categories.map((c) => c.id)) : prev
        );
        setError(null);
      } else {
        setError('매장 데이터를 불러올 수 없습니다.');
      }

      const { data: logs } = await supabase
        .from('change_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (logs) setChangeLogs(logs as ChangeLog[]);
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── 핸들러 ───

  const handleReset = async () => {
    if (!confirm('시드 데이터로 초기화하시겠습니까?\n모든 변경사항이 초기 상태로 되돌아갑니다.'))
      return;
    setResetting(true);
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      if (res.ok) {
        setSelectedMenuId(null);
        await fetchData();
      }
    } finally {
      setResetting(false);
    }
  };

  const toggleCat = (catId: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  // ─── 파생 데이터 ───

  const isRecent = (name: string) => {
    const now = Date.now();
    return changeLogs.some(
      (log) =>
        log.target_name === name &&
        now - new Date(log.created_at).getTime() < RECENT_MS
    );
  };

  const selectedMenu = storeData?.menus.find((m) => m.id === selectedMenuId);
  const menuLogs = selectedMenu
    ? changeLogs.filter((log) => log.target_name === selectedMenu.name)
    : [];

  const categoriesWithMenus =
    storeData?.categories
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((cat) => ({
        ...cat,
        menus: storeData.menus
          .filter((m) => m.categoryId === cat.id)
          .sort((a, b) => a.displayOrder - b.displayOrder),
      })) ?? [];

  // ─── 로딩 ───

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-500 text-lg">로딩 중...</p>
      </div>
    );
  }

  // ─── 렌더링 ───

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ── 헤더 ── */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏪</span>
          <h1 className="text-lg font-bold text-gray-900">
            가상 티오더 어드민
          </h1>
          {storeData && (
            <span className="text-sm text-gray-500">
              — {storeData.store.name}
            </span>
          )}
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {resetting ? '초기화 중...' : '데이터 초기화'}
        </button>
      </header>

      {error && (
        <div className="px-6 py-2 bg-yellow-50 text-yellow-800 text-sm border-b border-yellow-200 shrink-0">
          ⚠️ {error}
        </div>
      )}

      {/* ── 메인: 왼쪽 트리 + 오른쪽 상세 ── */}
      <div className="flex flex-1 min-h-0">
        {/* 왼쪽: 카테고리/메뉴 트리 */}
        <aside className="w-72 bg-white border-r border-gray-200 overflow-y-auto shrink-0">
          <div className="p-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              카테고리 / 메뉴
            </h2>
            {categoriesWithMenus.map((cat) => (
              <div key={cat.id} className="mb-1">
                {/* 카테고리 행 */}
                <button
                  onClick={() => toggleCat(cat.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ${
                    isRecent(cat.name) ? 'bg-blue-50 ring-1 ring-blue-200' : ''
                  }`}
                >
                  <span className="text-gray-400 text-base">
                    {expandedCats.has(cat.id) ? '📂' : '📁'}
                  </span>
                  <span className="font-medium text-gray-700 flex-1 text-left">
                    {cat.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({cat.menuCount})
                  </span>
                  {isRecent(cat.name) && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                  )}
                </button>

                {/* 메뉴 목록 */}
                {expandedCats.has(cat.id) && (
                  <div className="ml-5 border-l border-gray-200 pl-1">
                    {cat.menus.map((menu, idx) => {
                      const isLast = idx === cat.menus.length - 1;
                      const isSelected = selectedMenuId === menu.id;
                      return (
                        <button
                          key={menu.id}
                          onClick={() => setSelectedMenuId(menu.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-r-lg transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-100 text-blue-800 font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          } ${
                            isRecent(menu.name) && !isSelected
                              ? 'bg-blue-50'
                              : ''
                          }`}
                        >
                          <span className="text-gray-300 text-xs font-mono">
                            {isLast ? '└' : '├'}
                          </span>
                          <span className="flex-1 text-left truncate">
                            {menu.name}
                          </span>
                          {isRecent(menu.name) && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* 오른쪽: 메뉴 상세 + 변경 이력 */}
        <main className="flex-1 overflow-y-auto p-6">
          {selectedMenu ? (
            <div className="max-w-2xl">
              {/* 메뉴 정보 카드 */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {selectedMenu.name}
                </h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">카테고리</span>
                    <p className="font-medium text-gray-900 mt-1">
                      {selectedMenu.category}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">가격</span>
                    <p className="font-medium text-gray-900 mt-1">
                      {formatPrice(selectedMenu.price)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">표시 순서</span>
                    <p className="font-medium text-gray-900 mt-1">
                      {selectedMenu.displayOrder}번째
                    </p>
                  </div>
                </div>

                {/* 이미지 미리보기 */}
                <div className="mt-5">
                  <span className="text-sm text-gray-500">📷 이미지</span>
                  {selectedMenu.imageUrl ? (
                    <div className="mt-2 w-48 h-36 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedMenu.imageUrl}
                        alt={selectedMenu.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-400 italic">
                      이미지 없음
                    </p>
                  )}
                </div>
              </div>

              {/* 해당 메뉴 변경 이력 */}
              {menuLogs.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    변경 이력
                  </h3>
                  <div className="space-y-4">
                    {menuLogs.map((log) => {
                      const { before, after } = formatBeforeAfter(log);
                      return (
                        <div key={log.id} className="flex gap-3">
                          <div className="mt-1.5 shrink-0">
                            <span
                              className={`inline-block w-2.5 h-2.5 rounded-full ${
                                log.status === 'success'
                                  ? 'bg-blue-500'
                                  : 'bg-red-500'
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-500">
                                {getTimeAgo(log.created_at)}
                              </span>
                              <span className="text-gray-300">—</span>
                              <span className="font-medium text-gray-700">
                                {ACTION_LABELS[log.action] || log.action}
                              </span>
                            </div>
                            <div className="mt-1 text-sm space-y-0.5">
                              <div className="text-gray-500">
                                Before:{' '}
                                <span className="text-gray-700 break-all">
                                  {before}
                                </span>
                              </div>
                              <div className="text-gray-500">
                                After:{' '}
                                <span className="text-gray-700 break-all">
                                  {after}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-4xl mb-3">👈</p>
                <p>왼쪽에서 메뉴를 선택하세요</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── 하단: 전체 변경 로그 ── */}
      <div className="bg-white border-t border-gray-200 shrink-0">
        <button
          onClick={() => setLogExpanded(!logExpanded)}
          className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span>📋</span>
            <span className="text-sm font-semibold text-gray-700">
              전체 변경 로그
            </span>
            <span className="text-xs text-gray-400">
              ({changeLogs.length}건)
            </span>
          </div>
          <span className="text-sm text-gray-400">
            {logExpanded ? '접기 ▲' : '펼치기 ▼'}
          </span>
        </button>

        {logExpanded && (
          <div className="max-h-56 overflow-y-auto border-t border-gray-100">
            {changeLogs.length === 0 ? (
              <div className="px-6 py-8 text-sm text-gray-400 text-center">
                변경 이력이 없습니다
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-gray-500">
                    <th className="px-6 py-2 font-medium">시각</th>
                    <th className="px-4 py-2 font-medium">작업</th>
                    <th className="px-4 py-2 font-medium">대상</th>
                    <th className="px-4 py-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {changeLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-gray-50 hover:bg-gray-50"
                    >
                      <td className="px-6 py-2 text-gray-500 font-mono text-xs whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {ACTION_LABELS[log.action] || log.action}
                      </td>
                      <td className="px-4 py-2 text-gray-700">
                        {log.target_name}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            log.status === 'success'
                              ? 'text-green-700'
                              : 'text-red-700'
                          }`}
                        >
                          {log.status === 'success' ? '✅ 성공' : '❌ 실패'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
