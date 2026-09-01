"use client";

import { type ReactNode, useState, useEffect } from "react";

interface PageTransitionProps {
  children: ReactNode;
  show?: boolean;
  animation?: "fade" | "slide-up" | "slide-down" | "scale";
  duration?: "fast" | "normal" | "slow";
  className?: string;
}

/**
 * 页面过渡动画组件
 * 参考 OmniBoard、LibLib TV 等平台的过渡效果
 */
export function PageTransition({
  children,
  show = true,
  animation = "fade",
  duration = "normal",
  className = "",
}: PageTransitionProps) {
  const [isVisible, setIsVisible] = useState(show);
  const [, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!isVisible) return null;

  const animationClasses = {
    fade: show ? "animate-fade-in" : "opacity-0",
    "slide-up": show ? "animate-slide-up" : "opacity-0 translate-y-2",
    "slide-down": show ? "animate-slide-down" : "opacity-0 -translate-y-2",
    scale: show ? "animate-scale-in" : "opacity-0 scale-95",
  };

  const durationClasses = {
    fast: "duration-150",
    normal: "duration-200",
    slow: "duration-300",
  };

  return (
    <div
      className={`transition-all ${durationClasses[duration]} ${animationClasses[animation]} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * 淡入淡出过渡
 */
export function FadeTransition({
  children,
  show = true,
  className = "",
}: {
  children: ReactNode;
  show?: boolean;
  className?: string;
}) {
  return (
    <PageTransition show={show} animation="fade" className={className}>
      {children}
    </PageTransition>
  );
}

/**
 * 向上滑入过渡
 */
export function SlideUpTransition({
  children,
  show = true,
  className = "",
}: {
  children: ReactNode;
  show?: boolean;
  className?: string;
}) {
  return (
    <PageTransition show={show} animation="slide-up" className={className}>
      {children}
    </PageTransition>
  );
}

/**
 * 向下滑入过渡
 */
export function SlideDownTransition({
  children,
  show = true,
  className = "",
}: {
  children: ReactNode;
  show?: boolean;
  className?: string;
}) {
  return (
    <PageTransition show={show} animation="slide-down" className={className}>
      {children}
    </PageTransition>
  );
}

/**
 * 缩放过渡
 */
export function ScaleTransition({
  children,
  show = true,
  className = "",
}: {
  children: ReactNode;
  show?: boolean;
  className?: string;
}) {
  return (
    <PageTransition show={show} animation="scale" className={className}>
      {children}
    </PageTransition>
  );
}

/**
 * 骨架屏加载组件
 */
export function SkeletonLoader({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  // 使用预定义的宽度值，避免在渲染时调用 Math.random()
  const widths = [85, 72, 90, 65, 78];

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded animate-skeleton"
          style={{ width: `${widths[i % widths.length]}%` }}
        />
      ))}
    </div>
  );
}

/**
 * 加载状态组件
 */
export function LoadingSpinner({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "size-4",
    md: "size-6",
    lg: "size-8",
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-violet-500 border-t-transparent`} />
    </div>
  );
}

/**
 * 进度条组件
 */
export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  variant = "default",
  className = "",
}: {
  value: number;
  max?: number;
  showLabel?: boolean;
  variant?: "default" | "success" | "warning" | "error";
  className?: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);

  const variantClasses = {
    default: "bg-violet-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${variantClasses[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
          <span>{Math.round(percentage)}%</span>
          <span>{value}/{max}</span>
        </div>
      )}
    </div>
  );
}
