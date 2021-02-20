import React from 'react'
import styles from './TopBar.module.scss'

import API, { staticData } from '../../utils/api'
import { Comparables } from '../../domain/Comparable'
import Degree from '../../domain/Degree'
import Course from '../../domain/Course'
import Shift from '../../domain/Shift'
import CourseUpdates from '../../utils/CourseUpdate'

import Chip from '@material-ui/core/Chip'
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete'
import TextField from '@material-ui/core/TextField'
import Toolbar from '@material-ui/core/Toolbar'
import Tooltip from '@material-ui/core/Tooltip'
import AppBar from '@material-ui/core/AppBar'
import IconButton from '@material-ui/core/IconButton'
import Icon from '@material-ui/core/Icon'
import Dialog from '@material-ui/core/Dialog'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogContent from '@material-ui/core/DialogContent'
import FormControl from '@material-ui/core/FormControl'
import InputLabel from '@material-ui/core/InputLabel'
import Select from '@material-ui/core/Select'
import MenuItem from '@material-ui/core/MenuItem'
import DialogActions from '@material-ui/core/DialogActions'
import Button from '@material-ui/core/Button'

import Brightness2Icon from '@material-ui/icons/Brightness2'
import Brightness5Icon from '@material-ui/icons/Brightness5'

import i18next from 'i18next'
import Menu from '@material-ui/core/Menu'
import Avatar from '@material-ui/core/Avatar'

