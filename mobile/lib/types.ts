export type CatalogItem = {
  title: string
  url: string
  image?: string | null
  type?: string
  year?: string | number | null
  rating?: string | number | null
  quality?: string | null
  slug?: string
  source?: string
  sources?: Array<{ source?: string; url: string }>
  genre?: string
}

export type Stream = {
  type: 'hls' | 'direct' | string
  url: string
  source?: string
  referer?: string
  contentType?: string | null
}

export type Episode = {
  num: string | number
  title: string
  url: string
  image?: string | null
  date?: string
  season?: string | number
}

export type Season = {
  num: string | number
  title: string
  date?: string
  episodes: Episode[]
}
