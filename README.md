# TaskFlow — Team Task Manager

A full-stack web application for managing projects, assigning tasks, and tracking team progress with role-based access control.

## Live Demo
> **Live URL:** https://team-task-manager-production-9117.up.railway.app/

## Features

- **Authentication** — Signup/Login with JWT sessions (httpOnly cookies)
- **Role-Based Access** — Global Admin vs Member; Project-level Admin vs Member
- **Projects** — Create, view, and manage projects (Admin only creates)
- **Team Management** — Add/remove members per project, assign project roles
- **Tasks** — Create, assign, update status/priority, set due dates, filter
- **Dashboard** — Stats overview, overdue alerts, recent activity

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express |
| Database | SQLite (Node.js built-in `node:sqlite`) |
| Auth | JWT + bcrypt |
| Frontend | Vanilla JS SPA (no build step) |
| Deployment | Railway |

## API Endpoints

### Auth
| Method | Route | Access |
|--------|-------|--------|
| POST | `/api/auth/signup` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Auth |
| GET | `/api/auth/me` | Auth |

### Projects
| Method | Route | Access |
|--------|-------|--------|
| GET | `/api/projects` | Auth |
| POST | `/api/projects` | Admin |
| GET | `/api/projects/:id` | Project Member |
| PUT | `/api/projects/:id` | Project Admin |
| DELETE | `/api/projects/:id` | Project Admin |
| POST | `/api/projects/:id/members` | Project Admin |
| DELETE | `/api/projects/:id/members/:uid` | Project Admin |

### Tasks
| Method | Route | Access |
|--------|-------|--------|
| GET | `/api/tasks` | Auth (filtered) |
| POST | `/api/tasks` | Project Member |
| PUT | `/api/tasks/:id` | Task Creator/Assignee/Admin |
| DELETE | `/api/tasks/:id` | Task Creator/Admin |

### Users
| Method | Route | Access |
|--------|-------|--------|
| GET | `/api/users` | Auth |
| GET | `/api/users/dashboard` | Auth |
| PUT | `/api/users/:id/role` | Admin |

## Setup & Run Locally

```bash
# Clone
git clone <your-repo-url>
cd team-task-manager

# Install
npm install

# Start
npm start
# → http://localhost:3000
```

**First user to register automatically becomes Admin.**

## Deploy to Railway

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo — Railway auto-detects Node.js
4. Add environment variables:
   - `JWT_SECRET` → any long random string (e.g. `openssl rand -hex 32`)
   - `NODE_ENV` → `production`
5. Click **Deploy** — your app will be live in ~2 minutes!

> For persistent database on Railway, consider adding a Railway Volume mounted at `/data` and set `DB_PATH=/data/data.db`

## Role Hierarchy

```
Global Admin
  ├── Can create/delete any project
  ├── Can manage all tasks & users
  ├── Can change any user's global role
  └── Sees all data in dashboard

Project Admin (per-project)
  ├── Can add/remove project members
  └── Can edit/delete project

Project Member
  ├── Can create & edit tasks in their projects
  └── Can see project members & tasks

Global Member
  └── Can only access projects they've been added to
```

## Demo Video
_(Link to 2–5 min screen recording)_
