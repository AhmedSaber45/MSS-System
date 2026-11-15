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
        'bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden transition-colors',
        hoverable && 'hover:border-slate-400 hover:shadow',
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
      className={cn('px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50', className)}
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
    <h3 className={cn('text-base font-bold text-slate-900', className)} {...props}>
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
    <p className={cn('text-sm text-slate-600 mt-1 leading-normal', className)} {...props}>
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
    <div className={cn('p-6', className)} {...props}>
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
      className={cn('px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between', className)}
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
    <Card className={cn('p-5 flex flex-col justify-between h-full', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700 leading-snug">{title}</span>
        {Icon && (
          <div className="text-slate-700 p-2.5 rounded-lg bg-slate-100 border border-slate-300 shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3.5">
        <div className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
          {value}
        </div>

        {subtitle && (
          <p className="text-sm text-slate-600 mt-1.5 truncate font-normal">{subtitle}</p>
        )}

        {trend && (
          <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-200 text-xs">
            <span
              className={cn(
                'font-bold rounded-md px-1.5 py-0.5 text-xs tabular-nums border',
                trend.isPositive
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-rose-50 text-rose-900 border-rose-300'
              )}
            >
              {trend.value}
            </span>
            <span className="text-slate-500 text-xs font-medium">مقارنة بالفترة السابقة</span>
          </div>
        )}
      </div>
    </Card>
  );
};
