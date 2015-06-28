'use strict'

var snapRound = require('clean-pslg')
var cdt2d = require('cdt2d')
var bsearch = require('binary-search-bounds')
var boundary = require('simplicial-complex-boundary')

module.exports = overlayPSLG

var RED  = 0
var BLUE = 1

var OPERATORS = {
  'xor':  [0, 1, 1, 0],
  'or':   [0, 1, 1, 1],
  'and':  [0, 0, 0, 1],
  'sub':  [0, 1, 0, 0],
  'rsub': [0, 0, 1, 0]
}

function getTable(op) {
  if(typeof op !== 'string') {
    return OPERATORS.xor
  }
  var x = OPERATORS[op.toLowerCase()]
  if(x) {
    return x
  }
  return OPERATORS.xor
}


function compareEdge(a, b) {
  return Math.min(a[0], a[1]) - Math.min(b[0], b[1]) ||
         Math.max(a[0], a[1]) - Math.max(b[0], b[1])
}

function edgeCellIndex(edge, cell) {
  var a = edge[0]
  var b = edge[1]
  for(var i=0; i<3; ++i) {
    if(cell[i] !== a && cell[i] !== b) {
      return i
    }
  }
  return -1
}

function buildCellIndex(cells) {
  //Initialize cell index
  var cellIndex = new Array(3*cells.length)
  for(var i=0; i<3*cells.length; ++i) {
    cellIndex[i] = -1
  }

  //Sort edges
  var edges = []
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i]
    for(var j=0; j<3; ++j) {
      edges.push([c[j], c[(j+1)%3], i])
    }
  }
  edges.sort(compareEdge)

  //For each pair of edges, link adjacent cells
  for(var i=1; i<edges.length; ++i) {
    var e = edges[i]
    var f = edges[i-1]
    if(compareEdge(e, f) !== 0) {
      continue
    }
    var ce = e[2]
    var cf = f[2]
    var ei = edgeCellIndex(e, cells[ce])
    var fi = edgeCellIndex(f, cells[cf])
    cellIndex[3*ce+ei] = cf
    cellIndex[3*cf+fi] = ce
  }

  return cellIndex
}

function compareLex2(a, b) {
  return a[0]-b[0] || a[1]-b[1]
}

function canonicalizeEdges(edges) {
  for(var i=0; i<edges.length; ++i) {
    var e = edges[i]
    var a = e[0]
    var b = e[1]
    e[0] = Math.min(a, b)
    e[1] = Math.max(a, b)
  }
  edges.sort(compareLex2)
}


var TMP = [0,0]
function isConstraint(edges, a, b) {
  TMP[0] = Math.min(a,b)
  TMP[1] = Math.max(a,b)
  return bsearch.eq(edges, TMP, compareLex2) >= 0
}

//Classify all cells within boundary
function markCells(cells, adj, edges) {

  //Initialize active/next queues and flags
  var flags = new Array(cells.length)
  var constraint = new Array(3*cells.length)
  for(var i=0; i<3*cells.length; ++i) {
    constraint[i] = false
  }
  var active = []
  var next   = []
  for(var i=0; i<cells.length; ++i) {
    var c = cells[i]
    flags[i] = 0
    for(var j=0; j<3; ++j) {
      var a = c[(j+1)%3]
      var b = c[(j+2)%3]
      var constr = constraint[3*i+j] = isConstraint(edges, a, b)
      if(adj[3*i+j] >= 0) {
        continue
      }
      if(constr) {
        next.push(i)
      } else {
        flags[i] = 1
        active.push(i)
      }
    }
  }

  //Mark flags
  var side = 1
  while(active.length > 0 || next.length > 0) {
    while(active.length > 0) {
      var t = active.pop()
      if(flags[t] === -side) {
        continue
      }
      flags[t] = side
      var c = cells[t]
      for(var j=0; j<3; ++j) {
        var f = adj[3*t+j]
        if(f >= 0 && flags[f] === 0) {
          if(constraint[3*t+j]) {
            next.push(f)
          } else {
            active.push(f)
            flags[f] = side
          }
        }
      }
    }

    //Swap arrays and loop
    var tmp = next
    next = active
    active = tmp
    next.length = 0
    side = -side
  }

  return flags
}

