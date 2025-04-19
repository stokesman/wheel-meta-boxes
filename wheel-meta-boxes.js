(() => {

const { dispatch } = wp.data
const { store: editorStore } = wp.editor
const { store: editPostStore } = wp.editPost
const { store: preferencesStore } = wp.preferences

const makeWheelInitializer = ( canvas, editorDocument = canvas.ownerDocument) => () => {
	const metaPane = editorDocument.querySelector('.edit-post-meta-boxes-main')
	// Bails when the metaPane doesn’t exist (editing patterns/template parts).
	if ( ! metaPane ) return;

	const getThreshold = () => editorDocument.defaultView.wp.data
		.select(preferencesStore).get('s8/wheel-meta-boxes', 'threshold')

	const metaPaneLiner = metaPane.querySelector('.edit-post-layout__metaboxes')
	const onMetaWheel = ( { deltaY } ) => {
		if ( deltaY <= -getThreshold() ) {
			if ( metaPaneLiner.scrollTop === 0 ) {
				const { minHeight } = metaPane.style
				metaPane.style.height = minHeight
				dispatch(preferencesStore).set(
					editPostStore.name,
					'metaBoxesMainOpenHeight',
					parseFloat(minHeight)
				)
			}
		}
	}
	metaPane.addEventListener('wheel', onMetaWheel)

	const onCanvasWheel = ( { currentTarget, deltaY } ) => {
		if ( deltaY >= getThreshold() ) {
			const { scrollTop, scrollHeight, clientHeight } = currentTarget
			// At some viewport heights the scrollHeight minus the clientHeight is a
			// decimal and the scrollTop never matches that. Thus the maximum scroll
			// is considered reached if within one pixel of the remainder.
			const scrollMax = (scrollHeight - clientHeight) - scrollTop <= 1;
			if ( scrollMax ) {
				const { maxHeight } = metaPane.style
				metaPane.style.height = maxHeight
				dispatch(preferencesStore).set(
					editPostStore.name,
					'metaBoxesMainOpenHeight',
					parseFloat( maxHeight )
				)
			}
		}
	}
	canvas.addEventListener('wheel', onCanvasWheel)
}

// The way that wheel handling is added has to be different depending on whether
// the editor canvas is iframed because wheel handling cannot be added to the
// iframed document from the parent window. This script is executed from two
// documents when the editor is iframed and it’s not immediately discernable
// whether the iframe will be available so the the branch that would add
// handling for a non-iframe context has to determine that asynchronously.
if ( ! location.href.startsWith('blob:') ) {
	const editorContainer = document.querySelector('#editor')
	const spy = new MutationObserver(() => {
		const visualEditor = editorContainer.querySelector('.editor-visual-editor')
		if ( visualEditor ) {
			spy.disconnect();
			if (visualEditor.matches('.is-iframed')) return

			makeWheelInitializer(
				document.querySelector('.block-editor-block-canvas')
			)()
		}
	})
	spy.observe(editorContainer, {childList:true, subtree:true})
} else {
	const handleWheeling = makeWheelInitializer(window.document.documentElement, window.parent.document)
	handleWheeling()
	let stalePostType
	// For block themes it’s possible for the editor to switch the post type to
	// a pattern or template part where the meta box pane is no longer available.
	// When switching back to the post the wheel handling has to be reinitiated
	// and this subscriber ensures that happens.
	const { select, subscribe } = window.parent.wp.data
	subscribe( () => {
		const postType = select(editorStore).getCurrentPostType()
		if (!stalePostType) stalePostType = postType
		else if (postType !== stalePostType) {
			stalePostType = postType
			if ('post' === postType) handleWheeling()
		}
	}, editorStore)
}

})()
