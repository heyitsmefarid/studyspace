import { RouterProvider } from 'react-router';
import { Providers } from './app/providers';
import { router } from './app/router';
import { supabaseConfigured } from './lib/supabase';
import { SetupNeeded } from './app/SetupNeeded';
import { Splash } from './app/Splash';

export default function App() {
  if (!supabaseConfigured) return <SetupNeeded />;
  return <><Providers><RouterProvider router={router} /></Providers><Splash /></>;
}
