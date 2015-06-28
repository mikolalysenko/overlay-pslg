//Load the module
var overlay = require('../overlay-pslg')

//Red PSLG - Define a triangle
var redPoints = [
  [0.5, 0.25],
  [0.25, 0.5],
  [0.75, 0.75]
]
var redEdges = [ [0,1], [1,2], [2,0] ]

//Blue PSLG - Define a square
var bluePoints = [
  [0.25, 0.25],
  [0.25,  0.6],
  [0.6, 0.6],
  [0.6, 0.25]
]
var blueEdges = [ [0,1], [1,2], [2,3], [3,0] ]

//Construct intersection
console.log(overlay(redPoints, redEdges, bluePoints, blueEdges, 'and'))
