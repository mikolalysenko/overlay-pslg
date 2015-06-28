'use strict'

var orient = require('robust-orientation')
var vec2 = require('vec2')
var segment2 = require('segment2')
var mouseChange = require('mouse-change')
var segCrosses = require('robust-segment-intersect')
var fit = require('canvas-fit')

var overlay = require('../overlay-pslg')

//Create canvas and context
var canvas = document.createElement('canvas')
var context = canvas.getContext('2d')
document.body.appendChild(canvas)
window.addEventListener('resize', fit(canvas), false)

var optionDiv = document.createElement('div')
optionDiv.style.position = 'absolute'
optionDiv.style.left = '5px'
optionDiv.style.top = '5px'
optionDiv.style['z-index'] = '10'
document.body.appendChild(optionDiv)

var redPoints      = []
var redEdges       = []
var bluePoints     = []
var blueEdges      = []
var operation      = 'xor'

var computedPoints = []
var computedRed    = []
var computedBlue   = []

function dataChanged() {
  var graph = overlay(redPoints, redEdges, bluePoints, blueEdges, operation)
  computedPoints = graph.points
  computedRed    = graph.red
  computedBlue   = graph.blue
}

var mode = 'red'
var colorButton = document.createElement('input')
colorButton.type = 'button'
colorButton.addEventListener('click', toggleColor)
optionDiv.appendChild(colorButton)

var OPERATIONS = [
  'xor',
  'and',
  'or',
  'sub',
  'rsub'
]
var operationP = document.createElement('p')
var operationSelect = document.createElement('select')
OPERATIONS.forEach(function(op) {
  var option = document.createElement('option')
  option.text = option.value = op
  operationSelect.add(option)
})
operationP.appendChild(operationSelect)
optionDiv.appendChild(operationP)

operationSelect.addEventListener('change', function() {
  operation = operationSelect.value
  dataChanged()
})

function toggleColor() {
  if(mode === 'red') {
    colorButton.style.color = colorButton.value = mode = 'blue'
  } else {
    colorButton.style.color = colorButton.value = mode = 'red'
  }
}
toggleColor()

var resetButton = document.createElement('input')
resetButton.type = 'button'
resetButton.value = 'reset'
resetButton.addEventListener('click', function() {
  redPoints.length = redEdges.length = bluePoints.length = blueEdges.length = 0
  dataChanged()
})
var resetP = document.createElement('p')
resetP.appendChild(resetButton)
optionDiv.appendChild(resetP)

var description = document.createElement('p')
description.innerHTML = 'click to add/remove points<br>drag to add edges<br><a href="https://github.com/mikolalysenko/clean-pslg">Project page</a>'
optionDiv.appendChild(description)

function edgeDistance(a, b, c) {
  var p = vec2(c[0], c[1])
  return segment2(vec2(a[0], a[1]), vec2(b[0], b[1])).closestPointTo(p).distance(p)
}

function isValidEdge(a, b) {
  return true
}

var lastButtons = 0,
  highlightPoint = -1,
  startPoint = -1,
  highlightEdge = -1,
  activeEdge = null
