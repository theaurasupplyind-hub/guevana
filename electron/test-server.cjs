const { startServer } = require('./api/server.js')

startServer()
  .then(({ port }) => {
    console.log('SERVER_OK', port)
    process.exit(0)
  })
  .catch((e) => {
    console.error('SERVER_ERR', e.message)
    process.exit(1)
  })
