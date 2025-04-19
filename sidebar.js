(() => {

const { createElement: m } = React
const { Card, CardBody, __experimentalNumberControl: NumberControl } = wp.components
const { useRefEffect } = wp.compose
const { dispatch, useDispatch, useSelect } = wp.data
const { PluginSidebar } = wp.editor
const { registerPlugin } = wp.plugins
const { store: preferencesStore } = wp.preferences

dispatch( preferencesStore ).setDefaults(
	's8/wheel-meta-boxes',
	{ threshold: 5 }
);

const Sidebar = () => {
	const threshold = useSelect(
		$ => $( preferencesStore ).get('s8/wheel-meta-boxes', 'threshold'),
		[]
	)
	const { set } = useDispatch( preferencesStore )
	const effectTrackImpulse = useRefEffect( ( node ) => {
		let maxImpulse = 0
		let timeoutId = -1
		const trackImpulse = ( { deltaY } ) => {
			maxImpulse = Math.max( Math.abs(deltaY), maxImpulse )
			node.textContent = `${ Math.round(maxImpulse) }`
			if ( timeoutId === -1 ) node.classList.add( '&impulsed' )
			clearTimeout( timeoutId )
			timeoutId = setTimeout(() => {
				node.classList.remove( '&impulsed' )
				maxImpulse = 0
				timeoutId = -1
			}, 250)
		}
		document.addEventListener('wheel', trackImpulse )
		return () => {
			document.removeEventListener('wheel', trackImpulse )
		}
	}, [])
	return m(
		PluginSidebar,
		{
			name: 'wheel-meta-boxes-settings',
			icon: 'image-flip-vertical',
			title: 'Wheel meta boxes',
		},
		m(
			Card,
			{ size: 'small', isBorderless: true },
			m( CardBody, null,
				m( NumberControl, {
					label: 'Threshold',
					value: `${threshold}`,
					onChange: v => {
						set('s8/wheel-meta-boxes', 'threshold', parseFloat(v))
					},
					help: 'The amount of input needed to maximize or minimize the meta box pane.',
					spinFactor: 25,
					spinControls: 'custom',
					__next40pxDefaultSize: true,
					__nextHasNoMarginBottom: true
				} ),
				m(
					'div',
					{ className: 's8-wheel-meta-boxes-read-out' },
					m('span', null, 'Last maximum input:' ),
					m('span', { ref: effectTrackImpulse, className: 's8-wheel-meta-boxes-read-out/value' }, '0' ),
					m('small', null, 'Use your mouse wheel or scroll gesture on touch devices to gauge what threshold value will work best for you.')
				)
			)
		)
	)
}

registerPlugin( 's8-wheel-meta-boxes-sidebar', {
	render: Sidebar
} )

})()