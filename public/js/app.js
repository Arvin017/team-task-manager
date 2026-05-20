// ===== STATE =====
let currentUser = null;
let currentProject = null;
let allUsers = [];

// ===== API HELPER =====
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch('/api' + path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ===== TOAST =====
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ===== AUTH =====
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (tab === 'login') === (i === 0)));
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('signup-form').classList.toggle('hidden', tab !== 'signup');
}

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.textContent = '';
  try {
    const { user } = await api('POST', '/auth/login', { email, password });
    currentUser = user;
    initApp();
  } catch (e) { err.textContent = e.message; }
}

async function signup() {
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const err = document.getElementById('signup-error');
  err.textContent = '';
  try {
    const { user } = await api('POST', '/auth/signup', { name, email, password });
    currentUser = user;
    initApp();
  } catch (e) { err.textContent = e.message; }
}

async function logout() {
  await api('POST', '/auth/logout');
  currentUser = null;
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
}

// Handle Enter key
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const loginVisible = !document.getElementById('login-form').classList.contains('hidden');
    const signupVisible = !document.getElementById('signup-form').classList.contains('hidden');
    const authVisible = !document.getElementById('auth-screen').classList.contains('hidden');
    if (authVisible && loginVisible) login();
    else if (authVisible && signupVisible) signup();
  }
});

// ===== INIT =====
async function initApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  document.getElementById('sidebar-name').textContent = currentUser.name;
  document.getElementById('sidebar-avatar').textContent = currentUser.name[0].toUpperCase();
  document.getElementById('sidebar-role').textContent = currentUser.role;

  // Show/hide admin nav
  if (currentUser.role !== 'admin') document.getElementById('nav-users').style.display = 'none';
  document.getElementById('btn-new-project') && (document.getElementById('btn-new-project').style.display = currentUser.role === 'admin' ? '' : 'none');

  allUsers = await api('GET', '/users').catch(() => []);
  showPage('dashboard');
}

// ===== NAVIGATION =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');
  const nav = document.querySelector(`[data-page="${name}"]`);
  if (nav) nav.classList.add('active');

  if (name === 'dashboard') loadDashboard();
  else if (name === 'projects') loadProjects();
  else if (name === 'tasks') loadMyTasks();
  else if (name === 'users') loadUsers();
}

// ===== DASHBOARD =====
async function loadDashboard() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dashboard-greeting').textContent = `${greet}, ${currentUser.name.split(' ')[0]}`;

  try {
    const data = await api('GET', '/users/dashboard');
    document.getElementById('stat-projects').textContent = data.projectCount;
    document.getElementById('stat-todo').textContent = data.taskStats.todo;
    document.getElementById('stat-inprogress').textContent = data.taskStats.in_progress;
    document.getElementById('stat-done').textContent = data.taskStats.done;
    document.getElementById('overdue-count').textContent = data.overdueTasks.length;

    const overdueEl = document.getElementById('overdue-list');
    overdueEl.innerHTML = data.overdueTasks.length
      ? data.overdueTasks.map(t => taskItem(t, true)).join('')
      : '<div class="empty-state"><div class="icon">✓</div>No overdue tasks!</div>';

    const recentEl = document.getElementById('recent-list');
    recentEl.innerHTML = data.recentTasks.length
      ? data.recentTasks.map(t => taskItem(t, true)).join('')
      : '<div class="empty-state"><div class="icon">📋</div>No tasks yet</div>';
  } catch (e) { toast('Failed to load dashboard', 'error'); }
}

// ===== PROJECTS =====
async function loadProjects() {
  try {
    const projects = await api('GET', '/projects');
    const grid = document.getElementById('projects-grid');
    grid.innerHTML = projects.length
      ? projects.map(p => `
          <div class="project-card" onclick="openProject(${p.id})">
            <h4>${esc(p.name)}</h4>
            <p>${esc(p.description || 'No description')}</p>
            <div class="project-meta">
              <span class="meta-chip">📋 ${p.task_count} tasks</span>
              <span class="meta-chip">👥 ${p.member_count} members</span>
            </div>
          </div>`)
        .join('')
      : '<div class="empty-state" style="grid-column:1/-1"><div class="icon">📁</div>No projects yet. Admins can create projects.</div>';
  } catch (e) { toast('Failed to load projects', 'error'); }
}

