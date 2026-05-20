const express = require('express');
const db = require('../db/database');
const { authenticate, requireProjectAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/projects — list projects user has access to
router.get('/', (req, res) => {
  const projects = req.user.role === 'admin'
    ? db.prepare(`
        SELECT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p JOIN users u ON p.owner_id = u.id
        ORDER BY p.created_at DESC
      `).all()
    : db.prepare(`
        SELECT p.*, u.name as owner_name, pm.role as my_role,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        JOIN users u ON p.owner_id = u.id
        WHERE pm.user_id = ?
        ORDER BY p.created_at DESC
      `).all(req.user.id);

  res.json(projects);
});

// POST /api/projects — create project (admin only)
router.post('/', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can create projects' });
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const result = db.prepare('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)').run(name, description || null, req.user.id);
  // Add creator as project admin
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(result.lastInsertRowid, req.user.id, 'admin');

  const project = db.prepare('SELECT p.*, u.name as owner_name FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = db.prepare(`
    SELECT p.*, u.name as owner_name FROM projects p JOIN users u ON p.owner_id = u.id WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Check access
  if (req.user.role !== 'admin') {
    const member = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!member) return res.status(403).json({ error: 'Access denied' });
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, u.role as global_role, pm.role as project_role, pm.joined_at
    FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?
  `).all(req.params.id);

  const tasks = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.created_by = c.id
    WHERE t.project_id = ?
    ORDER BY t.created_at DESC
  `).all(req.params.id);

  res.json({ ...project, members, tasks });
});

// PUT /api/projects/:id
router.put('/:projectId', requireProjectAdmin, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });
  db.prepare('UPDATE projects SET name = ?, description = ? WHERE id = ?').run(name, description || null, req.params.projectId);
  res.json({ message: 'Project updated' });
});

// DELETE /api/projects/:id
router.delete('/:projectId', requireProjectAdmin, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.projectId);
  res.json({ message: 'Project deleted' });
});

// POST /api/projects/:id/members — add member
router.post('/:projectId/members', requireProjectAdmin, (req, res) => {
  const { user_id, role } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, user_id);
  if (existing) return res.status(409).json({ error: 'User already in project' });

  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(req.params.projectId, user_id, role === 'admin' ? 'admin' : 'member');
  res.status(201).json({ message: `${user.name} added to project` });
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:projectId/members/:userId', requireProjectAdmin, (req, res) => {
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(req.params.projectId, req.params.userId);
  res.json({ message: 'Member removed' });
});

module.exports = router;
