"use client";

import { type ReactNode } from "react";

interface EnhancedCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "outlined" | "glass";
  hover?: boolean;
  onClick?: () => void;
}

/**
 * 增强卡片组件
 * 参考 LibLib TV、海螺AI 等平台的卡片设计
 */
export function EnhancedCard({
  children,
  className = "",
  variant = "default",
  hover = true,
  onClick,
}: EnhancedCardProps) {
  const baseClasses = "rounded-xl transition-all duration-200";

  const variantClasses = {
    default: "bg-zinc-900/80 border border-zinc-800/60",
    elevated: "bg-zinc-900/90 border border-zinc-800/60 shadow-lg shadow-black/20",
    outlined: "bg-transparent border border-zinc-700/60",
    glass: "glass-effect",
  };

  const hoverClasses = hover
    ? "card-hover-lift cursor-pointer"
    : "";

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${hoverClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/**
 * 卡片头部
 */
export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between border-b border-zinc-800/60 px-4 py-3 ${className}`}>
      {children}
    </div>
  );
}

/**
 * 卡片内容
 */
export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  );
}

/**
 * 卡片底部
 */
export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between border-t border-zinc-800/60 px-4 py-3 ${className}`}>
      {children}
    </div>
  );
}

/**
 * 卡片标题
 */
export function CardTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`text-sm font-semibold text-zinc-200 ${className}`}>
      {children}
    </h3>
  );
}

/**
 * 卡片描述
 */
export function CardDescription({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-xs text-zinc-400 ${className}`}>
      {children}
    </p>
  );
}

/**
 * 状态徽章
 */
export function StatusBadge({
  status,
  label,
}: {
  status: "success" | "warning" | "error" | "info" | "pending";
  label: string;
}) {
  const statusClasses = {
    success: "bg-emerald-900/50 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-900/50 text-amber-400 border-amber-500/30",
    error: "bg-red-900/50 text-red-400 border-red-500/30",
    info: "bg-blue-900/50 text-blue-400 border-blue-500/30",
    pending: "bg-zinc-800/50 text-zinc-400 border-zinc-600/30",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${statusClasses[status]}`}>
      {label}
    </span>
  );
}

/**
 * 操作按钮组
 */
export function ActionButtons({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {children}
    </div>
  );
}

/**
 * 操作按钮
 */
export function ActionButton({
  icon,
  label,
  onClick,
  variant = "ghost",
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "ghost" | "primary" | "danger";
  disabled?: boolean;
}) {
  const variantClasses = {
    ghost: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
    primary: "text-violet-400 hover:bg-violet-950/30 hover:text-violet-300",
    danger: "text-red-400 hover:bg-red-950/30 hover:text-red-300",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md p-1.5 transition-colors ${variantClasses[variant]} disabled:opacity-50 disabled:pointer-events-none`}
      title={label}
    >
      {icon}
    </button>
  );
}
