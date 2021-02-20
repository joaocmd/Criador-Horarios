import React, { ReactNode } from 'react'
import API, { staticData } from './utils/api'
import './App.scss'

import campiList from './domain/CampiList'
import Course from './domain/Course'
import Shift, { ShiftType, shortenDescriptions } from './domain/Shift'
import Lesson from './domain/Lesson'
import { Comparables } from './domain/Comparable'
import Schedule from './components/Schedule/Schedule'
import CourseUpdates, { CourseUpdateType, getCoursesDifference, returnColor } from './utils/CourseUpdate'
import Degree from './domain/Degree'

import saveToExcel from './utils/excel'

import i18next from 'i18next'
import withStyles, { CreateCSSProperties } from '@material-ui/core/styles/withStyles'
import { createMuiTheme, ThemeProvider, Theme } from '@material-ui/core/styles'

import Avatar from '@material-ui/core/Avatar'
import IconButton from '@material-ui/core/IconButton'
import Tooltip from '@material-ui/core/Tooltip'
import Toolbar from '@material-ui/core/Toolbar'
import Alert from '@material-ui/lab/Alert'
import AppBar from '@material-ui/core/AppBar'
import TopBar from './components/TopBar/TopBar'
import Icon from '@material-ui/core/Icon'
import Card from '@material-ui/core/Card'
import CardContent from '@material-ui/core/CardContent'
import CardActions from '@material-ui/core/CardActions'
import Chip from '@material-ui/core/Chip'
import Paper from '@material-ui/core/Paper'
import ToggleButton from '@material-ui/lab/ToggleButton'
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup'
import Backdrop from '@material-ui/core/Backdrop'
import CircularProgress from '@material-ui/core/CircularProgress'
import Divider from '@material-ui/core/Divider'
import { exportComponentAsPNG } from 'react-component-export-image'
import Snackbar from '@material-ui/core/Snackbar'
import Link from '@material-ui/core/Link'
import GitHubIcon from '@material-ui/icons/GitHub'
import Typography from '@material-ui/core/Typography'
import Button from '@material-ui/core/Button'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaypal } from '@fortawesome/free-brands-svg-icons'
import Cookies from 'universal-cookie'
import CardHeader from '@material-ui/core/CardHeader'

import getClasses from './utils/shift-scraper'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'

type BuiltCourse = {
	course: Course,
	availableShifts: Shift[],
	selectedShifts: Shift[]
}


