const { fetchText, BASE } = require('../config.js')
const cheerio = require('cheerio')
const { parseTotalPages } = require('./series.js')

function pageUrl(path, page) {
  return page === 1 ? `${BASE}/${path}/` : `${BASE}/${path}/page/${page}/`
}

async function getRecentEpisodes(page) {
  const html = await fetchText(pageUrl('episodes', page), { referer: BASE + '/' })
  const $ = cheerio.load(html)

  const episodes = []
  $('article.item.se.episodes').each((_, el) => {
    const $el = $(el)
    const $a = $el.find('.data h3 a').first()
    const href = $a.attr('href')
    if (!href) return
    const $img = $el.find('.poster img').first()
    episodes.push({
      title: $a.text().trim(),
      series: $el.find('.data .serie').first().text().trim(),
      label: $el.find('.data span').first().text().trim(),
      url: href,
      image: $img.attr('data-lazy-src') || $img.attr('src') || null,
      quality: $el.find('.poster .quality').first().text().trim() || null
    })
  })

  const totalPages = parseTotalPages(html, page)

  return {
    status: 'success',
    currentPage: page,
    totalPages,
    episodesCount: episodes.length,
    episodes
  }
}

async function getRecentSeasons(page) {
  const html = await fetchText(pageUrl('seasons', page), { referer: BASE + '/' })
  const $ = cheerio.load(html)

  const seasons = []
  $('article.item.se.seasons').each((_, el) => {
    const $el = $(el)
    const $a = $el.find('.data h3 a').first()
    const href = $a.attr('href')
    if (!href) return
    const $img = $el.find('.poster img').first()
    seasons.push({
      title: $a.text().trim(),
      series: $el.find('.season_m .c').first().text().trim(),
      date: $el.find('.data span').first().text().trim(),
      url: href,
      image: $img.attr('data-lazy-src') || $img.attr('src') || null
    })
  })

  const totalPages = parseTotalPages(html, page)

  return {
    status: 'success',
    currentPage: page,
    totalPages,
    seasonsCount: seasons.length,
    seasons
  }
}

module.exports = { getRecentEpisodes, getRecentSeasons }