class TopBar extends React.Component <{
	showAlert: (message: string, severity: 'success' | 'warning' | 'info' | 'error' | undefined) => void
	onSelectedCourse: (selectedCourses: Course[]) => Promise<void>
	onClearShifts: (alert: boolean) => void
	onGetLink: () => void
	onChangeLanguage: (language: string) => Promise<void>
	darkMode: boolean
	onChangeDarkMode: (dark: boolean) => void
}, unknown>{
	state = {
		degrees: [] as Degree[],
		availableCourses: [] as Course[],
		selectedAcademicTerm: '',
		selectedCourses: new CourseUpdates(),
		hasSelectedShifts: false,
		settingsDialog: false,
		helpDialog: false,
		warningDialog: false,
		languageAnchor: null
	}
	selectedDegree: Degree | null = null

	// eslint-disable-next-line
	constructor(props: any) {
		super(props)
		this.onSelectedDegree = this.onSelectedDegree.bind(this)
		this.onSelectedCourse = this.onSelectedCourse.bind(this)
		this.onLanguageMenuClick = this.onLanguageMenuClick.bind(this)
		this.onChangeDarkMode = this.onChangeDarkMode.bind(this)
	}

	async componentDidMount(): Promise<void> {
		const degrees = await API.getDegrees()
		this.setState({
			degrees: degrees ?? []
		})
		if (degrees === null) {
			this.props.showAlert(i18next.t('alert.cannot-obtain-degrees'), 'error')
		}
	}

	async onSelectedDegree(degree: Degree | null): Promise<void> {
		this.selectedDegree = degree
		if (degree !== null) {
			const degreeCourses = await API.getCourses(degree) 
			if (degreeCourses === null) {
				this.props.showAlert(i18next.t('alert.cannot-obtain-courses'), 'error')
				return
			}
			const selected = this.state.selectedCourses.courses
			const availableCourses = Comparables.toUnique(degreeCourses.concat(selected)) as Course[]
			this.setState({
				availableCourses: availableCourses.sort(Course.compare)
			})
		} else {
			this.setState({
				availableCourses: this.state.selectedCourses.courses
			})
		}
	}

	setHasSelectedShifts(shifts: Shift[]): void {
		this.setState({
			hasSelectedShifts: shifts.length > 0
		})
	}

	//FIXME: Available courses not updating when a course from another degree is removed 
	private async onSelectedCourse(selectedCourses: Course[]): Promise<void> {
		this.props.onSelectedCourse(selectedCourses)
	}

	setSelectedCourses(selectedCourses: CourseUpdates): void {
		// FIXME: Maybe not use toUnique?
		const availableCourses = 
			Comparables.toUnique(this.state.availableCourses.concat(selectedCourses.courses)) as Course[]
		this.setState({
			selectedCourses,
			availableCourses
		})
	}

	onSelectedAcademicTerm(s: string): void {
		const foundArr = staticData.terms.filter( (at) => at.id === s)
		if (foundArr.length > 0) {
			const chosenAT = foundArr[0]
			API.ACADEMIC_TERM = chosenAT.term
			API.SEMESTER = chosenAT.semester
		}

		this.onSelectedCourse([])
		this.onSelectedDegree(this.selectedDegree)
		this.props.onClearShifts(false)
		this.setState({
			selectedAcademicTerm: s
		})
	}

	onLanguageMenuClick(event: React.MouseEvent<HTMLSpanElement, MouseEvent> | null, open: boolean): void {
		if (open && event !== null) {
			this.setState({
				languageAnchor: event.currentTarget
			})
		} else {
			this.setState({
				languageAnchor: null
			})
		}
	}

	async onLanguageSelect(language: string): Promise<void> {
		this.onLanguageMenuClick(null, false)

		// Get degrees with correct language and erase courses
		const degrees = await API.getDegrees()
		this.setState({
			degrees: degrees ?? []
		})

		this.selectedDegree = null
		this.onSelectedCourse([])

		await this.props.onChangeLanguage(language)
	}

	onChangeDarkMode(): void {
		if (!this.props.darkMode) {
			this.setState({
				warningDialog: true
			})
		}
		this.props.onChangeDarkMode(!this.props.darkMode)
	}

	render(): React.ReactNode {
		const maxTags = 14
		const courseFilterOptions = createFilterOptions({
			stringify: (option: Course) => option.searchableName()
		})
		const maxSelectedCourses = 10

		return (
			<div className = {styles.TopBar}>
				<AppBar
					color="default"
					position="static"
				>
					<Toolbar className={styles.ToolBar}>
						<Autocomplete
							value={this.selectedDegree}
							color="inherit"
							size="small"
							className={styles.degreeSelector}
							selectOnFocus
							clearOnBlur
							handleHomeEndKeys={false}
							onChange={(_, value) => this.onSelectedDegree(value)}
							noOptionsText={i18next.t('degree-selector.noOptions') as string}
							options={this.state.degrees}
							getOptionLabel={(option) => option.displayName()}
							renderInput={(params) => <TextField {...params} label={i18next.t('degree-selector.title') as string} variant="outlined" />}
						/>
						<Autocomplete
							value={this.state.selectedCourses.courses}
							color="inherit"
							size="small"
							className={styles.courseSelector}
							multiple
							selectOnFocus
							clearOnBlur
							disableCloseOnSelect
							handleHomeEndKeys={false}
							limitTags={maxTags}
							onChange={(_, courses: Course[]) => this.onSelectedCourse(courses)}
							filterOptions={courseFilterOptions} options={this.state.availableCourses}
							getOptionDisabled={(option) => {
								return !option.isSelected &&
									this.state.selectedCourses.courses.length === maxSelectedCourses
							}}
							noOptionsText={i18next.t('course-selector.noOptions') as string}
							getOptionLabel={(option) => option.displayName()}
							renderInput={(params) => <TextField  {...params} label={i18next.t('course-selector.title') as string} variant="outlined" />}
							renderTags={(tagValue, getTagProps) => {
								return tagValue.map((option, index) => (
									<Tooltip title={option.displayName()} key={option.hashString()}>
										<Chip {...getTagProps({ index })} size="small" color='primary' style={{backgroundColor: option.color}} label={option.acronym} />
									</Tooltip>
								))
							}}
						/>
						<Tooltip title={i18next.t('link-button.tooltip') as string}>
							<IconButton disabled={!this.state.hasSelectedShifts} color="inherit" onClick={this.props.onGetLink} component="span">
								<Icon>share</Icon>
							</IconButton>
						</Tooltip>
						<Tooltip title={i18next.t('language-button.tooltip') as string}>
							<IconButton color="inherit"
								onClick={(e: React.MouseEvent<HTMLSpanElement, MouseEvent>) => {this.onLanguageMenuClick(e, true)}}
								component="span"
							>
								<Icon>language</Icon>
							</IconButton>
						</Tooltip>
						<Menu
							id="language-menu"
							anchorEl={this.state.languageAnchor}
							keepMounted
							open={Boolean(this.state.languageAnchor)}
							onClose={() => {this.onLanguageMenuClick(null, false)}}
						>
							<MenuItem onClick={() => {this.onLanguageSelect('pt')}}>
								<Tooltip open={false} title={i18next.t('language.portuguese') as string} placement='left-start'>
									<Avatar alt="Portuguese" src={`${process.env.PUBLIC_URL}/img/language/portugal.png`} />
								</Tooltip>
							</MenuItem>
							<MenuItem onClick={() => {this.onLanguageSelect('en')}}>
								<Tooltip open={false} title={i18next.t('language.english') as string} placement='left-start'>
									<Avatar alt="English" src={`${process.env.PUBLIC_URL}/img/language/united-kingdom.png`} />
								</Tooltip>
							</MenuItem>
						</Menu>
						<Tooltip title={i18next.t(this.props.darkMode ? 'darkmode-button.dark' : 'darkmode-button.light') as string}>
							<IconButton color="inherit" onClick={this.onChangeDarkMode} component="span">
								{ this.props.darkMode ? <Brightness5Icon/> : <Brightness2Icon/> }
							</IconButton>
						</Tooltip>
						<Tooltip title={i18next.t('help-button.tooltip') as string}>
							<IconButton disabled={this.state.helpDialog} color="inherit" onClick={() => {this.setState({helpDialog: true})}} component="span">
								<Icon>help</Icon>
							</IconButton>
						</Tooltip>
						{/* <IconButton color='inherit' onClick={() => {this.setState({settingsDialog: true})}} component="span">
							<Icon>settings</Icon>
						</IconButton> */}
					</Toolbar>
				</AppBar>
				<Dialog open={this.state.settingsDialog}
					onClose={() => {this.setState({ settingsDialog: false })}}
					fullWidth={true}
				>
					<DialogTitle>{i18next.t('settings-dialog.title')}
					</DialogTitle>
					<DialogContent>
						<FormControl variant='outlined'
							fullWidth={true}
						>
							<InputLabel>{i18next.t('settings-dialog.select.label') as string}</InputLabel>
							<Select
								id="semester"
								value={this.state.selectedAcademicTerm}
								onChange={(e) => {this.onSelectedAcademicTerm(e.target.value as string)}}
								label={i18next.t('settings-dialog.select.label') as string}
								// className={styles.semesterSelector}
								autoWidth={true}
							>
								{staticData.terms.map( (s) => 
									<MenuItem key={s.id} value={s.id}>{s.term} {s.semester}{i18next.t('settings-dialog.select.value', { count: s.semester }) as string}
									</MenuItem>
								)}
							</Select>
						</FormControl>
					</DialogContent>
					<DialogActions>
						<div />
						<Button onClick={() => {this.setState({settingsDialog: false})}} color="primary">
							{i18next.t('settings-dialog.actions.close-button') as string}
						</Button>
					</DialogActions>
				</Dialog>
				<Dialog open={this.state.helpDialog}
					onClose={() => {this.setState({helpDialog: false})}}
					maxWidth={'lg'}
					fullWidth={false}
				>
					<DialogContent style={{padding: 0}}>
						<video autoPlay loop style={{width: '100%'}}>
							<source src={`${process.env.PUBLIC_URL}/media/demo.m4v`} type="video/mp4"/>
						</video>
					</DialogContent>
					<DialogActions>
						<div />
						<Button onClick={() => {this.setState({helpDialog: false})}} color="primary">
							{i18next.t('help-dialog.actions.close-button') as string}
						</Button>
					</DialogActions>
				</Dialog>
				<Dialog open={this.state.warningDialog}>
					<DialogTitle>{i18next.t('warning-dialog.title') as string}</DialogTitle>
					<DialogContent>{i18next.t('warning-dialog.content') as string}</DialogContent>
					<DialogActions>
						<div />
						<Button onClick={() => {this.setState({warningDialog: false})}} color="primary">
							{i18next.t('warning-dialog.actions.close-button') as string}
						</Button>
					</DialogActions>
				</Dialog>
				<iframe id="txtArea1" style={{ display: 'none'}}></iframe>
			</div>
		)
	}
}

export default TopBar