#!/usr/bin/env node

import http from 'http'
import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'

const port = 8080
const newsletter = new EventEmitter()
const server = http.createServer(server_callback)
server.listen(port, ()=>console.log(`Server listening on port ${port}...`))
server
  .on('connect', socket=>console.log(`Client ${socket.remoteAddress}:${socket.remotePort} connected to the server at ${socket.localAddress}:${socket.localPort}.`))
  .on('connection', socket=>console.log('Connection established'))
  .on('request', (req, res) => console.log(`Request received. URL: ${req.url}`))
  .on('upgrade', (req, socket, head) => console.log(`Upgrade requested. Header: ${head.toString()}`))

function server_callback(req, res) {
  const chunks = []
  const {url, method} = req
  const url_method = `${url} ${method}`
  res
    .on('error', err=>{
      res.writeHead(500, {'Content-Type': 'application/json'})
      res.write(JSON.stringify({
        status: 'error',
        message: `An error occured in the response:\n\n${err}`
      }))
    })
  
  req
    .on('error', err=>{
      res.writeHead(500, {'Content-Type': 'application/json'})
      res.write(JSON.stringify({
        status: 'error',
        message: `An error occured in the request:\n\n${err}`
      }))
    })
    .on('data', chunk=>chunks.push(chunk))
    .on('end', ()=>{
      let data = JSON.parse(Buffer.concat(chunks).toString())
      
      switch (url_method) {
        case '/newsletter_signup POST':
          console.debug('Data is: ', data)
          if(data.name === undefined || data.email === undefined) {
            header(res, 404)
            return message(res, 'error', 'data and name are required')
          }
          newsletter.emit('signup', data.name, data.email)
          header(res, 200)
          message(res, 'success', 'signup handed off to worker')
          break
        default:
          header(res, 404)
          message(res, 'error', '404 Not Found')
      }
    })
}

newsletter
  .on('signup', (name, email) => {
    console.debug('signup callback started')
    fs.appendFile(path.join('data', 'db.csv'), `"${name}","${email}"`, err=>{
      if (err) return console.error(err)
      console.debug('file appended to')
    })
  })

function header(res, status, contentType='application/json') {
  res.writeHead(status, {'Content-Type': contentType})
}

function message(res, status, data) {
  res.write(JSON.stringify({status, data}))
  res.end()
}