async function openProject(id) {
  try {
    currentProject = await api('GET', `/projects/${id}`);
    document.getElementById('detail-project-name').textContent = currentProject.name;
    document.getElementById('detail-meta').innerHTML = `
      <span>Owner: ${esc(currentProject.owner_name)}</span>
      <span>${currentProject.members.length} members</span>
      <span>${currentProject.tasks.length} tasks</span>
    `;

    // Show/hide admin controls
    const isAdmin = currentUser.role === 'admin' || currentProject.members.find(m => m.id === currentUser.id && m.project_role === 'admin');
    document.getElementById('btn-add-member').style.display = isAdmin ? '' : 'none';

    renderDetailTasks();
    renderDetailMembers();
    showPageDirect('project-detail');
  } catch (e) { toast('Failed to load project', 'error'); }
}

function showPageDirect(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');
}

function renderDetailTasks() {
  const statusFilter = document.getElementById('task-filter-status').value;
  const priorityFilter = document.getElementById('task-filter-priority').value;
  const tasks = currentProject.tasks.filter(t =>
    (!statusFilter || t.status === statusFilter) &&
    (!priorityFilter || t.priority === priorityFilter)
  );
  document.getElementById('detail-tasks').innerHTML = tasks.length
    ? tasks.map(t => taskItem(t)).join('')
    : '<div class="empty-state"><div class="icon">✓</div>No tasks match filters</div>';
}

function renderDetailMembers() {
  const el = document.getElementById('detail-members');
  el.innerHTML = currentProject.members.map(m => `
    <div class="member-item">
      <div class="member-avatar">${m.name[0].toUpperCase()}</div>
      <div class="member-details">
        <div class="member-name">${esc(m.name)}</div>
        <div class="member-email">${esc(m.email)}</div>
      </div>
      <span class="badge ${m.project_role}">${m.project_role}</span>
    </div>`).join('');
}

// ===== MY TASKS =====
async function loadMyTasks() {
  const status = document.getElementById('my-task-status').value;
  const priority = document.getElementById('my-task-priority').value;
  let url = `/tasks?assignee_id=${currentUser.id}`;
  if (status) url += `&status=${status}`;
  if (priority) url += `&priority=${priority}`;
  try {
    const tasks = await api('GET', url);
    const el = document.getElementById('my-tasks-list');
    el.innerHTML = tasks.length
      ? tasks.map(t => taskItem(t, true)).join('')
      : '<div class="empty-state"><div class="icon">🎉</div>No tasks assigned to you</div>';
  } catch (e) { toast('Failed to load tasks', 'error'); }
}

// ===== USERS =====
async function loadUsers() {
  const el = document.getElementById('users-list');
  el.innerHTML = allUsers.map(u => `
    <div class="user-card">
      <div class="user-card-top">
        <div class="user-avatar-lg">${u.name[0].toUpperCase()}</div>
        <div>
          <div style="font-weight:700">${esc(u.name)}</div>
          <div style="font-size:0.78rem;color:var(--text3);font-family:var(--mono)">${esc(u.email)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="badge ${u.role}">${u.role}</span>
        ${currentUser.role === 'admin' && u.id !== currentUser.id
          ? `<button class="btn-ghost small" onclick="toggleRole(${u.id},'${u.role}')">
              Make ${u.role === 'admin' ? 'Member' : 'Admin'}
            </button>`
          : ''}
      </div>
    </div>`).join('');
}

async function toggleRole(userId, currentRole) {
  const newRole = currentRole === 'admin' ? 'member' : 'admin';
  try {
    await api('PUT', `/users/${userId}/role`, { role: newRole });
    allUsers = await api('GET', '/users');
    loadUsers();
    toast(`Role updated to ${newRole}`);
  } catch (e) { toast(e.message, 'error'); }
}

// ===== TASK ITEM HTML =====
function taskItem(t, showProject = false) {
  const due = t.due_date ? new Date(t.due_date) : null;
  const overdue = due && due < new Date() && t.status !== 'done';
  return `
    <div class="task-item" onclick="openTaskDetail(${JSON.stringify(t).replace(/"/g, '&quot;')})">
      <div class="task-status-dot dot-${t.status}"></div>
      <span class="task-title ${t.status === 'done' ? 'done' : ''}">${esc(t.title)}</span>
      <div class="task-tags">
        ${showProject && t.project_name ? `<span class="task-detail-info">${esc(t.project_name)}</span>` : ''}
        <span class="badge ${t.priority}">${t.priority}</span>
        <span class="badge ${t.status}">${t.status.replace('_', ' ')}</span>
        ${due ? `<span class="task-detail-info" style="${overdue ? 'color:var(--danger)' : ''}">${overdue ? '⚠ ' : ''}${fmtDate(t.due_date)}</span>` : ''}
      </div>
    </div>`;
}

