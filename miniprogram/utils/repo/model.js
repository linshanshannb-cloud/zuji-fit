// Pure entity helpers (no storage).
const { round1 } = require('./validate');
const isCountable = s => s.done === true && s.type === 'normal';
function computeSummary(detail) {
  const ids = {}; detail.exercises.forEach(e => { ids[e.id] = true; });
  const sets = detail.sets.filter(s => ids[s.workoutExerciseId] && isCountable(s)); // orphan sets are not shown, so not counted
  return { exerciseCount: detail.exercises.length, setCount: sets.length,
    volumeKg: round1(sets.reduce((t, s) => t + (s.weightKg == null ? 0 : s.weightKg) * (s.reps || 0), 0)) };
}
const byOrder = (a, b) => a.order - b.order;
const byIndex = (a, b) => a.index - b.index;
const sortWorkouts = list => list.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
function renumberExercises(exs) { return exs.slice().sort(byOrder).map((e, i) => Object.assign({}, e, { order: i })); }
function renumberSets(sets, weId) {
  let i = 0;
  const mine = sets.filter(s => s.workoutExerciseId === weId).sort(byIndex).map(s => Object.assign({}, s, { index: ++i }));
  return sets.filter(s => s.workoutExerciseId !== weId).concat(mine);
}
// Assemble a view: exercises sorted with nested sets (copies; storage stays flat).
function assemble(header, detail, resolveExercise) {
  const exercises = detail.exercises.slice().sort(byOrder).map(we => {
    const ex = resolveExercise ? resolveExercise(we.exerciseId) : null;
    return Object.assign({}, we, { displayName: (ex && !ex.unknown && ex.nameZh) || we.nameSnapshot || '未知动作', exercise: ex,
      sets: detail.sets.filter(s => s.workoutExerciseId === we.id).sort(byIndex) });
  });
  return Object.assign({}, header, { exercises });
}
function defaultWorkoutName(date) { const [, m, d] = date.split('-').map(Number); return `${m}月${d}日训练`; }
module.exports = { isCountable, computeSummary, byOrder, byIndex, sortWorkouts, renumberExercises, renumberSets, assemble, defaultWorkoutName };
