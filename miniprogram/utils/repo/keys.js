module.exports = {
  SCHEMA_VERSION: 1,
  META: 'fit_meta', WORKOUTS: 'fit_workouts', BODY: 'fit_body', CUSTOM: 'fit_custom_exercises',
  workoutDetail: id => 'fit_workout_' + id, DETAIL_PREFIX: 'fit_workout_',
  AEROBICS: 'fit_aerobics',
  // 我的训练模板。缺键 = 还没有副本，不升 schema。精选模板不进存储。
  TEMPLATES: 'fit_templates',
  // Diet keys are optional. Missing key = empty state (same idea as fit_rest_days), not a schema bump.
  DIET_PLAN: 'fit_diet_plan', DIET_LOGS: 'fit_diet_logs', DIET_FOODS: 'fit_diet_foods',
  LEGACY_WORKOUTS: 'fit_workouts_v1', LEGACY_BODY: 'fit_body_v1',
};
