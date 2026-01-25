export type MediaType = 'anime' | 'book' | 'movie' | 'drama' | 'game' | 'song'
export type MediaState = 'done' | 'doing' | 'todo'

export interface MediaRecord {
  name: string
  creator?: string
  state?: MediaState
  date?: string
  note?: string
  lang?: string
}

export const anime: MediaRecord[] = [
  {
    name: 'test',
    creator: 'test',
  },
]

export const book: MediaRecord[] = [
  {
    name: 'test',
    creator: 'test',
  },
]

export const movie: MediaRecord[] = [
  {
    name: 'test',
    creator: 'test',
  },
]

export const drama: MediaRecord[] = [
  {
    name: 'test',
  },
]

export const game: MediaRecord[] = [
  {
    name: 'test',
    creator: 'test',
  },
]

export const song = [
  {
    name: 'test',
    creator: 'test',
    lang: 'test',
  },
]

export const media: Record<MediaType, MediaRecord[]> = {
  anime,
  drama,
  movie,
  game,
  song,
  book,
}
