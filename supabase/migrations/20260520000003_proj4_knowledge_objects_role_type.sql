-- PROJ-4: Add 'role' to knowledge_objects type constraint
-- The spec defines 4 extraction types: process_step | pain_point | tool | role
-- Original migration only had: process_step | tool | pain_point | fact | contact

ALTER TABLE knowledge_objects DROP CONSTRAINT IF EXISTS knowledge_objects_type_check;

ALTER TABLE knowledge_objects
  ADD CONSTRAINT knowledge_objects_type_check
  CHECK (type IN ('process_step', 'tool', 'pain_point', 'role', 'fact', 'contact'));
