const { resolve } = require('path')
const connect = require('connect')
const serveStatic = require('serve-static')
const fs = require('fs-extra')
const { json, end } = require('node-res')

const SSE = require('./sse')

class LoadingUI {
  constructor ({ baseURL }) {
    // Create a connect middleware stack
    this.app = connect()

    // Create an SSE handler instance
    this.sse = new SSE()

    this.baseURL = baseURL
    this._lastBroadCast = 0

    this.states = []
    this.allDone = true
    this.hasErrors = false

    this.serveIndex = this.serveIndex.bind(this)
  }

  async init () {
    // Subscribe to SSR channel
    this.app.use('/sse', (req, res) => this.sse.subscribe(req, res))

    // Serve state with JSON
    this.app.use('/json', (req, res) => json(req, res, this.state))

    // Serve dist
    const distPath = resolve(__dirname, '..', 'app-dist')
    this.app.use('/', serveStatic(distPath))

    // Serve index.html
    const indexPath = resolve(distPath, 'index.html')
    this.indexTemplate = await fs.readFile(indexPath, 'utf-8')
    this.app.use('/', this.serveIndex)
  }

  get state () {
    return {
      states: this.states,
      allDone: this.allDone,
      hasErrors: this.hasErrors
    }
  }

  setStates (states) {
    this.states = states
    this.allDone = this.states.every(state => state.progress === 0 || state.progress === 100)
    this.hasErrors = this.states.some(state => state.hasErrors === true)
    this.broadcastState()
  }

  broadcastState () {
    const now = new Date()

    if ((now - this._lastBroadCast > 500) || this.allDone || this.hasErrors) {
      this.sse.broadcast('state', this.state)
      this._lastBroadCast = now
    }
  }

  serveIndex (req, res) {
    const html = this.indexTemplate
      .replace('{STATE}', JSON.stringify(this.state))
      .replace(/{BASE_URL}/g, this.baseURL)

    end(res, html)
  }
}

module.exports = LoadingUI
