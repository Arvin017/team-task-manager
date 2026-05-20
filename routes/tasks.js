const express = require('express');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function hasProjectAccess(projectId, userId, userRole) {
  if (userRole === 'admin') return true;
  return !!db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
}

// GET /api/tasks — all tasks accessible to user
router.get('/', (req, res) => {
  const { status, priority, assignee_id, project_id } = req.query;

  let query = `
    SELECT t.*, u.name as assignee_name, c.name as creator_name, p.name as project_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.created_by = c.id
    JOIN projects p ON t.project_id = p.id
  `;
  const params = [];
  const conditions = [];

  if (req.user.role !== 'admin') {
    conditions.push('t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)');
    params.push(req.user.id);
  }
  if (status) { conditions.push('t.status = ?'); params.push(status); }
  if (priority) { conditions.push('t.priority = ?'); params.push(priority); }
  if (assignee_id) { conditions.push('t.assignee_id = ?'); params.push(assignee_id); }
  if (project_id) { conditions.push('t.project_id = ?'); params.push(project_id); }

  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY t.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

// POST /api/tasks
router.post('/', (req, res) => {
  const { title, description, project_id, assignee_id, status, priority, due_date } = req.body;
  if (!title || !project_id) return res.status(400).json({ error: 'Title and project_id are required' });

  if (!hasProjectAccess(project_id, req.user.id, req.user.role))
    return res.status(403).json({ error: 'Access denied' });

  // Validate assignee is in project
  if (assignee_id) {
    const inProject = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(project_id, assignee_id);
    if (!inProject && req.user.role !== 'admin') return res.status(400).json({ error: 'Assignee is not a project member' });
  }

  const result = db.prepare(`
    INSERT INTO tasks (title, description, project_id, assignee_id, created_by, status, priority, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description || null, project_id, assignee_id || null, req.user.id,
    status || 'todo', priority || 'medium', due_date || null);

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name, p.name as project_name
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.created_by = c.id JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(task);
});

// PUT /api/tasks/:id
router.put('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!hasProjectAccess(task.project_id, req.user.id, req.user.role))
    return res.status(403).json({ error: 'Access denied' });

  const { title, description, assignee_id, status, priority, due_date } = req.body;
  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, assignee_id = ?, status = ?, priority = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(
    title || task.title,
    description !== undefined ? description : task.description,
    assignee_id !== undefined ? assignee_id : task.assignee_id,
    status || task.status,
    priority || task.priority,
    due_date !== undefined ? due_date : task.due_date,
    req.params.id
  );

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name, p.name as project_name
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.created_by = c.id JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!hasProjectAccess(task.project_id, req.user.id, req.user.role))
    return res.status(403).json({ error: 'Access denied' });
  // Only task creator or admin can delete
  if (task.created_by !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only task creator or admin can delete tasks' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Task deleted' });
});

module.exports = router;
