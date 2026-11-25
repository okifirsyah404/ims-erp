import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// Import the generated route tree
import { ThemeProvider } from './components/theme-provider';
import { setupI18n } from './i18n';
import { queryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
	interface Register {
		router: typeof router;
	}
}

// Render the app
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	// i18next forbids `t()` before its init resolves, so mounting waits for it.
	// Otherwise the first paint would flash raw keys or the wrong language.
	void setupI18n().then(() => {
		root.render(
			<StrictMode>
				<ThemeProvider defaultTheme='system' storageKey='ui-theme'>
					<QueryClientProvider client={queryClient}>
						<RouterProvider router={router} />
					</QueryClientProvider>
				</ThemeProvider>
			</StrictMode>,
		);
	});
}
