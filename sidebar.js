((wp) => {

const { createElement: m } = wp.element
const {
	Button,
	Card,
	CardBody,
	CardDivider,
	__experimentalNumberControl: NumberControl,
	ToggleControl,
	__experimentalToggleGroupControl: ToggleGroupControl,
	__experimentalToggleGroupControlOption: ToggleGroupControlOption,
	__experimentalSpacer: Spacer,
} = wp.components
const { useRefEffect } = wp.compose
const { dispatch, useDispatch, useSelect } = wp.data
const { PluginSidebar } = wp.editor
const { isAppleOS } = wp.keycodes
const { registerPlugin } = wp.plugins
const { store: preferencesStore } = wp.preferences

/** @typedef {import('$types').Mode} Mode */

dispatch( preferencesStore ).setDefaults(
	's8/wheel-meta-boxes',
	{ freewheeling: true, mode: 'gradual', threshold: 5 }
);

const modeHelpMap = {
	gradual: 'Adjust in proportion to input amount.',
	whole: 'Expand or collapse wholly when input threshold is met.',
	none: '',
}

const modifierKey = isAppleOS() ? 'control' : 'Ctrl';

const Sidebar = () => {
	/** @type {[boolean, Mode, number]} */
	const [ freewheeling, mode, threshold ] = useSelect( $ => {
		const prefs = $( preferencesStore )
		return [
			prefs.get('s8/wheel-meta-boxes', 'freewheeling'),
			prefs.get('s8/wheel-meta-boxes', 'mode'),
			prefs.get('s8/wheel-meta-boxes', 'threshold'),
		]
	}, [] )
	const { set } = useDispatch( preferencesStore )

	/** @param {string} v */
	const setMode = v => set( 's8/wheel-meta-boxes', 'mode', v)

	/** @param {boolean} v */
	const setFreewheeling = v => set( 's8/wheel-meta-boxes', 'freewheeling', v)

	const effectTrackImpulse = useRefEffect( ( node ) => {
		let maxImpulse = 0
		let timeoutId = -1
		/** @param {WheelEvent} event */
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
				m(
					ToggleGroupControl,
					{
						label:'Scroll bounded behavior',
						onChange: setMode,
						value: mode,
						isBlock: true,
						__next40pxDefaultSize: true,
						__nextHasNoMarginBottom: true,
						help: modeHelpMap[mode]
					},
					m(ToggleGroupControlOption, {label:'Gradual', value:'gradual'}),
					m(ToggleGroupControlOption, {label:'Whole', value:'whole'}),
					m(ToggleGroupControlOption, {label:'None', value:'none'})
				),
				...(mode === 'whole' ? [
					m( Spacer ),
					m( NumberControl, {
						label: 'Threshold',
						value: `${threshold}`,
						/** @type {(v: string) => void} */
						onChange: v => {
							set('s8/wheel-meta-boxes', 'threshold', parseFloat(v))
						},
						help: 'The amount of input needed to expand or collapse the meta box pane.',
						spinFactor: 25,
						spinControls: 'custom',
						__next40pxDefaultSize: true,
						__nextHasNoMarginBottom: true
					} ),
					m(
						'div',
						{ className: 's8-wheel-meta-boxes-read-out' },
						m('span', null, 'Last maximum input:' ),
						m(Button, {
							ref: effectTrackImpulse,
							className: 's8-wheel-meta-boxes-read-out/value',
							variant: 'tertiary',
							size: 'small',
							label: 'Press to use this value',
							showTooltip: true,
							/** @type {(event:MouseEvent & {currentTarget:HTMLButtonElement}) => void} */
							onClick: ({currentTarget}) =>
								set('s8/wheel-meta-boxes', 'threshold', parseFloat(currentTarget.textContent))
						}, '0' ),
						m('small', null, 'Use your mouse wheel or scroll gesture to gauge what threshold value will work best for you.')
					)
				] : []),
				m( CardDivider ),
				m( ToggleControl, {
					label: 'Freewheeling behavior',
					checked: freewheeling,
					onChange: setFreewheeling,
					help: `Enable adjusting the split by pressing the ${ modifierKey} key and using the mouse wheel or scroll gesture.`,
					__nextHasNoMarginBottom: true
				})
			)
		)
	)
}

registerPlugin( 's8-wheel-meta-boxes-sidebar', {
	render: Sidebar
} )

})(window.wp)