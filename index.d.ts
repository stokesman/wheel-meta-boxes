export declare global {
	interface Window {
		['editor-canvas']: Window | undefined;
		wp: {
			[ _: string ]: unknown
			components: typeof import('@wordpress/components')
			compose: typeof import('@wordpress/compose')
			data: typeof import('@wordpress/data')
			editor: typeof import('@wordpress/editor')
			editPost: typeof import('@wordpress/edit-post')
			element: typeof import('@wordpress/element')
			keycodes: typeof import('@wordpress/keycodes')
			plugins: typeof import('@wordpress/plugins')
			preferences: typeof import('@wordpress/preferences')
		};
	}
}