// ===== TASK DETAIL MODAL =====
function openTaskDetail(task) {
  openModal('Task Details', `
    <div style="display:flex;flex-direction:column;gap:0.875rem">
      <div>
        <div style="font-size:1.15rem;font-weight:700">${esc(task.title)}</div>
        ${task.description ? `<p style="color:var(--text2);font-size:0.875rem;margin-top:0.4rem">${esc(task.description)}</p>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div class="field"><label>Status</label><span class="badge ${task.status}">${task.status.replace('_', ' ')}</span></div>
        <div class="field"><label>Priority</label><span class="badge ${task.priority}">${task.priority}</span></div>
        ${task.assignee_name ? `<div class="field"><label>Assignee</label><span>${esc(task.assignee_name)}</span></div>` : ''}
        ${task.due_date ? `<div class="field"><label>Due Date</label><span style="font-family:var(--mono);font-size:0.85rem">${fmtDate(task.due_date)}</span></div>` : ''}
        ${task.project_name ? `<div class="field"><label>Project</label><span>${esc(task.project_name)}</span></div>` : ''}
        <div class="field"><label>Created by</label><span>${esc(task.creator_name)}</span></div>
      </div>
      <div class="modal-actions">
        ${canEditTask(task) ? `<button class="btn-ghost small" onclick="openEditTaskModal(${JSON.stringify(task).replace(/"/g, '&quot;')})">Edit</button>` : ''}
        ${canDeleteTask(task) ? `<button class="btn-danger" onclick="deleteTask(${task.id})">Delete</button>` : ''}
      </div>
    </div>
  `);
}

function canEditTask(task) {
  return currentUser.role === 'admin' || task.created_by === currentUser.id || task.assignee_id === currentUser.id;
}
function canDeleteTask(task) {
  return currentUser.role === 'admin' || task.created_by === currentUser.id;
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await api('DELETE', `/tasks/${id}`);
    toast('Task deleted');
    closeModal();
    if (currentProject) {
      currentProject = await api('GET', `/projects/${currentProject.id}`);
      renderDetailTasks();
    }
  } catch (e) { toast(e.message, 'error'); }
}

// ===== NEW PROJECT MODAL =====
function openProjectModal() {
  openModal('New Project', `
    <div class="field"><label>Project Name *</label><input id="m-pname" placeholder="e.g. Website Redesign" /></div>
    <div class="field"><label>Description</label><textarea id="m-pdesc" placeholder="What is this project about?"></textarea></div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="createProject()">Create Project</button>
    </div>
  `);
  setTimeout(() => document.getElementById('m-pname')?.focus(), 50);
}

async function createProject() {
  const name = document.getElementById('m-pname').value.trim();
  const description = document.getElementById('m-pdesc').value.trim();
  if (!name) return toast('Project name is required', 'error');
  try {
    await api('POST', '/projects', { name, description });
    toast('Project created!');
    closeModal();
    loadProjects();
  } catch (e) { toast(e.message, 'error'); }
}

// ===== NEW TASK MODAL =====
function openTaskModal() {
  const memberOptions = currentProject
    ? currentProject.members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')
    : allUsers.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');

  const projectOptions = currentProject
    ? `<option value="${currentProject.id}" selected>${esc(currentProject.name)}</option>`
    : allUsers.length === 0 ? '' : ''; // Will be filled

  openModal('New Task', `
    <div class="field"><label>Title *</label><input id="m-ttitle" placeholder="Task title" /></div>
    <div class="field"><label>Description</label><textarea id="m-tdesc" placeholder="Optional details..."></textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
      <div class="field"><label>Status</label>
        <select id="m-tstatus">
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      <div class="field"><label>Priority</label>
        <select id="m-tpriority">
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
      </div>
    </div>
    <div class="field"><label>Assign To</label>
      <select id="m-tassignee">
        <option value="">Unassigned</option>
        ${memberOptions}
      </select>
    </div>
    <div class="field"><label>Due Date</label><input type="date" id="m-tdue" /></div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="createTask()">Create Task</button>
    </div>
  `);
  setTimeout(() => document.getElementById('m-ttitle')?.focus(), 50);
}

async function createTask() {
  const title = document.getElementById('m-ttitle').value.trim();
  if (!title) return toast('Title is required', 'error');
  const payload = {
    title,
    description: document.getElementById('m-tdesc').value.trim(),
    project_id: currentProject.id,
    status: document.getElementById('m-tstatus').value,
    priority: document.getElementById('m-tpriority').value,
    assignee_id: document.getElementById('m-tassignee').value || null,
    due_date: document.getElementById('m-tdue').value || null,
  };
  try {
    await api('POST', '/tasks', payload);
    toast('Task created!');
    closeModal();
    currentProject = await api('GET', `/projects/${currentProject.id}`);
    renderDetailTasks();
  } catch (e) { toast(e.message, 'error'); }
}

// ===== EDIT TASK MODAL =====
function openEditTaskModal(task) {
  const memberOptions = currentProject
    ? currentProject.members.map(m => `<option value="${m.id}" ${task.assignee_id == m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')
    : '';
  openModal('Edit Task', `
    <div class="field"><label>Title *</label><input id="m-ettitle" value="${esc(task.title)}" /></div>
    <div class="field"><label>Description</label><textarea id="m-etdesc">${esc(task.description || '')}</textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
      <div class="field"><label>Status</label>
        <select id="m-etstatus">
          <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
          <option value="done" ${task.status === 'done' ? 'selected' : ''}>Done</option>
        </select>
      </div>
      <div class="field"><label>Priority</label>
        <select id="m-etpriority">
          <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
          <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
          <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
        </select>
      </div>
    </div>
    <div class="field"><label>Assign To</label>
      <select id="m-etassignee">
        <option value="">Unassigned</option>
        ${memberOptions}
      </select>
    </div>
    <div class="field"><label>Due Date</label><input type="date" id="m-etdue" value="${task.due_date || ''}" /></div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="updateTask(${task.id})">Save Changes</button>
    </div>
  `);
}

async function updateTask(id) {
  const payload = {
    title: document.getElementById('m-ettitle').value.trim(),
    description: document.getElementById('m-etdesc').value.trim(),
    status: document.getElementById('m-etstatus').value,
    priority: document.getElementById('m-etpriority').value,
    assignee_id: document.getElementById('m-etassignee').value || null,
    due_date: document.getElementById('m-etdue').value || null,
  };
  try {
    await api('PUT', `/tasks/${id}`, payload);
    toast('Task updated!');
    closeModal();
    if (currentProject) {
      currentProject = await api('GET', `/projects/${currentProject.id}`);
      renderDetailTasks();
    } else { loadMyTasks(); }
  } catch (e) { toast(e.message, 'error'); }
}

// ===== ADD MEMBER MODAL =====
function openAddMemberModal() {
  const existingIds = new Set(currentProject.members.map(m => m.id));
  const available = allUsers.filter(u => !existingIds.has(u.id));
  if (!available.length) return toast('All users are already members', 'error');

  openModal('Add Member', `
    <div class="field"><label>Select User</label>
      <select id="m-muid">
        ${available.map(u => `<option value="${u.id}">${esc(u.name)} (${esc(u.email)})</option>`).join('')}
      </select>
    </div>
    <div class="field"><label>Project Role</label>
      <select id="m-mrole">
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" onclick="addMember()">Add Member</button>
    </div>
  `);
}

async function addMember() {
  const user_id = document.getElementById('m-muid').value;
  const role = document.getElementById('m-mrole').value;
  try {
    await api('POST', `/projects/${currentProject.id}/members`, { user_id, role });
    toast('Member added!');
    closeModal();
    currentProject = await api('GET', `/projects/${currentProject.id}`);
    renderDetailMembers();
    allUsers = await api('GET', '/users').catch(() => allUsers);
  } catch (e) { toast(e.message, 'error'); }
}

// ===== MODAL SYSTEM =====
function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal(event) {
  if (event && event.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ===== HELPERS =====
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ===== BOOT =====
(async () => {
  try {
    const { user } = await api('GET', '/auth/me');
    currentUser = user;
    initApp();
  } catch {
    // Not logged in, show auth
  }
})();
