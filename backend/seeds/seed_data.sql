-- Seed Data: backend/seeds/seed_data.sql
-- Use for local development and testing only: npm run d1:seed

DELETE FROM tasks;
DELETE FROM goals;
DELETE FROM schedules;
DELETE FROM questionnaire_responses;

-- Insert Goals
INSERT INTO goals (id, title, category, target_date, syllabus, milestones, recommendation, unit_label, total_units, covered_units) VALUES
(
    'goal-jee',
    'JEE Main preparation',
    'Exam / Academic',
    '2026-12-08',
    '[
        {"id": "top-1", "name": "Limits & continuity", "status": "COVERED", "covered": true, "weight": "MEDIUM"},
        {"id": "top-2", "name": "Electrostatics · spaced review", "status": "DUE TODAY", "covered": false, "weight": "HIGH"},
        {"id": "top-3", "name": "Integration by parts", "status": "NEXT UP", "covered": false, "weight": "MEDIUM"},
        {"id": "top-4", "name": "Magnetic fields", "status": "HIGH WEIGHT", "covered": false, "weight": "HIGH"},
        {"id": "top-5", "name": "Organic reaction mechanisms", "status": "UNTOUCHED", "covered": false, "weight": "HIGH"}
    ]',
    '[
        {"date": "Oct 10", "label": "First syllabus pass complete", "icon": "flag"},
        {"date": "Nov 04", "label": "Revision cycle begins", "icon": "repeat"},
        {"date": "Dec 08", "label": "JEE Main mock series", "icon": "trophy"}
    ]',
    'Give magnetic fields your next deep block: it carries high exam weight and has not been touched recently.',
    'topics',
    100,
    62
),
(
    'goal-ds',
    'Data structures',
    'Project / Build',
    '2026-10-04',
    '[
        {"id": "top-ds-1", "name": "Arrays & Strings", "status": "COVERED", "covered": true, "weight": "LOW"},
        {"id": "top-ds-2", "name": "Linked Lists", "status": "NEXT UP", "covered": false, "weight": "MEDIUM"},
        {"id": "top-ds-3", "name": "Binary Trees & BST", "status": "UNTOUCHED", "covered": false, "weight": "HIGH"}
    ]',
    '[
        {"date": "Sep 20", "label": "Trees & Graphs milestone", "icon": "flag"},
        {"date": "Oct 04", "label": "Mock coding test", "icon": "trophy"}
    ]',
    'Focus on pointer manipulation in linked lists before advancing to binary search trees.',
    'modules',
    29,
    11
),
(
    'goal-reading',
    'Reading year',
    'Skill / Mastery',
    '2026-12-31',
    '[
        {"id": "top-rd-1", "name": "Deep Work - Cal Newport", "status": "COVERED", "covered": true, "weight": "MEDIUM"},
        {"id": "top-rd-2", "name": "Atomic Habits - James Clear", "status": "COVERED", "covered": true, "weight": "LOW"},
        {"id": "top-rd-3", "name": "Thinking Fast and Slow", "status": "NEXT UP", "covered": false, "weight": "HIGH"}
    ]',
    '[
        {"date": "Nov 15", "label": "8 books target", "icon": "flag"},
        {"date": "Dec 31", "label": "12 books target", "icon": "trophy"}
    ]',
    'Read 20 pages during your evening wind-down to maintain momentum.',
    'books',
    12,
    6
);

-- Insert Tasks
INSERT INTO tasks (id, title, type, duration_minutes, priority, energy_level, status, scheduled_start, scheduled_end, category, goal_id, column_bucket) VALUES
('task-1', 'Calculus · integration review', 'daily', 90, 'HIGH', 'deep_focus', 'pending', '09:00', '10:30', 'JEE Main preparation', 'goal-jee', 'now'),
('task-2', 'Reply to internship emails', 'daily', 20, 'LOW', 'light', 'pending', NULL, NULL, 'Personal admin', NULL, 'now'),
('task-3', 'Physics · electromagnetic notes', 'daily', 75, 'HIGH', 'deep_focus', 'pending', '10:45', '12:00', 'JEE Main preparation', 'goal-jee', 'up_next'),
('task-4', 'Organic chemistry flashcards', 'daily', 25, 'MEDIUM', 'light', 'pending', '12:15', '12:40', 'JEE Main preparation', 'goal-jee', 'up_next'),
('task-5', 'Practice exam questions', 'daily', 60, 'HIGH', 'deep_focus', 'pending', '18:30', '19:30', 'JEE Main preparation', 'goal-jee', 'up_next'),
('task-6', 'Update reading notes', 'daily', 30, 'LOW', 'light', 'pending', NULL, NULL, 'Reading year', 'goal-reading', 'later'),
('task-7', 'Implement linked list', 'daily', 60, 'MEDIUM', 'deep_focus', 'pending', NULL, NULL, 'Data structures', 'goal-ds', 'later'),
('task-8', 'Morning planning', 'daily', 15, 'MEDIUM', 'light', 'done', '08:30', '08:45', 'Personal admin', NULL, 'now');

-- Insert Initial Questionnaire
INSERT INTO questionnaire_responses (id, date, answers) VALUES
(
    'qr-today',
    '2026-09-13',
    '{"available_hours": 7, "wake_time": "07:30", "sleep_time": "23:30", "energy_level": "deep_focus", "top_priority": "Calculus integration & Physics notes", "fixed_commitments": "Coaching lecture at 16:00", "focus_preference": "Long deep work blocks before lunch"}'
);

-- Insert Schedule
INSERT INTO schedules (id, date, generated_plan, source_questionnaire_id) VALUES
(
    'sched-today',
    '2026-09-13',
    '[
        {
            "id": "block-1",
            "task_id": "task-1",
            "title": "Calculus · integration review",
            "start_time": "09:00",
            "end_time": "10:30",
            "duration": 90,
            "type": "deep_focus",
            "category": "JEE Main preparation",
            "status": "pending",
            "reasoning": "High-priority problem solving scheduled during peak morning energy."
        },
        {
            "id": "block-2",
            "task_id": null,
            "title": "Step away & recharge",
            "start_time": "10:30",
            "end_time": "10:45",
            "duration": 15,
            "type": "break",
            "category": "Rest & hydration",
            "status": "pending",
            "reasoning": "15-minute screen-free break to consolidate calculus concepts."
        },
        {
            "id": "block-3",
            "task_id": "task-3",
            "title": "Physics · electromagnetic notes",
            "start_time": "10:45",
            "end_time": "12:00",
            "duration": 75,
            "type": "deep_focus",
            "category": "JEE Main preparation",
            "status": "pending",
            "reasoning": "Secondary deep block while focus reserves remain strong."
        },
        {
            "id": "block-4",
            "task_id": "task-4",
            "title": "Organic chemistry flashcards",
            "start_time": "12:15",
            "end_time": "12:40",
            "duration": 25,
            "type": "light",
            "category": "JEE Main preparation",
            "status": "pending",
            "reasoning": "Active recall review block before lunch dip."
        },
        {
            "id": "block-5",
            "task_id": "task-5",
            "title": "Practice exam questions",
            "start_time": "18:30",
            "end_time": "19:30",
            "duration": 60,
            "type": "deep_focus",
            "category": "JEE Main preparation",
            "status": "pending",
            "reasoning": "Timed test simulation during evening focus rebound."
        }
    ]',
    'qr-today'
);
