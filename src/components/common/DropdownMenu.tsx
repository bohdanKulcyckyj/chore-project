import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
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
  }, [isOpen]);

  const handleItemClick = (item: DropdownMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownWidth = 160; // min-w-40 = 160px
      const dropdownHeight = items.length * 40 + 8; // Approximate height (40px per item + padding)
      const gap = 4;
      const margin = 8;
      
      // Calculate horizontal position
      let left = align === 'right' 
        ? rect.right + window.scrollX - dropdownWidth
        : rect.left + window.scrollX;
      
      // Adjust if dropdown would go off-screen horizontally
      if (left + dropdownWidth > window.innerWidth + window.scrollX) {
        left = window.innerWidth + window.scrollX - dropdownWidth - margin;
      }
      if (left < window.scrollX + margin) {
        left = window.scrollX + margin;
      }
      
      // Calculate vertical position - this is the key fix
      let top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Check if there's enough space below for the dropdown
      if (spaceBelow >= dropdownHeight + gap + margin) {
        // Position below
        top = rect.bottom + window.scrollY + gap;
      } else if (spaceAbove >= dropdownHeight + gap + margin) {
        // Position above
        top = rect.top + window.scrollY - dropdownHeight - gap;
      } else {
        // Not enough space in either direction, position for best fit
        if (spaceBelow > spaceAbove) {
          // More space below, position at bottom of viewport
          top = window.innerHeight + window.scrollY - dropdownHeight - margin;
        } else {
          // More space above, position at top of viewport
          top = window.scrollY + margin;
        }
      }
      
      setPosition({ top, left });
    }
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        className="flex items-center justify-center p-1 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {trigger}
      </button>

      {/* Dropdown Menu - Rendered in Portal */}
      {isOpen && createPortal(
        <AnimatePresence>
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[9999] min-w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
            style={{
              top: position.top,
              left: position.left
            }}
            role="menu"
            aria-orientation="vertical"
          >
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
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
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

export default DropdownMenu;