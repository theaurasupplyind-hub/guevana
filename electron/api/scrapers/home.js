const { fetchText } = require('../config.js')
const cheerio = require('cheerio')

async function getFeatured() {
  const html = await fetchText('https://zonaaps.com/', { referer: 'https://zonaaps.com/' })
  const $ = cheerio.load(html)
  const featured = []

  $('#featured-titles article.item.movies').each((_, el) => {
    const $el = $(el)
    const $a = $el.find('.data a[href*="/movies/"]').first()
    const href = $a.attr('href')
    if (!href) return
    const $img = $el.find('.poster img').first()
    featured.push({
      title: $a.text().trim(),
      url: href,
      image: $img.attr('data-lazy-src') || $img.attr('src') || null,
      type: 'featured',
      rating: $el.find('.rating').first().text().trim(),
      year: $el.find('.data span').first().text().trim()
    })
  })

  return featured
}

module.exports = { getFeatured }
