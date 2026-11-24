import { GAME_ID, GAME_NAME, TIME_ZONE } from '../public/config.mjs'

export function publicCalendar(archive, through) {
  return {
    game: GAME_ID, name: GAME_NAME, timeZone: TIME_ZONE, publishedThrough: through,
    days: Object.fromEntries(archive.calendar.filter(day => day.date <= through).map(day => [day.date, day])),
  }
}
