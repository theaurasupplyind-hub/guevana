const { startServer } = require('./api/server.js')

startServer()
  .then(({ port }) => console.log('LISTEN', port))
  .catch((e) => {
    console.error('SERVER_ERR', e.message)
    process.exit(1)
  })
