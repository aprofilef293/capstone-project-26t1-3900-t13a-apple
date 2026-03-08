import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import { RootLayout } from './components/layout/RootLayout';
import { Dashboard } from './pages/Dashboard';
import { DataManager } from './pages/DataManager';
import { GraphExplorer } from './pages/GraphExplorer';
import { Settings } from './pages/Settings';
import { ThemeProvider } from './components/theme-provider';

// 1. Initialise TanStack Query Client
const queryClient = new QueryClient();

// 2. Define TanStack Routes
const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
})

const managerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/manager',
  component: DataManager,
})


const explorerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/explorer',
  component: GraphExplorer,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
})

const routeTree = rootRoute.addChildren([indexRoute, managerRoute, explorerRoute, settingsRoute])
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// 3. Assemble the Main App
function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
