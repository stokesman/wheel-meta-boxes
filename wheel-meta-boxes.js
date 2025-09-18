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
 * @param {Document=}   editorDocument
 */
const initiate = ( canvas, editorDocument = canvas.ownerDocument) => {
	const metaPane = /**@type {HTMLElement?}*/(editorDocument.querySelector('.edit-post-meta-boxes-main'))
	console.log('handle wheeling', {canvas, metaPane})
	// Bails when the metaPane doesn’t exist (editing patterns/template parts).
	if ( ! metaPane ) return;

	const getThreshold = () =>
		select(preferencesStore).get('s8/wheel-meta-boxes', 'threshold')
	const getMode = () =>
		select(preferencesStore).get('s8/wheel-meta-boxes', 'mode')
	const getFreeWheeling = () =>
		select(preferencesStore).get('s8/wheel-meta-boxes', 'freewheeling')

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
		const nextHeight = Math.max(
			parseFloat(minHeight), Math.min(
				parseFloat(maxHeight),
				parseFloat(height) + by
			)
		)
		applyHeight( nextHeight )
	}

	const interfaceContent = /**@type {HTMLElement}*/(metaPane.parentElement)
	/** @param {WheelEvent} event */
	const hotKeyAdjustSplit = event => {
		// In Firefox wheel events lingeringly dispatch on targets which can make scrolling
		// that started before holding the Control key continue unexpectedly when adjusting
		// the split. Preventing default cures it (besides maybe a sliver).
		event.preventDefault()
		adjustSplit( event.deltaY )
	}
	// Toggles an overlay on Control key press/release for adjusting the split.
	// While the listeners added to the meta pane and the canvas could be used
	// for this same feature, it doesn’t work quite as seamlessly.
	editorDocument.addEventListener('keydown', ({key}) => {
		if (getFreeWheeling() && key === 'Control') {
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
	editorDocument.addEventListener('keyup', ({key}) => {
		if (getFreeWheeling() && key === 'Control') {
			interfaceContent.classList.remove('&wheel-overlay')
			interfaceContent.removeEventListener('wheel', hotKeyAdjustSplit)
		}
	})

	let isStickingScroll = false;

	const metaPaneLiner = /**@type {HTMLElement}*/(metaPane.querySelector('.edit-post-layout__metaboxes'))
	/** @param {WheelEvent} event */
	const onMetaWheel = ( event ) => {
		console.log('meta wheel')
		switch ( getMode() ) {
			case 'gradual':
				if ( metaPaneLiner.scrollTop === 0 && isScrollMax( canvas ) ) {
					adjustSplit( event.deltaY )
					isStickingScroll = true
					if ( canvasIframeHeight > 0 ) event.preventDefault();
				}
				break;
			case 'whole':
				if ( event.deltaY <= -getThreshold() ) {
					if ( metaPaneLiner.scrollTop === 0 ) {
						const { minHeight } = metaPane.style
						metaPane.style.height = minHeight
						applyHeight( parseFloat(minHeight) )
					}
				}
		}
	}
	metaPane.addEventListener('wheel', onMetaWheel, { passive: false })

	/** @param {WheelEvent} event */
	const onCanvasWheel = ( event ) => {
		if ( isScrollMax( canvas ) ) {
			switch( getMode() ) {
				case 'gradual':
					adjustSplit( event.deltaY )
					isStickingScroll = true
					break;
				case 'whole':
					if ( event.deltaY >= getThreshold() ) {
						const { maxHeight } = metaPane.style
						metaPane.style.height = maxHeight
						applyHeight( parseFloat( maxHeight ) )
					}
			}
		}
	}
	canvas.addEventListener('wheel', onCanvasWheel, { passive: true })

	let canvasIframeHeight = -1
	if ( getMode() === 'gradual' ) {
		const canvasIframe = canvas.ownerDocument.defaultView?.frameElement
		const stickScrollOnResize = new ResizeObserver( ([{ borderBoxSize }]) => {
			console.log('canvas resize');
			[{ blockSize: canvasIframeHeight }] = borderBoxSize
			if ( isStickingScroll ) {
				console.log('sticking the scroll')
				isStickingScroll = false;
				canvas.scrollTop = canvas.scrollHeight
			}
		} )
		/** @todo test with WP 6.8 non-iframed canvas */
		stickScrollOnResize.observe( canvasIframe || canvas )
	}
}

const getCanvas = () => {
	const canvasWindow = window['editor-canvas']
	return canvasWindow
		? canvasWindow.document.documentElement
		: /**@type {HTMLElement?}*/(document.querySelector('.block-editor-block-canvas'))
}

const editorContainer = /** @type {Element} */(document.querySelector('#editor'))
// Observes mutations within editorContainer until it can be determined whether
// the canvas is iframe’d.
const spy = new MutationObserver(() => {
	const visualEditor = editorContainer.querySelector('.editor-visual-editor')
	if ( ! visualEditor ) return

	spy.disconnect();
	const canvasWindow = window['editor-canvas'];
	// Canvas iframe is present.
	if ( canvasWindow ){
		canvasWindow.onload = () => {
			initiate(canvasWindow.document.documentElement, document)
			reiniateOnPostTypeChange()
		}
	}
	// WP 6.8 has the resizable meta box pane even without the iframe.
	else if ( editorContainer.querySelector('.edit-post-meta-boxes-main') ) {
		const canvas = getCanvas();
		if ( ! canvas ) return;

		initiate( canvas )
		reiniateOnPostTypeChange()
	}
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

// It’s possible for the editor to switch the post type to a pattern or
// template part where the meta box pane is no longer available. When
// switching back to the post the wheel handling has to be reinitiated
// and this adds a subscriber to ensure that happens.
const reiniateOnPostTypeChange = () => {
	let stalePostType = ''
	subscribe( () => {
		const postType = select(editorStore.name).getCurrentPostType()
		if (!stalePostType) stalePostType = postType
		else if (postType !== stalePostType) {
			stalePostType = postType
			const canvas = getCanvas()
			if ('post' === postType && canvas) initiate(
				canvas,
				document
			)
		}
	}, editorStore)
}

})(window.wp)
