'use strict'

var tape = require('tape')
var overlay = require('../overlay-pslg')

tape('basic overlay test', function(t) {

  //This test is not yet very sophisticated, more work is needed
  var redPoints = [
    [0.5, 0.25],
    [0.25, 0.5],
    [0.75, 0.75]
  ]
  var redEdges = [ [0,1], [1,2], [2,0] ]

  var bluePoints = [
    [0.25, 0.25],
    [0.25,  0.6],
    [0.6, 0.6],
    [0.6, 0.25]
  ]
  var blueEdges = [ [0,1], [1,2], [2,3], [3,0] ]

  var result = overlay(redPoints, redEdges, bluePoints, blueEdges, 'and')

  t.equals(result.points.length, 5)
  t.equals(result.blue.length, 2)
  t.equals(result.red.length, 3)

  t.end()
})
