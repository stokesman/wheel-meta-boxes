((wp) => {

const { dispatch, select, subscribe } = wp.data
const { store: editorStore } = wp.editor
const { store: editPostStore } = wp.editPost
const { store: preferencesStore } = wp.preferences

/** @param {Element} element */
const isScrollMax = element => {
	const { scrollTop, scrollHeight, clientHeight } = element
	// At some viewport heights the scrollHeight minus the clientHeight is a
	// decimal and the scrollTop never matches that. Thus the maximum scroll
	// is considered reached if within one pixel of the remainder.
	return (scrollHeight - clientHeight) - scrollTop <= 1
}

/**
 * @param {HTMLElement} canvas
 * @param {HTMLElement} metaPane
 */
const activate = ( canvas, metaPane ) => {
	const editorDocument = metaPane.ownerDocument

	const getThreshold = () =>
		select(preferencesStore).get('s8/wheel-meta-boxes', 'threshold')

	/** @type {import('$types').Mode} */
	const mode = select(preferencesStore).get('s8/wheel-meta-boxes', 'mode')

	/** @param {Number} nextHeight */
	const applyHeight = nextHeight => {
		metaPane.style.height = `${nextHeight}px`
		dispatch(preferencesStore).set(
			editPostStore.name,
			'metaBoxesMainOpenHeight',
			nextHeight
		)
	}

	/** @param {Number} by */
	const adjustSplit = ( by ) => {
		const { height, minHeight, maxHeight } = metaPane.style
		const fromHeight = height === 'auto'
			? metaPane.offsetHeight
			: parseFloat( height );
		const nextHeight = Math.max(
			parseFloat(minHeight), Math.min(
				parseFloat(maxHeight),
				fromHeight + by
			)
		)
		applyHeight( nextHeight )
	}

	const cleanSet = new Set;
	const cleanUp = () => cleanSet.forEach(clean => clean())
	/**
	 * Convenient way to add listeners and add a removal callback for easy cleanup.
	 * @template {EventTarget} T
	 * @template {keyof HTMLElementEventMap} E
	 * @param {T} target
	 * @param {E} type
	 * @param {(event: HTMLElementEventMap[E]) => void} listener
	 * @param {Parameters<EventTarget['addEventListener']>[2]=} options
	 */
	const cleanlyListen = (target, type, listener, options) => {
		target.addEventListener(type, listener, options);
		cleanSet.add(() => target.removeEventListener(type, listener, options))
	}

	// Freewheeling logic
	if ( select(preferencesStore).get('s8/wheel-meta-boxes', 'freewheeling') ) {
		const interfaceContent = /**@type {HTMLElement}*/(metaPane.parentElement)
		/** @param {WheelEvent} event */
		const hotKeyAdjustSplit = event => {
			// Prevents default for a couple of reasons:
			// 1. It mostly cures an issue in Firefox in which wheel events lingeringly
			// dispatch on targets which can make scrolling that started before holding
			// the Control key continue unexpectedly when adjusting the split.
			// 2. It avoids browser zooming.
			event.preventDefault()
			adjustSplit( event.deltaY )
		}
		// Toggles an overlay on Control key press/release for adjusting the split.
		cleanlyListen(editorDocument, 'keydown', ({key}) => {
			if (key === 'Control') {
				interfaceContent.classList.add('&wheel-overlay')
				interfaceContent.addEventListener('wheel', hotKeyAdjustSplit)
				// On macOS there’s a chance someone could be using the Control key
				// to alternate click and the overlay may block the intended target.
				// To avoid that, this hides the overlay on pointerdown.
				interfaceContent.addEventListener('pointerdown', () => {
					interfaceContent.classList.remove('&wheel-overlay')
					interfaceContent.removeEventListener('wheel', hotKeyAdjustSplit)
				}, {once: true})
			}
		})
		cleanlyListen(editorDocument, 'keyup', ({key}) => {
			if (key === 'Control') {
				interfaceContent.classList.remove('&wheel-overlay')
				interfaceContent.removeEventListener('wheel', hotKeyAdjustSplit)
			}
		})
	}

	// All done if mode is 'none';
	if ( mode === 'none' ) return cleanUp;

	let isStickingScroll = false;
	const metaPaneLiner = /**@type {HTMLElement}*/(metaPane.querySelector('.edit-post-layout__metaboxes'))

	// Meta pane wheel handling depending on mode.
	if ( mode === 'gradual' )
		cleanlyListen( metaPane, 'wheel', ( event ) => {
			if ( metaPaneLiner.scrollTop === 0 && isScrollMax( canvas ) ) {
				adjustSplit( event.deltaY )
				isStickingScroll = true
				if ( canvasHeight > 0 ) event.preventDefault();
			}
		}, { passive: false })
	else
		cleanlyListen( metaPane, 'wheel', ( event ) => {
			if ( event.deltaY <= -getThreshold() ) {
				if ( metaPaneLiner.scrollTop === 0 ) {
					const { minHeight } = metaPane.style
					applyHeight( parseFloat(minHeight) )
				}
			}
		}, { passive: true })

	// Canvas wheel handling. Single listener used since passive suffices for either mode.
	cleanlyListen(canvas, 'wheel', ( event ) => {
		if ( isScrollMax( canvas ) ) {
			if ( mode === 'gradual' ) {
				adjustSplit( event.deltaY )
				isStickingScroll = true
			} else {
				if ( event.deltaY >= getThreshold() ) {
					const { maxHeight } = metaPane.style
					applyHeight( parseFloat( maxHeight ) )
				}
			}
		}
	}, { passive: true })

	// Tracks canvas height for use with gradual mode.
	let canvasHeight = -1
	if ( mode === 'gradual' ) {
		const canvasIframe = canvas.ownerDocument.defaultView?.frameElement
		const stickScrollOnResize = new ResizeObserver( ([{ borderBoxSize }]) => {
			[{ blockSize: canvasHeight }] = borderBoxSize
			if ( isStickingScroll ) {
				isStickingScroll = false;
				canvas.scrollTop = canvas.scrollHeight
			}
		} )
		stickScrollOnResize.observe( canvasIframe || canvas )
		cleanSet.add(() => stickScrollOnResize.disconnect())
	}
	return cleanUp
}

const getCanvas = () => window['editor-canvas']?.document.documentElement ?? null
const getInlineCanvas = () => /**@type {HTMLElement?}*/(document.querySelector('.block-editor-block-canvas'))
const getMetaPane = () => /**@type {HTMLElement?}*/(editorContainer.querySelector('.edit-post-meta-boxes-main'))

const editorContainer = /** @type {Element} */(document.querySelector('#editor'))
// Observes mutations within editorContainer until it can be determined whether
// the canvas is iframe’d.
const spy = new MutationObserver(() => {
	const visualEditor = editorContainer.querySelector('.editor-visual-editor')
	if ( ! visualEditor ) return

	spy.disconnect();
	if ( ! getMetaPane() ) return;

	const canvasWindow = window['editor-canvas'];
	// Canvas iframe is present.
	if ( canvasWindow ) canvasWindow.onload = () => initiate( getCanvas )
	// WP 6.8 has the resizable meta box pane even without the iframe.
	else if ( getInlineCanvas() ) initiate( getInlineCanvas )
})
spy.observe(editorContainer, {childList:true, subtree:true})

// Adds style for the interface content element’s overlay.
const wheelStyle = document.createElement('style')
wheelStyle.textContent = `
	.\\&wheel-overlay.interface-interface-skeleton__content::before {
		content:'';
		position:absolute;
		inset: 0;
		z-index: 99999;
	}
`
document.head.appendChild(wheelStyle)

/** @param {() => (HTMLElement | null)} canvasGetter */
const initiate = ( canvasGetter ) => {
	let deactivator = () => {};
	const activator = () => {
		deactivator();
		const canvas = canvasGetter();
		const metaPane = getMetaPane();
		if ( canvas && metaPane ) deactivator = activate( canvas, metaPane )
	}
	activator();
	// It’s possible for the editor to switch the post type to a pattern or
	// template part where the meta box pane is no longer available. When
	// switching back to the post the wheel handling has to be reactivated
	// and this adds a subscriber to ensure that happens.
	let stalePostType = ''
	subscribe( () => {
		const postType = select(editorStore.name).getCurrentPostType()
		if (!stalePostType) stalePostType = postType
		else if (postType !== stalePostType) {
			stalePostType = postType
			if ('post' === postType) activator();
		}
	}, editorStore)
	// Subscribes to mode and freewheeling preference changes to reactivate handling.
	let stalePrefsKey = ''
	subscribe(() => {
		const prefsKey = `${
			select(preferencesStore.name).get('s8/wheel-meta-boxes', 'mode') }-${
			select(preferencesStore.name).get('s8/wheel-meta-boxes', 'freewheeling')
		}`
		if (!stalePrefsKey) stalePrefsKey = prefsKey
		else if (prefsKey !== stalePrefsKey) {
			stalePrefsKey = prefsKey
			activator();
		}
	}, preferencesStore)
}

})(window.wp)
