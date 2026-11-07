import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth';
import { HouseholdProvider } from './hooks/useHousehold';
import { router } from './router';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <RouterProvider router={router} />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
              borderRadius: '12px',
              // ponytail: a toast sits at z-9999 with pointer-events:auto and
              // eats every tap underneath it for its whole duration. Nothing
              // here is clickable, so turn the toast into glass.
              pointerEvents: 'none',
            },
          }}
        />
      </HouseholdProvider>
    </AuthProvider>
  );
};

export default App;