mouseChange(canvas, function(buttons, x, y) {
  var s = Math.min(canvas.width, canvas.height)
  var lx = (x - canvas.width/2) / s + 0.5
  var ly = (y - canvas.height/2) / s + 0.5
  var closestDist = 0.0125
  highlightPoint = -1
  highlightEdge = -1

  var points, edges
  if(mode === 'red') {
    points = redPoints
    edges = redEdges
  } else {
    points = bluePoints
    edges = blueEdges
  }

  for(var i=0; i<points.length; ++i) {
    var p = points[i]
    var d2 = Math.sqrt(Math.pow(lx - p[0], 2) + Math.pow(ly - p[1], 2))
    if(d2 < closestDist) {
      highlightPoint = i
      closestDist = d2
    }
  }

  if(highlightPoint < 0) {
    for(var i=0; i<edges.length; ++i) {
      var e = edges[i]
      if(e[0] < 0 || e[1] < 0) {
        continue
      }
      var d2 = edgeDistance(points[e[0]], points[e[1]], [lx, ly])
      if(d2 < closestDist) {
        highlightEdge = i
        closestDist = d2
      }
    }
  }

  if(!lastButtons && !!buttons) {
    if(highlightEdge >= 0) {
      edges.splice(highlightEdge, 1)
      dataChanged()
      highlightEdge = -1
    } else if(highlightPoint < 0) {
      points.push([lx, ly])
      dataChanged()
    } else {
      startPoint = highlightPoint
      activeEdge = [ points[highlightPoint], [lx, ly] ]
    }
  } else if(!!lastButtons && !buttons) {
    if(startPoint >= 0) {
      if(highlightPoint === startPoint) {
        points.splice(highlightPoint, 1)
        var nedges = []
discard_edge:
        for(var i=0; i<edges.length; ++i) {
          var e = edges[i]
          for(var j=0; j<2; ++j) {
            if(e[j] > highlightPoint) {
              e[j] -= 1
            } else if(e[j] === highlightPoint) {
              continue discard_edge
            }
          }
          nedges.push(e)
        }
        edges.length = 0
        edges.push.apply(edges, nedges)
        highlightPoint = -1
        dataChanged()
      } else if(highlightPoint >= 0) {
        if(isValidEdge(points[startPoint], points[highlightPoint])) {
          edges.push([startPoint, highlightPoint])
          dataChanged()
        }
      }
      startPoint = -1
      activeEdge = null
    }
  } else if(!!buttons) {
    if(activeEdge) {
      activeEdge[1] = [lx, ly]
    }
  }
  lastButtons = buttons
})

function line(a, b) {
  var x0 = a[0]-0.5
  var y0 = a[1]-0.5
  var x1 = b[0]-0.5
  var y1 = b[1]-0.5
  var w = canvas.width
  var h = canvas.height
  var s = Math.min(w, h)
  context.beginPath()
  context.moveTo(s*x0 + w/2, s*y0 + h/2)
  context.lineTo(s*x1 + w/2, s*y1 + h/2)
  context.stroke()
}

function circle(x, y, r) {
  var w = canvas.width
  var h = canvas.height
  var s = Math.min(w, h)
  context.beginPath()
  context.moveTo(s*x, s*y)
  context.arc(s*(x-0.5) + w/2, s*(y-0.5) + h/2, r, 0.0, 2.0*Math.PI)
  context.fill()
}

function drawPSLG(points, edges, cmode) {

  var style = cmode
  if(mode !== cmode) {
    if(cmode === 'red') {
      style = 'rgba(255, 0, 0, 0.5)'
    } else {
      style = 'rgba(0, 0, 255, 0.5)'
    }
  }

  for(var i=0; i<edges.length; ++i) {
    var e = edges[i]
    var a = points[e[0]]
    var b = points[e[1]]
    context.strokeStyle = style
    context.lineWidth = 1
    line(a, b)
  }

  if(!!activeEdge) {
    context.strokeStyle = '#000'
    line(activeEdge[0], activeEdge[1])
  } else if(highlightEdge >= 0 && mode === cmode) {
    var e = edges[highlightEdge]
    context.strokeStyle = '#000'
    line(points[e[0]], points[e[1]])
  }

  for(var i=0; i<points.length; ++i) {
    var p = points[i]
    if(mode === cmode && (i === highlightPoint || i === startPoint)) {
      context.fillStyle = '#000'
    } else {
      context.fillStyle = style
    }
    circle(p[0], p[1], 2)
  }
}

function draw() {
  requestAnimationFrame(draw)

  var w = canvas.width
  var h = canvas.height
  context.fillStyle = '#fff'
  context.fillRect(0, 0, w, h)

  context.fillStyle = 'rgba(0, 255, 0, 0.4)'
  for(var i=0; i<computedPoints.length; ++i) {
    var p = computedPoints[i]
    circle(p[0], p[1], 4)
  }

  context.lineWidth = 4
  context.strokeStyle = 'rgba(255, 128, 0, 0.4)'
  for(var i=0; i<computedRed.length; ++i) {
    var e = computedRed[i]
    var a = computedPoints[e[0]]
    var b = computedPoints[e[1]]
    line(a, b)
  }
  context.strokeStyle = 'rgba(0, 128, 255, 0.4)'
  for(var i=0; i<computedBlue.length; ++i) {
    var e = computedBlue  [i]
    var a = computedPoints[e[0]]
    var b = computedPoints[e[1]]
    line(a, b)
  }
  context.lineWidth = 1

  drawPSLG(redPoints, redEdges, 'red')
  drawPSLG(bluePoints, blueEdges, 'blue')
}

draw()
