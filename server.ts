import express from 'express';
import path from 'path';
import db from './db.js';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT as string, 10) || 3000;

  app.use(express.json());

  // API Routes

  // Auth
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password);
    
    if (user) {
      res.json({ user });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, phone, password, role = 'disciple', disciplerName, disciplerPhone, disciplerEmail } = req.body;
    try {
      const info = db.prepare('INSERT INTO users (name, email, phone, password, role, discipler_name, discipler_phone, discipler_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(name, email, phone, password, role, disciplerName || null, disciplerPhone || null, disciplerEmail || null);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      res.json({ user });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Courses
  app.get('/api/courses', (req, res) => {
    const courses = db.prepare('SELECT * FROM courses').all();
    res.json(courses);
  });

  app.get('/api/courses/:id/modules', (req, res) => {
    const modules = db.prepare('SELECT * FROM modules WHERE course_id = ?').all(req.params.id);
    res.json(modules);
  });

  app.get('/api/modules/:id', (req, res) => {
    const module = db.prepare('SELECT * FROM modules WHERE id = ?').get(req.params.id);
    if (module) {
      res.json(module);
    } else {
      res.status(404).json({ error: 'Module not found' });
    }
  });

  // Quizzes
  app.get('/api/modules/:id/quiz', (req, res) => {
    const quiz = db.prepare('SELECT * FROM quizzes WHERE module_id = ?').all(req.params.id);
    res.json(quiz.map((q: any) => ({ ...q, options: JSON.parse(q.options) })));
  });

  app.post('/api/modules/:id/submit-quiz', (req, res) => {
    const { userId, score, passed } = req.body;
    const moduleId = req.params.id;
    try {
      db.prepare('INSERT OR REPLACE INTO user_progress (user_id, module_id, score, passed) VALUES (?, ?, ?, ?)').run(userId, moduleId, score, passed ? 1 : 0);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Progress
  app.get('/api/users/:id/progress', (req, res) => {
    const progress = db.prepare('SELECT * FROM user_progress WHERE user_id = ?').all(req.params.id);
    res.json(progress);
  });

  // Messages
  app.get('/api/messages/:userId', (req, res) => {
    const messages = db.prepare('SELECT * FROM messages WHERE receiver_id = ? OR receiver_id IS NULL ORDER BY created_at DESC').all(req.params.userId);
    res.json(messages);
  });

  app.post('/api/messages', (req, res) => {
    const { senderId, receiverId, type, content, scheduledFor } = req.body;
    try {
      const info = db.prepare('INSERT INTO messages (sender_id, receiver_id, type, content, scheduled_for) VALUES (?, ?, ?, ?, ?)').run(senderId, receiverId || null, type, content, scheduledFor || null);
      res.json({ id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Announcements
  app.get('/api/announcements', (req, res) => {
    const announcements = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
    res.json(announcements);
  });

  app.post('/api/announcements', (req, res) => {
    const { title, content } = req.body;
    try {
      const info = db.prepare('INSERT INTO announcements (title, content) VALUES (?, ?)').run(title, content);
      res.json({ id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Daily Verses
  app.get('/api/daily-verse', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    let verse = db.prepare('SELECT * FROM daily_verses WHERE date = ?').get(today);
    
    if (!verse) {
      // Fallback to a random verse if none set for today
      verse = db.prepare('SELECT * FROM daily_verses ORDER BY RANDOM() LIMIT 1').get();
    }
    res.json(verse || { verse: "I can do all things through Christ which strengtheneth me.", reference: "Philippians 4:13" });
  });

  // Donations
  app.post('/api/donations', (req, res) => {
    const { userId, name, email, amount, category } = req.body;
    try {
      const info = db.prepare('INSERT INTO donations (user_id, name, email, amount, category) VALUES (?, ?, ?, ?, ?)').run(userId || null, name, email, amount, category);
      res.json({ id: info.lastInsertRowid, status: 'completed' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
