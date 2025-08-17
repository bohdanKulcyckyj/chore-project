import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  align?: 'left' | 'right';
  className?: string;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  trigger,
  items,
  align = 'right',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 160; // min-w-40
      const dropdownHeight = items.length * 40 + 8;
      const gap = 4;
      const margin = 8;

      // Calculate horizontal position
      let left = align === 'right' 
        ? rect.right + window.scrollX - dropdownWidth
        : rect.left + window.scrollX;
      
      // Keep within viewport horizontally
      if (left + dropdownWidth > window.innerWidth + window.scrollX) {
        left = window.innerWidth + window.scrollX - dropdownWidth - margin;
      }
      if (left < window.scrollX + margin) {
        left = window.scrollX + margin;
      }

      // Calculate vertical position - prefer above
      let top = rect.top + window.scrollY - dropdownHeight - gap;
      
      // If not enough space above, position below
      if (top < window.scrollY + margin) {
        top = rect.bottom + window.scrollY + gap;
      }

      setPosition({ top, left });
    }
  }, [align, items.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  const handleButtonClick = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        className={`relative inline-block flex items-center justify-center p-1 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${className}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {trigger}
      </button>

      {isOpen && createPortal(
        <div
          className="fixed z-[9999] min-w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
          style={{
            top: position.top,
            left: position.left,
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'scale(1)' : 'scale(0.95)',
            transition: 'opacity 100ms ease-out, transform 100ms ease-out'
          }}
          role="menu"
          aria-orientation="vertical"
        >
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  setIsOpen(false);
                }
              }}
              disabled={item.disabled}
              onMouseEnter={(e) => e.currentTarget.classList.add('bg-gray-50')}
              onMouseLeave={(e) => e.currentTarget.classList.remove('bg-gray-50')}
              className={`
                w-full flex items-center px-4 py-2 text-sm text-left transition-colors
                ${item.disabled 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : item.variant === 'danger'
                    ? 'text-red-700 hover:bg-red-50 hover:text-red-800'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
              role="menuitem"
            >
              {item.icon && (
                <span className="mr-3 flex-shrink-0">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

export default DropdownMenu;