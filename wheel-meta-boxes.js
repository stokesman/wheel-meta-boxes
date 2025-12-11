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
	 * @template {keyof HTMLElementEventMap | keyof DocumentEventMap} E
	 * @param {T} target
	 * @param {E} type
	 * @param {(event: (HTMLElementEventMap & DocumentEventMap)[E]) => void} listener
	 * @param {Parameters<EventTarget['addEventListener']>[2]=} options
	 */
	const cleanlyListen = (target, type, listener, options) => {
		target.addEventListener(type, listener, options);
		cleanSet.add(() => target.removeEventListener(type, listener, options))
	}

	// Minimizes the pane whenever the document isn't visible if the preference is
	// to start minimized. Doing it this way instead of minimizing it upon initiation
	// ensures the pane doesn't briefly fill space before that.
	if ( select(preferencesStore).get('s8/wheel-meta-boxes', 'setsOnExit') ) {
		let stashedHeight = '';
		cleanlyListen(editorDocument, 'visibilitychange', () => {
			if (editorDocument.hidden) {
				stashedHeight = metaPane.style.height
				applyHeight( 0 )
			} else
				applyHeight( parseFloat( stashedHeight ) )
		})
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
	const gradualModeContraDetachmentBuffer = () => {
		const self = gradualModeContraDetachmentBuffer
		self.isActive = true;
		clearTimeout( self.tId );
		self.tId = setTimeout( () => {
			self.isActive = false;
			console.log('deactivating gradualModeContraDetachmentBuffer')
		}, 1000 );
	}
	gradualModeContraDetachmentBuffer.isActive = false
	gradualModeContraDetachmentBuffer.tId = -1

	// Meta pane wheel handling depending on mode.
	if ( mode === 'gradual' )
		cleanlyListen( metaPane, 'wheel', ( event ) => {
			const isScrollBounded = metaPaneLiner.scrollTop === 0 && isScrollMax( canvas )
			if (
				isScrollBounded ||
				gradualModeContraDetachmentBuffer.isActive
			) {
				// const el = event.target.ownerDocument.elementFromPoint
				console.log('meta pane', {bufferState: gradualModeContraDetachmentBuffer.isActive, isScrollBounded})
				// console.log('meta pane', {elFromPoint: document.elementFromPoint(event.clientX, event.clientY)})
				adjustSplit( event.deltaY )
				isStickingScroll = true
				gradualModeContraDetachmentBuffer()
				if ( canvasHeight > 0 ) event.preventDefault()
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
		if ( mode === 'gradual' ) {
			if (
				isScrollMax( canvas ) ||
				gradualModeContraDetachmentBuffer.isActive
			) {
				console.log('canvas', {bufferState: gradualModeContraDetachmentBuffer.isActive, isScrollMax: isScrollMax(canvas)})
				adjustSplit( event.deltaY )
				isStickingScroll = true
				gradualModeContraDetachmentBuffer()
			}
		} else {
			if ( isScrollMax( canvas ) && event.deltaY >= getThreshold() ) {
				const { maxHeight } = metaPane.style
				applyHeight( parseFloat( maxHeight ) )
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
const getMetaPane = () => /**@type {HTMLElement?}*/(document.querySelector('.edit-post-meta-boxes-main'))

window.addEventListener(
	'editorcanvascomplete',
	({detail: isIframed}) => {
		if ( isIframed ) initiate( getCanvas )
		// WP 6.8 has the resizable meta box pane even without the iframe and a
		// classname on the block canvas, so if that’s found, initiate.
		else if ( getInlineCanvas() ) initiate( getInlineCanvas )
	},
	{ once: true }
);

activate.dependentPreferences = ['mode', 'freewheeling', 'setsOnExit']
const getPrefsKey = () => {
	let key = ''
	for ( const prefName of activate.dependentPreferences )
		key += `${select(preferencesStore.name).get('s8/wheel-meta-boxes', prefName)}-`
	return key
}

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
	let stalePostType = select(editorStore.name).getCurrentPostType()
	subscribe( () => {
		const postType = select(editorStore.name).getCurrentPostType()
		if (postType !== stalePostType) {
			stalePostType = postType
			if ('post' === postType) activator();
		}
	}, editorStore)
	// Subscribes to preference store changes to reactivate.
	let stalePrefsKey = getPrefsKey()
	subscribe(() => {
		const prefsKey = getPrefsKey()
		if (prefsKey !== stalePrefsKey) {
			stalePrefsKey = prefsKey
			activator();
		}
	}, preferencesStore)

	// Adds style for the interface content element’s overlay. Ideally, this might
	// only be done when the 'freewheeling' preference is true but it’d want a
	// cleanup routine as well.
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
}

})(window.wp)
