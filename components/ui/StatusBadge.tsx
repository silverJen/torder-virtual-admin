'use client';

export interface StatusBadgeProps {
  status: 'success' | 'failure' | 'pending';
  label?: string;
  className?: string;
}

const styleMap = {
  success: 'bg-green-100 text-green-800',
  failure: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

const defaultLabelMap = {
  success: '성공',
  failure: '실패',
  pending: '대기',
};

export default function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styleMap[status]} ${className}`}
    >
      {label ?? defaultLabelMap[status]}
    </span>
  );
}
