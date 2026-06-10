import React from 'react';
import clsx from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className, title, ...props }) => {
    return (
        <div
            className={clsx(
                'zx-card p-4 transition-all duration-300',
                className
            )}
            {...props}
        >
            {title && (
                <h3 className="text-lg font-semibold mb-4 text-slate-100 border-b border-slate-700 pb-2">
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
};
