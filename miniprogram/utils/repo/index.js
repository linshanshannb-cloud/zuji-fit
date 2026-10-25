// Single entry point for pages: const repo = require('../../utils/repo/index')  (WeChat does not resolve a directory to index.js)
const S = require('../storage');
const C = require('./core');
const V = require('./validate');
const meta = require('./meta');
const workouts = require('./workouts');
const body = require('./body');
const exercises = require('./exercises');
const series = require('./series');
const prefs = require('./prefs');
const restDays = require('./restdays');
const aerobic = require('./aerobic');
const R = require('../rest');
module.exports = {
  init: meta.init, status: meta.status, reload: meta.reload, isReadOnly: S.isReadOnly, health: S.getHealth,
  workouts, body, exercises, series, prefs, restDays, aerobic, validate: V, rest: R.prefsApi(prefs),
  deleteCustomExercise: id => exercises.deleteCustom(id, workouts.referencedExerciseIds()),
  // test / tooling hooks
  _setBackend: S.setBackend, _setClock: C.setClock, _memoryBackend: S.memoryBackend,
};
