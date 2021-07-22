#!/usr/bin/env node

import http from 'http'
import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'

const port = 8080
const newsletter = new EventEmitter()
const server = http.createServer(server_callback)
server
  .on('connect', socket=>console.log(`Client ${socket.remoteAddress}:${socket.remotePort} connected to the server at ${socket.localAddress}:${socket.localPort}.`))
  .on('connection', socket=>console.log(`Connection established from ${socket.remoteAddress} port ${socket.remotePort} to ${socket.localAddress} port ${socket.localPort}`))
  .on('request', (req, res) => console.log(`Request received. URL: ${req.url}`))
  .on('upgrade', (req, socket, head) => console.log(`Upgrade requested. Header: ${head.toString()}`))
server.listen(port, ()=>console.log(`Server listening on port ${port}...`))

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
      let data
      let useHTML = false
      try {
        data = JSON.parse(Buffer.concat(chunks).toString())
      } catch(err) {
        try {
          let qs = new URLSearchParams(Buffer.concat(chunks).toString())
          data = {
            name: qs.get('name'),
            email: qs.get('email')
          }
          useHTML = true
        } catch(e) {
          data = {}
        }
      }
      
      switch (url_method) {
        case '/newsletter_signup GET':
          let contents = fs.readFileSync('signup.html').toString()
          header(res, 200, 'text/html')
          messagePlain(res, contents)
          break
        case '/newsletter_signup POST':
          console.debug('Data is: ', data)
          if(data.name === undefined || data.email === undefined) {
            header(res, 404)
            return message(res, 'error', 'data and name are required')
          }
          newsletter.emit('signup', data.name, data.email)
          header(res, 200, useHTML ? 'text/html' : 'application/json')
          let msg = 'signup handed off to worker'
          if(useHTML) {
            messagePlain(res, `<!DOCTYPE html><html><head><title>Success</title></head><body><h1>Success</h1><p>${msg}</p></body></html>`)
          } else {
            message(res, 'success', msg)
          }
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
    try {
      fs.accessSync(path.join('data', 'db.csv'), fs.constants.F_OK | fs.constants.W_OK)
    } catch(e) {
      try {
        fs.mkdirSync('data')
        fs.writeFileSync(path.join('data', 'db.csv'), 'name,email\n')
      } catch(err) {
        return console.error(err)
      }
    }
    fs.appendFile(path.join('data', 'db.csv'), `"${name}","${email}"\n`, err=>{
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

function messagePlain(res, data) {
  res.write(data)
  res.end()
}