class App extends React.Component <{
	classes: CreateCSSProperties
}>{
	state = {
		selectedCourses: new CourseUpdates(),
		availableShifts: [] as Shift[],
		shownShifts: [] as Shift[],
		selectedShifts: [] as Shift[],
		selectedCampi: [...campiList] as string[],
		selectedShiftTypes: Object.values(ShiftType) as string[],
		alertMessage: '',
		alertSeverity: undefined as 'success' | 'info' | 'warning' | 'error' | undefined,
		hasAlert: false as boolean,
		classesDialog: false,
		warningDialog: false,
		loading: true as boolean,
		lang: i18next.options.lng as string,
		darkMode: false
	}
	cookies = new Cookies()
	selectedDegree: Degree | null = null
	chosenSchedule: React.RefObject<Schedule>
	topBar: React.RefObject<TopBar>
	theme: Theme
	classes: [string, string][] = []
	warningTitle = ''
	warningContent = ''
	warningContinue: () => void = () => {return}

	// eslint-disable-next-line
	constructor(props: any) {
		super(props)
		this.onSelectedCourse = this.onSelectedCourse.bind(this)
		this.onSelectedShift = this.onSelectedShift.bind(this)
		this.clearSelectedShifts = this.clearSelectedShifts.bind(this)
		this.getLink = this.getLink.bind(this)
		this.changeCampi = this.changeCampi.bind(this)
		this.saveSchedule = this.saveSchedule.bind(this)
		this.handleCloseAlert = this.handleCloseAlert.bind(this)
		this.showAlert = this.showAlert.bind(this)
		this.changeLanguage = this.changeLanguage.bind(this)
		this.onChangeDarkMode = this.onChangeDarkMode.bind(this)
		this.exportToExcel = this.exportToExcel.bind(this)

		this.chosenSchedule = React.createRef()
		this.topBar = React.createRef()

		this.theme = this.getTheme(this.state.darkMode)

		const lang = (this.cookies.get('language') ?? this.state.lang)
		this.setState({ lang })
		API.setLanguage(lang)
		i18next.changeLanguage(lang).then(() => {
			i18next.options.lng = lang
		})
	}

	async componentDidMount() {
		const darkName = this.cookies.get('dark') ?? null
		if (darkName !== null) {
			const darkMode = (darkName === 'true') ? true : false
			if (darkMode !== this.state.darkMode) {
				this.onChangeDarkMode(darkMode)
			}
		}

		// staticData.terms = await API.getAcademicTerms()

		const params = API.getUrlParams()
		await this.buildState(params.s)

		this.setState({
			loading: false
		})
	}

	async onSelectedCourse(selectedCourses: Course[]): Promise<void> {
		if (selectedCourses.length === 0) {
			const currCourses = this.state.selectedCourses as CourseUpdates
			currCourses.removeAllCourses()
			if (this.selectedDegree === null) {
				this.setState({
					availableCourses: [],
					selectedCourses: currCourses,
					availableShifts: [],
					shownShifts: []
				})
			} else {
				this.setState({
					selectedCourses: currCourses,
					availableShifts: [],
					shownShifts: []
				})
			}
			this.topBar.current?.setSelectedCourses(currCourses)
			return
		}

		const changedCourse = getCoursesDifference(this.state.selectedCourses.courses, selectedCourses)
		if (!changedCourse) {
			return
		}

		const currCourses = this.state.selectedCourses
		Object.setPrototypeOf(currCourses, CourseUpdates.prototype) // FIXME: what??
		if (changedCourse.course !== undefined) {
			currCourses.toggleCourse(changedCourse.course)
		} else if (changedCourse.type === CourseUpdateType.Many) {
			selectedCourses.forEach(c => currCourses.toggleCourse(c))
		}

		this.setState({
			selectedCourses: currCourses
		})

		let availableShifts: Shift[] = []
		if (currCourses.lastUpdate?.type === CourseUpdateType.Add &&
			currCourses.lastUpdate.course !== undefined) {
			const schedule = await API.getCourseSchedules(currCourses.lastUpdate.course)
			if (schedule === null) {
				this.showAlert(i18next.t('alert.cannot-obtain-shifts'), 'error')
				return
			}
			availableShifts = this.state.availableShifts.concat(schedule)
		} else if (currCourses.lastUpdate?.type === CourseUpdateType.Remove) {
			availableShifts = this.state.availableShifts
				.filter((shift: Shift) => shift.courseId !== currCourses.lastUpdate?.course?.id)
		} else if (currCourses.lastUpdate?.type === CourseUpdateType.Clear) {
			availableShifts = []
		}

		const shownShifts = this.filterShifts({
			selectedCampi: this.state.selectedCampi,
			selectedShiftTypes: this.state.selectedShiftTypes,
			availableShifts: availableShifts
		})

		this.topBar.current?.setSelectedCourses(currCourses)
		this.setState({
			availableShifts,
			shownShifts
		})
	}

	getAllLessons(): Lesson[] {
		return this.state.shownShifts.map((shift: Shift) => shift.lessons).flat()
	}

	getSelectedLessons(): Lesson[] {
		return this.state.selectedShifts.map((shift: Shift) => shift.lessons).flat()
	}

	setSelectedShifts(shifts: Shift[]) {
		this.setState({
			selectedShifts: shifts
		})
		this.topBar.current?.setHasSelectedShifts(shifts)
		if (shifts.length === 0) {
			this.cookies.remove('s')
		} else {
			const state = shortenDescriptions(shifts)
			this.cookies.set('s', state, { maxAge: 60*60*24*31*3 })
		}
	}

	onSelectedShift(shiftName: string, arr: Shift[]): void {
		const chosenShift = arr.find((s: Shift) => s.name === shiftName)

		if (chosenShift) {
			const shiftCourse = this.state.selectedCourses.courses.filter((c) => c.id === chosenShift.courseId)

			// Verify if of the same type and course to replace, but not the same
			const replacingIndex = Comparables.indexOfBy(this.state.selectedShifts, chosenShift, Shift.isSameCourseAndType)
			const selectedShifts = this.state.selectedShifts
			
			// Verify if shift is already selected and unselect
			const idx = Comparables.indexOf(selectedShifts, chosenShift)
			if (idx === -1) {
				selectedShifts.push(chosenShift)
				if (replacingIndex !== -1) {
					selectedShifts.splice(replacingIndex, 1)  
				} else if (shiftCourse.length === 1) {
					shiftCourse[0].addSelectedShift(chosenShift)
				}
			} else {
				selectedShifts.splice(idx, 1)
				if (shiftCourse.length === 1) {
					shiftCourse[0].removeSelectedShift(chosenShift)
				}
			}

			this.setSelectedShifts(selectedShifts)
		}
	}

	clearSelectedShifts(alert: boolean): void {
		if (this.state.selectedShifts.length !== 0) {
			this.state.selectedCourses.courses.forEach( (c) => {
				c.clearSelectedShifts()
				if (!c.isSelected && !c.hasShiftsSelected) {
					returnColor(c.removeColor())
				}
			})
			this.setSelectedShifts([])

			if (alert) {
				this.showAlert(i18next.t('alert.cleared-schedule'), 'success')
			}

			this.changeUrl(false)
		}
	}

	getCoursesBySelectedShifts(): Course[] {
		const finalCourses = [...this.state.selectedCourses.courses]
		// let courses: Record<string, Course> = {}
		this.state.selectedShifts.forEach( (s) => {
			// FIXME: Includes? hmmmm
			// finalCourses = Comparables.addToSet(finalCourses, s.course) as Record<string, Course>
			if (!finalCourses.includes(s.course)) {
				finalCourses.push(s.course)
			}
		})
		return finalCourses.sort(Course.compare)
	}

	changeCampi(campi: string[]): void {
		const shownShifts = this.filterShifts({
			selectedCampi: campi,
			selectedShiftTypes: this.state.selectedShiftTypes,
			availableShifts: this.state.availableShifts
		})

		this.setState({
			selectedCampi: campi,
			shownShifts
		})
	}

	changeShiftTypes(types: string[]): void {
		const shownShifts = this.filterShifts({
			selectedCampi: this.state.selectedCampi,
			selectedShiftTypes: types,
			availableShifts: this.state.availableShifts
		})

		this.setState({
			selectedShiftTypes: types,
			shownShifts
		})
	}

	filterShifts(state: {selectedCampi: string[], selectedShiftTypes: string[], availableShifts: Shift[]}): Shift[] {
		return state.availableShifts.filter( (s) => {
			const campi = state.selectedCampi.includes(s.campus) || s.campus === undefined
			const type = state.selectedShiftTypes.includes(s.type)
			return campi && type
		})
	}

	showAlert(message: string, severity: 'success' | 'warning' | 'info' | 'error' | undefined): void {
		this.setState({
			alertMessage: message,
			alertSeverity: severity,
			hasAlert: true
		})
	}

	handleCloseAlert(): void {
		this.setState({
			hasAlert: false
		})
	}

	async getLink(): Promise<void> {
		const state = shortenDescriptions(this.state.selectedShifts)
		const shortLink = await API.getShortUrl(state)
		const el = document.createElement('textarea')
		el.value = shortLink
		el.setAttribute('readonly', '')
		el.style.display = 'hidden'
		document.body.appendChild(el)
		el.select()
		document.execCommand('copy')

		document.body.removeChild(el)
		this.showAlert(i18next.t('alert.link-obtained'), 'success')
	}

	async changeUrl(toState: boolean): Promise<void> {
		const title: string = document.title
		let path = API.PATH_PREFIX + '/'
		const state = shortenDescriptions(this.state.selectedShifts)
		if (state !== '' && toState) {
			path += `?s=${state}`
		}

		if (window.history.replaceState) {
			window.history.replaceState({}, title, path)
		} else {
			window.history.pushState({}, title, path)
		}
	}

	async buildCourse(description: string[], updates: CourseUpdates): Promise<BuiltCourse> {
		const course = await API.getCourse(description[0])
		if (!course) {
			throw 'Could not build course'
		}

		if (updates.has(course)) {
			throw 'Repeated course on URL'
		}

		updates.toggleCourse(course)
		const availableShifts = await API.getCourseSchedules(course)
		if (!availableShifts) {
			throw 'Could not fetch course schedule'
		}

		const selectedShiftIds = description.slice(1)
		const selectedShifts = availableShifts.reduce((acc: Shift[], shift: Shift) => {
			if (selectedShiftIds.includes(shift.shiftId)) {
				acc.push(shift)
				course.addSelectedShift(shift)
			}
			return acc
		}, [] as Shift[])
		return { course, availableShifts, selectedShifts }
	}

	async buildState(param: string | undefined): Promise<void> {
		param = param ?? this.cookies.get('s')
		if (!param) {
			return
		}

		try {
			const shifts = param.split(';')
				.map((shift: string) => shift.split('~'))

			const courseUpdates = new CourseUpdates()
			const parsedState = await Promise.all(shifts.map(async (description: string[]) => this.buildCourse(description, courseUpdates)))
			// eslint-disable-next-line
			const state = parsedState.reduce((acc: any, result: BuiltCourse) => {
				acc.availableShifts = acc.availableShifts.concat(result.availableShifts)
				acc.selectedShifts = acc.selectedShifts.concat(result.selectedShifts)
				return acc
			}, { availableShifts: [], selectedShifts: [] })

			this.topBar.current?.setSelectedCourses(courseUpdates)
			this.setState({
				...state,
				selectedCourses: courseUpdates,
				shownShifts: this.filterShifts({
					selectedCampi: this.state.selectedCampi,
					selectedShiftTypes: this.state.selectedShiftTypes,
					availableShifts: state.availableShifts
				})
			})
			this.topBar.current?.setHasSelectedShifts(state.selectedShifts)
			this.changeUrl(false)
		} catch (err) {
			console.error(err)
			// ignored, bad URL
		}
	}

	saveSchedule(): void {
		if (this.state.selectedShifts.length === 0) {
			this.showAlert(i18next.t('alert.no-shift-selected'), 'info')
			return
		}
		exportComponentAsPNG(this.chosenSchedule, {
			fileName: 'ist-horario',
			html2CanvasOptions: {
				backgroundColor: undefined,
				allowTaint: true,
			}
		})
	
		this.showAlert(i18next.t('alert.schedule-to-image'), 'success')
	}

	async changeLanguage(language: string): Promise<void> {
		const wasLoading = this.state.loading
		this.setState({
			lang: language,
			loading: true
		})
		i18next.changeLanguage(language).then(() => {
			i18next.options.lng = language
		})
		API.setLanguage(language)

		const state = shortenDescriptions(this.state.selectedShifts)
		this.clearSelectedShifts(false)
		await this.buildState(state)

		if (!wasLoading) {
			this.setState({ loading: false })
		}
		this.cookies.set('language', language, { maxAge: 60*60*24*31*3 })
	}

	onChangeDarkMode(dark: boolean): void {
		this.theme = this.getTheme(dark)
		this.setState({
			darkMode: dark
		})
		this.cookies.set('dark', dark, { maxAge: 60*60*24*31*3 })
	}

	getTheme(dark: boolean): Theme {
		return createMuiTheme({
			palette: {
				type: (dark) ? 'dark' : 'light',
				primary: {
					main: (dark) ? '#fff' : '#3f51b5'
				},
				text: {
					primary: (dark) ? 'rgba(255, 255, 255, 0.87)' : 'rgba(0, 0, 0, 0.87)'
				}
			}
		})
	}

	async getClasses(): Promise<void> {
		this.setState({loading: true})
		const classes = await getClasses(this.state.selectedShifts)
		const value = Object.entries(classes) //.map(arr => arr.join(': ')).flat() //.join('\r\n')

		this.classes = value
		this.setState({classesDialog: true, loading: false})

		// TODO: download to a file
		// const el = document.createElement('a')
		// const file = new Blob([value], {type: 'text/plain;charset=utf-8'})
		// el.href = URL.createObjectURL(file)
		// el.download = 'ist-turmas.txt'
		// document.body.appendChild(el)
		// el.click()
		// document.body.removeChild(el)
		// this.showAlert(i18next.t('alert.classes-file'), 'success')
	}

	setWarningExcel(): void {
		this.warningTitle = i18next.t('warning-excel.title')
		this.warningContent = i18next.t('warning-excel.content')
		this.warningContinue = this.exportToExcel
		this.setState({warningDialog: true})
	}

	async exportToExcel(): Promise<void> {
		this.setState({loading: true})
		const classes = await getClasses(this.state.selectedShifts)

		await saveToExcel(this.state.selectedShifts, classes)

		this.setState({loading: false})
		this.showAlert(i18next.t('alert.schedule-to-excel'), 'success')
	}

	render(): ReactNode {
		const classes = this.props.classes

		const StyledToggleButtonGroup = withStyles((theme) => ({
			grouped: {
				margin: theme.spacing(0.5),
				border: 'none',
				'&:not(:first-child)': {
					borderRadius: theme.shape.borderRadius,
				},
				'&:first-child': {
					borderRadius: theme.shape.borderRadius,
				},
			}
		}))(ToggleButtonGroup)


		return (
			<ThemeProvider theme={this.theme}>
				<div className="App">
					<Backdrop className={classes.backdrop as string} open={this.state.loading}>
						<CircularProgress color="inherit" />
					</Backdrop>
					<TopBar
						ref={this.topBar}
						onSelectedCourse={this.onSelectedCourse}
						onClearShifts={this.clearSelectedShifts}
						onGetLink={this.getLink}
						showAlert={this.showAlert}
						onChangeLanguage={this.changeLanguage}
						darkMode={this.state.darkMode}
						onChangeDarkMode={this.onChangeDarkMode}
					>
					</TopBar>
					<div className="main">
						<Snackbar
							open={this.state.hasAlert}
							autoHideDuration={3000}
							onClose={this.handleCloseAlert}
							anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
							<Alert
								action={<IconButton size='small' onClick={this.handleCloseAlert}><Icon>close</Icon></IconButton>}
								severity={this.state.alertSeverity}>
								{this.state.alertMessage}
							</Alert>
						</Snackbar>
						<div className={classes.body as string}>
							<div className="schedules">
								<Card className={classes.card as string}>
									<CardHeader title={i18next.t('schedule-available.title') as string}
										titleTypographyProps={{ variant: 'h6', align: 'center' }}
										className={classes.cardTitle as string}
									/>
									<CardContent className={classes.cardContent as string}>
										<Schedule
											onSelectedEvent={(id: string) => this.onSelectedShift(id, this.state.availableShifts)}
											events={this.getAllLessons()} lang={this.state.lang}
											darkMode={this.state.darkMode}
										/>
									</CardContent>
									<CardActions>
										<Paper elevation={0} className={`${classes.paper as string} ${classes.centered as string}`}
											style={{ border: `1px solid ${this.theme.palette.divider}` }}
										>
											<StyledToggleButtonGroup
												className={classes.toggleGroup as string}
												size="small"
												value={this.state.selectedCampi}
												onChange={(_, value) => this.changeCampi(value as string[])}
												aria-label="text alignment"
											>
												{campiList.map((name: string) => (
													<ToggleButton key={name} value={name}>{name}</ToggleButton>
												))}
											</StyledToggleButtonGroup>
											<Divider flexItem orientation="vertical" className={classes.divider as string}/>
											<StyledToggleButtonGroup
												className={classes.toggleGroup as string}
												size="small"
												value={this.state.selectedShiftTypes}
												onChange={(_, value) => this.changeShiftTypes(value as string[])}
											>
												{Object.entries(ShiftType).map((name) => (
													<ToggleButton key={name[1]} value={name[1]}>{name[0]}</ToggleButton>
												))}       
											</StyledToggleButtonGroup>
										</Paper>
									</CardActions>
								</Card>
								<Card className={classes.card as string}>
									<CardHeader title={i18next.t('schedule-selected.title') as string}
										titleTypographyProps={{ variant: 'h6', align: 'center' }}
										className={classes.cardTitle as string}
									/>
									<CardContent className={classes.cardContent as string}>
										<Schedule
											onSelectedEvent={(id: string) => this.onSelectedShift(id, this.state.selectedShifts)}
											events={this.getSelectedLessons()} ref={this.chosenSchedule} lang={this.state.lang}
											darkMode={this.state.darkMode}
										/>
									</CardContent>
									<CardActions>
										<div style={{display: 'flex', flexGrow: 1, flexWrap: 'wrap'}}>
											{this.getCoursesBySelectedShifts().map((c) => (
												<Paper elevation={0} variant={'outlined'} key={c.hashString()}
													style={{padding: '4px', margin: '4px', display: 'flex'}}
												>
													<Tooltip title={c.displayName()} key={c.hashString()}>
														<Chip size="small" color='primary'
															style={{backgroundColor: c.color}} label={c.acronym}
														/>
													</Tooltip>
													{Array.from(c.getShiftsDisplay()).map((s) => (
														<Paper elevation={0} key={s[0]}
															className={ ( (s[1]) ? classes.checklistSelected : classes.checklistUnselected) as string }
															style={{marginLeft: '4px', marginRight: '4px', color: `${(s[1]) ? this.theme.palette.text.primary : this.theme.palette.text.hint}`}}
														>
															<Typography variant='body1' style={{ fontWeight: 500 }}>{s[0]}</Typography>
														</Paper>
													))}
												</Paper>
											))}
										</div>
										<div className={classes.centered as string}>
											<Tooltip title={i18next.t('schedule-selected.actions.get-classes') as string}>
												<IconButton
													disabled={this.state.selectedShifts.length === 0}
													color="inherit"
													onClick={() => this.getClasses()}
													component="span">
													<Icon>list</Icon>
												</IconButton>
											</Tooltip>
											<Tooltip title={i18next.t('schedule-selected.actions.save-as-image') as string}>
												<IconButton
													// Disabled on dark mode
													disabled={this.state.selectedShifts.length === 0 || this.state.darkMode}
													color="inherit"
													onClick={this.saveSchedule}
													component="span">
													<Icon>image</Icon>
												</IconButton>
											</Tooltip>
											<Tooltip title={i18next.t('schedule-selected.actions.save-as-excel') as string}>
												<IconButton
													disabled={this.state.selectedShifts.length === 0}
													color='inherit'
													onClick={() => {this.exportToExcel()}}
													component="span"
												>
													<Icon>download</Icon>
												</IconButton>
											</Tooltip>
											<Tooltip title={i18next.t('schedule-selected.actions.clear-schedule') as string}>
												<IconButton
													disabled={this.state.selectedShifts.length === 0}
													color="inherit"
													onClick={() => {this.clearSelectedShifts(true)}}
													component="span">
													<Icon>delete</Icon>
												</IconButton>
											</Tooltip>
										</div>
									</CardActions>
								</Card>
							</div>
						</div>
					</div>
					<div className="footer">
						<AppBar className={classes.footer as string} color="default" position="sticky">
							<Toolbar>
								<Tooltip title={i18next.t('footer.support-button.tooltip') as string}>
									<Link href="https://paypal.me/DanielG5?locale.x=pt_PT" target="_blank" onClick={() => {return}} color="inherit">
										<Button color='default' variant='outlined'
											startIcon={<FontAwesomeIcon icon={faPaypal}/>}
											size='small'
										>{i18next.t('footer.support-button.content') as string}
										</Button>
									</Link>
								</Tooltip>
								<div className={classes.grow as string} />
								<Tooltip title={i18next.t('footer.repository.tooltip') as string}>
									<Link href="https://github.com/joaocmd/Criador-Horarios" target="_blank" onClick={() => {return}} color="inherit">
										<IconButton color="inherit" onClick={() => {return}} component="span">
											<GitHubIcon></GitHubIcon>
										</IconButton>
									</Link>
								</Tooltip>
								<Tooltip title="João David">
									<Link href="https://github.com/joaocmd" target="_blank" onClick={() => {return}} color="inherit">
										<IconButton size="small" title="João David" onClick={() => {return}}>
											<Avatar alt="Joao David" src={`${process.env.PUBLIC_URL}/img/joao.png`} />
										</IconButton>
									</Link>
								</Tooltip>
								<Tooltip title="Daniel Gonçalves">
									<Link href="https://dagoncalves.me" target="_blank" onClick={() => {return}} color="inherit">
										<IconButton size="small" title="Daniel Gonçalves" onClick={() => {return}}>
											<Avatar alt="Daniel Goncalves" src={`${process.env.PUBLIC_URL}/img/daniel.png`} />
										</IconButton>
									</Link>
								</Tooltip>
							</Toolbar>													
						</AppBar>
					</div>
					<div className="dialogs">
						<Dialog open={this.state.classesDialog}>
							<DialogTitle>{i18next.t('classes-dialog.title') as string}</DialogTitle>
							<DialogContent className={classes.contentCopyable as string}>{this.classes.map(c => {
								return (
									<div key={c[0]}>
										<Typography key={'course-' + c[0]} variant='h6'>{c[0]}: </Typography>
										<Typography key={'class-' + c[0]} variant='body1'
											style={{marginLeft: '8px'}}
										>{c[1]}</Typography>
									</div>
								)
							})}</DialogContent>
							<DialogActions>
								<div />
								<Button onClick={() => {this.setState({classesDialog: false})}} color="primary">
									{i18next.t('classes-dialog.actions.close-button') as string}
								</Button>
							</DialogActions>
						</Dialog>
						<Dialog open={this.state.warningDialog}>
							<DialogTitle>{this.warningTitle}</DialogTitle>
							<DialogContent>{this.warningContent}</DialogContent>
							<DialogActions>
								<div />
								<Button onClick={() => {this.warningContinue(); this.setState({warningDialog: false})}} color="primary">{i18next.t('warning.actions.continue') as string}</Button>
								<Button onClick={() => {this.setState({warningDialog: false})}} color="primary">{i18next.t('warning.actions.back') as string}</Button>
							</DialogActions>
						</Dialog>				
					</div>
				</div>
			</ThemeProvider>
		)
	}
}

