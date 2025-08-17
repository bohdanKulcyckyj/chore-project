import React from 'react';
import { Menu, MenuButton, MenuItems, MenuItem, Transition } from '@headlessui/react';
import { Fragment } from 'react';

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
  return (
    <Menu as="div" className={`relative inline-block ${className}`}>
      <MenuButton className="flex items-center justify-center p-1 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
        {trigger}
      </MenuButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <MenuItems className={`absolute z-50 bottom-full mb-1 min-w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 focus:outline-none ${
          align === 'right' ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'
        }`}>
          {items.map((item) => (
            <MenuItem key={item.id} disabled={item.disabled}>
              {({ focus }) => (
                <button
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={`
                    w-full flex items-center px-4 py-2 text-sm text-left transition-colors
                    ${item.disabled 
                      ? 'text-gray-400 cursor-not-allowed' 
                      : item.variant === 'danger'
                        ? focus 
                          ? 'bg-red-50 text-red-800' 
                          : 'text-red-700'
                        : focus 
                          ? 'bg-gray-50 text-gray-900' 
                          : 'text-gray-700'
                    }
                  `}
                >
                  {item.icon && (
                    <span className="mr-3 flex-shrink-0">
                      {item.icon}
                    </span>
                  )}
                  {item.label}
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Transition>
    </Menu>
  );
};

export default DropdownMenu;