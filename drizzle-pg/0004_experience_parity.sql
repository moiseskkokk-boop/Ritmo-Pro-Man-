ALTER TABLE training_sessions ADD COLUMN experience varchar(16) NOT NULL DEFAULT 'man' CHECK (experience IN ('man','woman'));
ALTER TABLE training_sessions ADD COLUMN "completedExercisesJson" text NOT NULL DEFAULT '[]';
ALTER TABLE workout_plans ADD COLUMN experience varchar(16) NOT NULL DEFAULT 'man' CHECK (experience IN ('man','woman'));
CREATE INDEX training_sessions_experience_date ON training_sessions ("userId", experience, "activityDate");
CREATE INDEX workout_plans_experience ON workout_plans ("userId", experience);
