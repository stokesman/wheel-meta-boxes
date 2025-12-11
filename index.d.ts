interface CustomEventMap {
	editorcanvascomplete: CustomEvent<EditorCanvasCompleteEventDetail>
}

declare global {
	interface Window {
		'editor-canvas'?: Window
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
		}
		addEventListener<K extends keyof CustomEventMap>(
			type: K,
			listener: (this: Window, ev: CustomEventMap[K]) => void,
			options?: boolean | AddEventListenerOptions
		): void
		dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K]): void
	}
}

type EditorCanvasCompleteEventDetail = boolean

export type Mode = 'gradual'|'whole'|'none'
