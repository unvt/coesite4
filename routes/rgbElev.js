var express = require('express')
var router = express.Router()

const config = require('config')
const fs = require('fs')
const cors = require('cors')
const MBTiles = require('@mapbox/mbtiles')

// config constants
const defaultZ = 6
const rgbElevDir = 'rgbElev'

// global variables
let mbtilesPool = {}
let busy = false

var app = express()
app.use(cors())


//Get tile functions
const getMBTiles = async (z, x, y) => {
  let mbtilesPath = ''
  if (z < 6) {
    mbtilesPath = `${rgbElevDir}/0-0-0.mbtiles`
  } else {
    mbtilesPath =
       `${rgbElevDir}/6-${x >> (z - 6)}-${y >> (z - 6)}.mbtiles`
  }
  return new Promise((resolve, reject) => {
    if (mbtilesPool[mbtilesPath]) {
      resolve(mbtilesPool[mbtilesPath].mbtiles)
    } else {
      if (fs.existsSync(mbtilesPath)) {
        new MBTiles(`${mbtilesPath}?mode=ro`, (err, mbtiles) => {
          if (err) {
            reject(new Error(`${mbtilesPath} could not open.`))
          } else {
            mbtilesPool[mbtilesPath] = {
              mbtiles: mbtiles, openTime: new Date()
            }
            resolve(mbtilesPool[mbtilesPath].mbtiles)
          }
        })
      } else {
        reject(new Error(`${mbtilesPath} was not found.`))
      }
    }
  })
}


const getTile = async (mbtiles, z, x, y) => {
  return new Promise((resolve, reject) => {
    mbtiles.getTile(z, x, y, (err, tile, headers) => {
      if (err) {
        reject()
      } else {
        resolve({tile: tile, headers: headers})
      }
    })
  })
}


/* GET Tile. */
router.get(`/zxy/:z/:x/:y.png`, 
 async function(req, res) {
  busy = true
  const z = parseInt(req.params.z)
  const x = parseInt(req.params.x)
  const y = parseInt(req.params.y)

  // Input validation - Security enhancement to prevent invalid tile requests
  // Validate zoom level within reasonable bounds (0-30) to prevent resource exhaustion
  if (isNaN(z) || z < 0 || z > 30) {
    res.status(400).send('Invalid zoom level')
    busy = false
    return
  }
  // Validate X coordinate is within valid range for the zoom level
  if (isNaN(x) || x < 0 || x >= Math.pow(2, z)) {
    res.status(400).send('Invalid x coordinate')
    busy = false
    return
  }
  // Validate Y coordinate is within valid range for the zoom level
  if (isNaN(y) || y < 0 || y >= Math.pow(2, z)) {
    res.status(400).send('Invalid y coordinate')
    busy = false
    return
  }

  getMBTiles(z, x, y).then(mbtiles => {
    getTile(mbtiles, z, x, y).then(r => {
      if (r.tile) {
        res.set('content-type', 'image/png')
        //res.set('content-encoding', 'gzip')
        res.set('last-modified', r.headers['Last-Modified'])
        res.set('etag', r.headers['ETag'])
        res.send(r.tile)
        busy = false
      } else {
        res.status(404).send(`tile not found: /zxy/${z}/${x}/${y}.png`)
        busy = false
      }
    }).catch(e => {
      res.status(404).send(`tile not found (getTile error): /zxy/${z}/${x}/${y}.png`)
      busy = false
    })
  }).catch(e => {
    res.status(404).send(`mbtiles not found for /zxy/${z}/${x}/${y}.png`)
  })

 }
);



module.exports = router;
