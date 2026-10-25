module.exports = {
  SCHEMA_VERSION: 1,
  META: 'fit_meta', WORKOUTS: 'fit_workouts', BODY: 'fit_body', CUSTOM: 'fit_custom_exercises',
  workoutDetail: id => 'fit_workout_' + id, DETAIL_PREFIX: 'fit_workout_',
  AEROBICS: 'fit_aerobics',
  LEGACY_WORKOUTS: 'fit_workouts_v1', LEGACY_BODY: 'fit_body_v1',
};
