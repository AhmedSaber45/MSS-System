import React from 'react';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, hoverable = false, children, ...props }) => {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200/90 shadow-subtle overflow-hidden transition-colors',
        hoverable && 'hover:border-slate-300',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('px-5 py-3.5 border-b border-slate-100 flex items-center justify-between', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <h3 className={cn('text-sm font-semibold text-slate-900', className)} {...props}>
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <p className={cn('text-xs text-slate-500 mt-0.5', className)} {...props}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  accentColor?: 'blue' | 'teal' | 'emerald' | 'amber' | 'rose' | 'indigo';
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}) => {
  return (
    <Card className={cn('p-4 flex flex-col justify-between h-full', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-slate-500 leading-snug">{title}</span>
        {Icon && (
          <div className="text-slate-400 p-1 rounded-md bg-slate-50 border border-slate-100 shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
          {value}
        </div>

        {subtitle && (
          <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>
        )}

        {trend && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 text-xs">
            <span
              className={cn(
                'font-medium rounded px-1 py-0.5 text-[11px] tabular-nums',
                trend.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              )}
            >
              {trend.value}
            </span>
            <span className="text-slate-400 text-[11px]">مقارنة بالفترة السابقة</span>
          </div>
        )}
      </div>
    </Card>
  );
};
