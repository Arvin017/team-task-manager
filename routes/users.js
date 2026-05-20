const express = require('express');
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/users — list all users (admin sees all, members see project teammates)
router.get('/', (req, res) => {
  const users = req.user.role === 'admin'
    ? db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name').all()
    : db.prepare(`
        SELECT DISTINCT u.id, u.name, u.email, u.role, u.created_at
        FROM users u
        JOIN project_members pm ON u.id = pm.user_id
        WHERE pm.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        ORDER BY u.name
      `).all(req.user.id);
  res.json(users);
});

// GET /api/users/dashboard — stats for current user
router.get('/dashboard', (req, res) => {
  const uid = req.user.id;
  const isAdmin = req.user.role === 'admin';

  const projectCount = isAdmin
    ? db.prepare('SELECT COUNT(*) as c FROM projects').get().c
    : db.prepare('SELECT COUNT(*) as c FROM project_members WHERE user_id = ?').get(uid).c;

  const taskStats = isAdmin
    ? db.prepare(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`).all()
    : db.prepare(`SELECT status, COUNT(*) as count FROM tasks WHERE assignee_id = ? OR created_by = ? GROUP BY status`).all(uid, uid);

  const overdueTasks = isAdmin
    ? db.prepare(`SELECT t.*, p.name as project_name, u.name as assignee_name FROM tasks t JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON t.assignee_id = u.id WHERE t.due_date < date('now') AND t.status != 'done' ORDER BY t.due_date`).all()
    : db.prepare(`SELECT t.*, p.name as project_name, u.name as assignee_name FROM tasks t JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON t.assignee_id = u.id WHERE (t.assignee_id = ? OR t.created_by = ?) AND t.due_date < date('now') AND t.status != 'done' ORDER BY t.due_date`).all(uid, uid);

  const recentTasks = isAdmin
    ? db.prepare(`SELECT t.*, p.name as project_name, u.name as assignee_name FROM tasks t JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON t.assignee_id = u.id ORDER BY t.updated_at DESC LIMIT 10`).all()
    : db.prepare(`SELECT t.*, p.name as project_name, u.name as assignee_name FROM tasks t JOIN projects p ON t.project_id = p.id LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id IN (SELECT project_id FROM project_members WHERE user_id = ?) ORDER BY t.updated_at DESC LIMIT 10`).all(uid);

  const statsMap = { todo: 0, in_progress: 0, done: 0 };
  taskStats.forEach(s => statsMap[s.status] = s.count);

  res.json({
    projectCount,
    taskStats: statsMap,
    overdueTasks,
    recentTasks,
    userCount: isAdmin ? db.prepare('SELECT COUNT(*) as c FROM users').get().c : null
  });
});

// PUT /api/users/:id/role — change role (admin only)
router.put('/:id/role', requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role)) return res.status(400).json({ error: 'Role must be admin or member' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'Role updated' });
});

module.exports = router;
