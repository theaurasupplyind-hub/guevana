const { fetchText, BASE } = require('../config.js')
const cheerio = require('cheerio')
const { parseMovieArticle } = require('./archive.js')

const DEFAULT_GENRE = 'series-de-tv'

function parseTotalPages(html, page) {
  let totalPages = page
  const pag = html.match(/P[áa]gina\s+\d+\s+de\s+(\d+)/i)
  if (pag && pag[1]) totalPages = parseInt(pag[1], 10)

  const $ = cheerio.load(html)
  const pageNums = []
  $('a[href*="/page/"]').each((_, el) => {
    const m = $(el).attr('href').match(/\/page\/(\d+)\/?$/)
    if (m && m[1]) pageNums.push(parseInt(m[1], 10))
  })
  if (pageNums.length > 0) {
    totalPages = Math.max(totalPages, ...pageNums)
  }

  return totalPages
}

async function getSeriesPage(page, genre = DEFAULT_GENRE) {
  const url =
    page === 1
      ? `${BASE}/genre/${genre}/`
      : `${BASE}/genre/${genre}/page/${page}/`
  const html = await fetchText(url, { referer: BASE + '/' })
  const $ = cheerio.load(html)

  const series = []
  $('article.item.tvshows').each((_, el) => {
    const s = parseMovieArticle($, $(el), '/tvshows/')
    if (s) series.push({ ...s, type: 'serie' })
  })

  const totalPages = parseTotalPages(html, page)

  return { status: 'success', currentPage: page, totalPages, seriesCount: series.length, series }
}

async function getSeriesInfo(url) {
  const html = await fetchText(url, { referer: BASE + '/' })
  const $ = cheerio.load(html)

  const postId = $('meta[data-postid]').attr('data-postid') || null

  const title = $('.sheader .data h1').first().text().trim() || ''

  const rating =
    $('.dt_rating_vgs').first().text().trim() ||
    $('.starstruck-main').first().attr('data-rating') ||
    ''

  let tmdbRating = ''
  $('.custom_fields').each((_, el) => {
    const $el = $(el)
    if (/TMDb/i.test($el.find('.variante').text())) {
      tmdbRating = $el.find('.valor strong').text().trim()
    }
  })

  const $poster = $('.sheader .poster img').first()
  const poster = $poster.attr('data-lazy-src') || $poster.attr('src') || null

  const network = $('.sheader .data .extra a').first().text().trim() || ''

  let year = $('.sheader .data .extra .date').first().text().trim()

  const genres = []
  $('.sgeneros a').each((_, el) => {
    const g = $(el).text().trim()
    if (g && !genres.includes(g)) genres.push(g)
  })

  const $desc = $('#info .wp-content').first().clone()
  $desc.find('.code-block, script, style, iframe, #dt_galery, .galeria').remove()
  const description = $desc.text().replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

  const seasons = []
  $('#seasons .se-c').each((_, el) => {
    const $el = $(el)
    const $title = $el.find('.se-q .title').first()
    const date = $title.find('i').first().text().trim()
    const titleClone = $title.clone()
    titleClone.find('i').remove()
    titleClone.find('.se_rating').remove()
    const seasonTitle = titleClone.text().replace(/\s+/g, ' ').trim()

    const episodes = []
    $el.find('ul.episodios li').each((_, epEl) => {
      const $ep = $(epEl)
      const $a = $ep.find('.episodiotitle a').first()
      const href = $a.attr('href')
      const $img = $ep.find('.imagen img').first()
      episodes.push({
        num: $ep.find('.numerando').first().text().trim(),
        title: $a.text().trim(),
        url: href || null,
        image: $img.attr('data-lazy-src') || $img.attr('src') || null,
        date: $ep.find('.episodiotitle .date').first().text().trim()
      })
    })

    const numText = $el.find('.se-q .se-t').first().text().trim()
    seasons.push({
      num: numText,
      title: seasonTitle,
      date,
      episodes
    })
  })

  if (!year) {
    const firstDate = seasons[0] && seasons[0].date
    if (firstDate) year = firstDate.split(' ').pop()
  }

  return {
    status: 'success',
    url,
    post_id: postId,
    title,
    rating,
    tmdbRating,
    description,
    genres,
    poster,
    year,
    network,
    seasons
  }
}

module.exports = { getSeriesPage, getSeriesInfo, parseTotalPages }
