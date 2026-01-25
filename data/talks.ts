import type { Talk } from '~/types'

export const talks: Talk[] = [
  {
    title: 'test',
    description: 'test',
    presentations: [
      {
        lang: 'zh',
        date: '2026-01-12',
        location: 'Shenzhen, China',
        conference: 'test',
        conferenceUrl: 'https://github.com/Lihahai',
        recording: 'https://github.com/Lihahai',
        pdf: 'https://github.com/Lihahai',
        spa: 'https://github.com/Lihahai',
      },
    ],
  },
]

talks.forEach((talk) => {
  talk.presentations.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })
})

talks.sort((a, b) => {
  return new Date(b.presentations[0].date).getTime() - new Date(a.presentations[0].date).getTime()
})
