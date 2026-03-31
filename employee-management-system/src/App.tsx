import React, { useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { AppProvider } from './context/AppContext';
import { router } from './router';
import { trpc, queryClient, trpcClient } from './lib/trpc';
import { QueryClientProvider } from '@tanstack/react-query';

export default function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <RouterProvider router={router} />
        </AppProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
