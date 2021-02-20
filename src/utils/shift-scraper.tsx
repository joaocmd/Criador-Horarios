import Shift from '../domain/Shift'
import Course from '../domain/Course'
import API from './api'
import cheerio from 'cheerio'

const prefix = 'https://fenix.tecnico.ulisboa.pt'

export default async function (shifts: Shift[]): Promise<Record<string, string>> {
	const shiftPage: Record<string, string> = {}
	const courseUrls = Array.from(new Set(shifts.map(shift => shift.courseId)))
	await Promise.all(courseUrls
		.map(courseId => API.getCourse(courseId)
			.then(async c => {
				if (!shiftPage[courseId]) {
					const url = c!.url.replace(prefix, '') + '/turnos'
					const page = await API.getPage(url)
					if (page === null) {
						throw 'Fenix fodido'
					}
					shiftPage[courseId] = page
				}
			}))
	)

	// TODO: change forEach to reduce
	const res: Record<string, string> = {}
	shifts.forEach((shift: Shift) => {
		const page = shiftPage[shift.courseId]
		const $ = cheerio.load(page)

		$('tbody tr').each(function(i, element) {
			const attrs = $(element).children('td')
			if (attrs.length === 5) {
				const shiftName = $(attrs[0]).text()
				
				if (shiftName.includes(shift.shiftId) && !res[shift.name]) {
					res[shift.acronym + ' - ' + shift.shiftId] = $(attrs[4]).text().replaceAll('\t', '').trim().replaceAll('\n', ', ')
				}
			}
		})
	})
	return res
}