function setIntersect(colored, edges) {
  var ptr = 0
  for(var i=0,j=0; i<colored.length&&j<edges.length; ) {
    var e = colored[i]
    var f = edges[j]
    var d = e[0]-f[0] || e[1]-f[1]
    if(d < 0) {
      i += 1
    } else if(d > 0) {
      j += 1
    } else {
      colored[ptr++] = colored[i]
      i += 1
      j += 1
    }
  }
  colored.length = ptr
  return colored
}

function relabelEdges(edges, labels) {
  for(var i=0; i<edges.length; ++i) {
    var e = edges[i]
    e[0] = labels[e[0]]
    e[1] = labels[e[1]]
  }
}

function markEdgesActive(edges, labels) {
  for(var i=0; i<edges.length; ++i) {
    var e = edges[i]
    labels[e[0]] = labels[e[1]] = 1
  }
}

function removeUnusedPoints(points, redE, blueE) {
  var labels = new Array(points.length)
  for(var i=0; i<labels.length; ++i) {
    labels[i] = -1
  }
  markEdgesActive(redE, labels)
  markEdgesActive(blueE, labels)

  var ptr = 0
  for(var i=0; i<points.length; ++i) {
    if(labels[i] > 0) {
      labels[i] = ptr
      points[ptr++] = points[i]
    }
  }
  points.length = ptr
  relabelEdges(redE, labels)
  relabelEdges(blueE, labels)
}

function overlayPSLG(redPoints, redEdges, bluePoints, blueEdges, op) {
  //1.  concatenate points
  var numRedPoints = redPoints.length
  var points = redPoints.concat(bluePoints)

  //2.  concatenate edges
  var numRedEdges  = redEdges.length
  var numBlueEdges = blueEdges.length
  var edges        = new Array(numRedEdges + numBlueEdges)
  var colors       = new Array(numRedEdges + numBlueEdges)
  for(var i=0; i<redEdges.length; ++i) {
    var e      = redEdges[i]
    colors[i]  = RED
    edges[i]   = [ e[0], e[1] ]
  }
  for(var i=0; i<blueEdges.length; ++i) {
    var e      = blueEdges[i]
    colors[i+numRedEdges]  = BLUE
    edges[i+numRedEdges]   = [ e[0]+numRedPoints, e[1]+numRedPoints ]
  }

  //3.  run snap rounding with edge colors
  snapRound(points, edges, colors)

  //4. Sort edges
  canonicalizeEdges(edges)

  //5.  extract red and blue edges
  var redE = [], blueE = []
  for(var i=0; i<edges.length; ++i) {
    if(colors[i] === RED) {
      redE.push(edges[i])
    } else {
      blueE.push(edges[i])
    }
  }

  //6.  triangulate
  var cells = cdt2d(points, edges, { delaunay: false })

  //7. build adjacency data structure
  var adj = buildCellIndex(cells)

  //8. classify triangles
  var redFlags = markCells(cells, adj, redE)
  var blueFlags = markCells(cells, adj, blueE)

  //9. filter out cels which are not part of triangulation
  var table = getTable(op)
  var ptr = 0
  for(var i=0; i<cells.length; ++i) {
    var code = ((redFlags[i] < 0)<<1) + (blueFlags[i] < 0)
    if(table[code]) {
      cells[ptr++] = cells[i]
    }
  }
  cells.length = ptr

  //10. extract boundary
  var bnd = boundary(cells)
  canonicalizeEdges(bnd)

  //11. Intersect constraint edges with boundary
  redE = setIntersect(redE, bnd)
  blueE = setIntersect(blueE, bnd)

  //12. filter old points
  removeUnusedPoints(points, redE, blueE)

  return {
    points: points,
    red:    redE,
    blue:   blueE
  }
}
