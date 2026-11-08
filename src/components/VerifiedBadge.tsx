import React from 'react';

interface VerifiedBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  title?: string;
}

const SIZE_MAP = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  xl: 'w-6 h-6',
};

/**
 * High-quality, authentic blue verified badge.
 * Designed with zero outer glow, zero outer border/halo, and crisp geometry.
 */
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ 
  className,
  size,
  title = "Verified Account" 
}) => {
  const sizeClass = size ? SIZE_MAP[size] : (className || 'w-4 h-4');

  return (
    <span 
      className={`inline-flex items-center justify-center shrink-0 align-middle ${className && !size ? className : sizeClass}`}
      title={title}
      aria-label={title}
    >
      <svg 
        viewBox="0 0 24 24" 
        className="w-full h-full block" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Authentic 12-scallop rosette badge without blur, shadow or stroke */}
        <path 
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z" 
          fill="#1D9BF0" 
        />
        {/* Crisp, perfectly centered white checkmark */}
        <path 
          d="M10.2 16.2 6.5 12.5l1.4-1.4 2.3 2.3 6.9-6.9 1.4 1.4-8 8.1z" 
          fill="#FFFFFF" 
        />
      </svg>
    </span>
  );
};

/**
 * Avatar corner verified badge overlay helper
 */
export const VerifiedAvatarBadge: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = ''
}) => {
  const dimensionClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  return (
    <div className={`absolute bottom-0 right-0 z-10 pointer-events-none transform translate-x-0.5 translate-y-0.5 ${className}`}>
      <VerifiedBadge className={dimensionClass} />
    </div>
  );
};

export default VerifiedBadge;
