export type MediaType = 'anime' | 'book' | 'movie' | 'game' | 'song'
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
    name: '葬送的芙莉莲',
    creator: '铃木智寻',
    date: '2023',
  },
  {
    name: '我推的孩子',
    creator: '平牧大辅',
    date: '2023',
  },
  {
    name: '四叠半神话大系',
    creator: '汤浅政明',
    date: '2010',
  },
  {
    name: '灵能百分百',
    creator: '立川让',
    date: '2016',
  },
  {
    name: '她和她的猫',
    creator: '新海诚',
    date: '2016',
  },
  {
    name: '狼的孩子雨和雪',
    creator: '细田守',
    date: '2012',
  },
  {
    name: '夏日重现',
    creator: '渡边步',
    date: '2022',
  },
  {
    name: '英雄联盟：双城之战',
    creator: 'Riot Games',
    date: '2021',
  },
  {
    name: '辉夜大小姐想让我告白',
    creator: '畠山守',
    date: '2019',
  },
  {
    name: '瑞克和莫蒂',
    creator: '贾斯汀·罗兰',
    date: '2013',
  },
  {
    name: '擅长捉弄的高木同学',
    creator: '赤城博昭',
    date: '2018',
  },
  {
    name: '萤火之森',
    creator: '大森贵弘',
    date: '2011',
  },
  {
    name: '千与千寻',
    creator: '宫崎骏',
    date: '2001',
  },
]

export const book: MediaRecord[] = [
  {
    name: '福格行为模型',
    creator: 'B.J.福格',
  },
  {
    name: '創作者的日常生活',
    creator: 'Mason Currey',
  },
  {
    name: '静寂工人：码头日与夜',
    creator: '魏明毅 ',
  },
]

export const movie: MediaRecord[] = [
  {
    name: '还有明天',
    creator: '宝拉·柯特莱西',
    date: '2023',
  },
  {
    name: '爱情神话',
    creator: '邵艺辉',
    date: '2021',
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
  book,
  movie,
  anime,
  game,
  song,
}