const cssVariables = {
	blur: '5px',
	brightness: 1
}

// eslint-disable-next-line
const styles = (theme: any) => ({
	backdrop: {
		zIndex: theme.zIndex.drawer + 1,
		color: '#fff',
		background: 'rgba(0,0,0,0.85)',
	},
	checklistSelected: {
		// color: theme.palette.text.primary
	},
	checklistUnselected: {
		// color: theme.palette.text.hint
	},
	paper: {
		display: 'flex',
		flexWrap: 'wrap' as const,
		// border: `1px solid ${theme.palette.divider}`,
	},
	divider: {
		margin: theme.spacing(1, 0.5),
	},
	toggleGroup: {
		flexWrap: 'wrap' as const
	},
	card: {
		margin: '1% 1% 2% 1%'
	},
	cardTitle: {
		padding: '8px 16px 2px 16px'
	},
	cardContent: {
		paddingTop: '4px',
		paddingBottom: '0px'
	},
	contentCopyable: {
		userSelect: 'text' as const,
		webkitUserSelect: 'text' as const,
		oUserSelected: 'text' as const
	},
	footer: {
		bottom: '0px',
		top: 'auto',
	},
	grow: {
		flexGrow: 1,
	},
	centered: {
		margin: 'auto'
	},
	body: {
		height: '100%',
		'&::before': {
			content: '""',
			position: 'fixed',
			top: '-5%',
			left: '-5%',
			right: 0,
			zIndex: -1,

			display: 'block',
			backgroundImage: `url(${process.env.PUBLIC_URL}/img/background.jpg)`,
			backgroundSize: 'cover',
			width: '110%',
			height: '110%',

			webkitFilter: `blur(${cssVariables.blur}) brightness(${cssVariables.brightness})`,
			mozFilter: `blur(${cssVariables.blur}) brightness(${cssVariables.brightness})`,
			oFilter: `blur(${cssVariables.blur}) brightness(${cssVariables.brightness})`,
			msFilter: `blur(${cssVariables.blur}) brightness(${cssVariables.brightness})`,
			filter: `blur(${cssVariables.blur}) brightness(${cssVariables.brightness})`,
		}
	}
})

export default withStyles(styles)(App)
