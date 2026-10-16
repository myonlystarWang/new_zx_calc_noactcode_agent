import React from 'react';
import { BuffSelector } from './BuffSelector';

export const BuffPanel: React.FC<{ onNavigateToFocus?: () => void }> = ({ onNavigateToFocus }) => {
    return (
        <div>
            {/* Buff Selector */}
            <BuffSelector onNavigateToFocus={onNavigateToFocus} />
        </div>
    );
};
