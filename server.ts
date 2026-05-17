import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import multer from 'multer';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { fileURLToPath } from 'url';

console.log('[RAKSHAK] Bootstrapping server...');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the server can find 'uploads' relative to its execution path
const rootDir = process.cwd();
const uploadsDir = path.join(rootDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

console.log(`[RAKSHAK] Storage initialization: ${uploadsDir}`);

let db: any;
try {
  console.log('[RAKSHAK] Connecting to database...');
  db = new Database('rakshak.db');
  db.pragma('foreign_keys = ON');
  console.log('[RAKSHAK] Database connected');
} catch (e) {
  console.error('[RAKSHAK] DATABASE INITIALIZATION FAILED:', e);
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || 'rakshak-super-secret-123';
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'rakshak-crypto-key-safe-secure-32'; // Must be 32 chars

// Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    filename TEXT,
    original_name TEXT,
    mimetype TEXT,
    size INTEGER,
    encryption_key TEXT,
    iv TEXT,
    share_id TEXT UNIQUE,
    created_at TEXT,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS access_requests (
    id TEXT PRIMARY KEY,
    file_id TEXT,
    share_id TEXT,
    requester_email TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, denied
    browser_info TEXT,
    device_info TEXT,
    first_viewed_at TEXT,
    created_at TEXT,
    processed_at TEXT,
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    file_id TEXT,
    is_used INTEGER DEFAULT 0,
    used_by_request_id TEXT,
    created_at TEXT,
    FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
  );
`);

// Migration: Ensure database columns exist
const tableInfo = db.prepare("PRAGMA table_info(access_requests)").all();
const columns = tableInfo.map((col: any) => col.name);

if (!columns.includes('first_viewed_at')) {
  db.exec("ALTER TABLE access_requests ADD COLUMN first_viewed_at DATETIME");
}
if (!columns.includes('share_id')) {
  db.exec("ALTER TABLE access_requests ADD COLUMN share_id TEXT");
}

const app = express();
app.use(express.json());

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, tokenData: any) => {
    if (err) return res.sendStatus(403);
    
    // Safety check: ensure user still exists in DB (prevents FK failures if DB was reset)
    const user: any = db.prepare('SELECT id, email FROM users WHERE id = ?').get(tokenData.id);
    if (!user) {
      console.log(`[RAKSHAK] Auth failed: User ${tokenData.id} no longer exists in DB`);
      return res.sendStatus(401);
    }
    
    req.user = user;
    next();
  });
};

// Encryption Helpers
const encryptFile = (buffer: Buffer, key: Buffer, iv: Buffer) => {
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
};

const decryptFile = (encryptedData: Buffer, key: Buffer) => {
  const iv = encryptedData.subarray(0, 12);
  const tag = encryptedData.subarray(12, 28);
  const data = encryptedData.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
};

// --- AUTH ROUTES ---
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  const id = nanoid();
  const hashedPassword = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  try {
    db.prepare('INSERT INTO users (id, email, password, created_at) VALUES (?, ?, ?, ?)').run(id, email, hashedPassword, now);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'User already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email } });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// --- FILE ROUTES ---
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/files/upload', authenticateToken, upload.single('file'), (req: any, res) => {
  const file = req.file;
  if (!file) {
    console.log('[RAKSHAK] Upload failed: No file in request');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log(`[RAKSHAK] Processing upload: ${file.originalname} (${file.size} bytes) for user ${req.user.id}`);

  try {
    const fileId = nanoid();
    const iv = crypto.randomBytes(12);
    // Use a 32-byte key directly instead of hex-encoded 64-char string
    const rawKey = crypto.randomBytes(32);
    const encryptionKeyHex = rawKey.toString('hex');
    
    console.log(`[RAKSHAK] Encrypting with fileId: ${fileId}`);
    const encryptedBuffer = encryptFile(file.buffer, rawKey, iv);
    
    const internalFilename = `${fileId}.enc`;
    const filePath = path.join(uploadsDir, internalFilename);
    fs.writeFileSync(filePath, encryptedBuffer);
    console.log(`[RAKSHAK] Encrypted file written to disk: ${filePath}`);

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO files (id, owner_id, filename, original_name, mimetype, size, encryption_key, iv, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fileId, req.user.id, internalFilename, file.originalname, file.mimetype, file.size, encryptionKeyHex, iv.toString('hex'), now);

    console.log(`[RAKSHAK] Upload success: DB record created for ${fileId}`);
    res.json({ success: true, fileId });
  } catch (err: any) {
    console.error(`[RAKSHAK] UPLOAD FATAL ERROR:`, err);
    res.status(500).json({ error: `Upload failed: ${err.message}` });
  }
});

app.post('/api/files/:id/share', authenticateToken, (req: any, res) => {
  const file: any = db.prepare('SELECT id FROM files WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!file) return res.status(404).json({ error: 'File not found' });

  const shareId = nanoid(12);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO shares (id, file_id, created_at) VALUES (?, ?, ?)').run(shareId, file.id, now);
  
  res.json({ shareId });
});

app.get('/api/files', authenticateToken, (req: any, res) => {
  const files = db.prepare(`
    SELECT f.*, 
    (SELECT count(*) FROM access_requests WHERE file_id = f.id AND status = 'pending') as pending_requests
    FROM files f WHERE owner_id = ? 
    ORDER BY created_at DESC
  `).all(req.user.id);
  res.json(files);
});

app.delete('/api/files/:id', authenticateToken, (req: any, res) => {
  console.log(`[RAKSHAK] DELETE FILE ATTEMPT: ${req.params.id} by user ${req.user.id}`);
  const file: any = db.prepare('SELECT * FROM files WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!file) {
    console.log(`[RAKSHAK] DELETE FILE FAILED: File not found or not owned by user`);
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const filePath = path.join(uploadsDir, file.filename);
    
    // Use an explicit transaction more safely
    const performDeletion = db.transaction(() => {
      db.prepare('DELETE FROM access_requests WHERE file_id = ?').run(file.id);
      db.prepare('DELETE FROM shares WHERE file_id = ?').run(file.id);
      db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
    });

    performDeletion();
    console.log(`[RAKSHAK] DB record removed: ${file.id}`);

    // Delete physical file AFTER successful DB removal
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[RAKSHAK] Physical file shredded: ${file.filename}`);
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error(`[RAKSHAK] DELETE FILE FATAL ERROR:`, e);
    res.status(500).json({ error: `Secure shredding sequence failed: ${e.message}` });
  }
});

// --- PUBLIC SHARE ACCESS ---
app.get('/api/share/:shareId', (req, res) => {
  const share: any = db.prepare('SELECT * FROM shares WHERE id = ?').get(req.params.shareId);
  if (!share) return res.status(404).json({ error: 'Secure link invalid or expired' });
  
  const requestId = req.query.requestId as string;
  
  if (share.is_used) {
    console.log(`[RAKSHAK SERVER] SHARE ${req.params.shareId} ALREADY USED BY ${share.used_by_request_id}. INCOMING REQ: ${requestId}`);
    // Only allow access if the request ID matches the consumer of this link
    if (!requestId || share.used_by_request_id !== requestId) {
      return res.status(410).json({ error: 'This secure link was consumed by another device. Access is restricted to one terminal only.' });
    }

    // Check if the session is still active (under 15 mins)
    const request: any = db.prepare('SELECT first_viewed_at FROM access_requests WHERE id = ?').get(requestId);
    if (request?.first_viewed_at) {
      const elapsed = Date.now() - new Date(request.first_viewed_at).getTime();
      if (elapsed > 900000) { // 15 mins
        return res.status(410).json({ error: 'Secure session expired' });
      }
    }
  }

  const file: any = db.prepare('SELECT id, original_name, mimetype, size FROM files WHERE id = ?').get(share.file_id);
  if (!file) return res.status(404).json({ error: 'Data node not found' });
  
  res.json({ ...file, shareId: share.id });
});

app.post('/api/share/:shareId/request', (req, res) => {
  const { email, browser, device } = req.body;
  const userAgent = req.headers['user-agent'] || '';
  
  // Basic bot/crawler detection
  const isBot = /googlebot|bingbot|yandex|baiduspider|twitterbot/i.test(userAgent);
  if (isBot) {
    return res.status(403).json({ error: 'Automated crawlers are restricted' });
  }

  const share: any = db.prepare('SELECT * FROM shares WHERE id = ?').get(req.params.shareId);
  if (!share) return res.status(404).json({ error: 'Secure link invalid' });
  if (share.is_used || share.used_by_request_id) {
    return res.status(410).json({ error: 'This secure link is already locked to another device or has been consumed.' });
  }

  const requestId = nanoid();
  const now = new Date().toISOString();
  
  try {
    // Transaction: Create request and lock share simultaneously
    const createRequest = db.transaction(() => {
      console.log(`[RAKSHAK] DB: Creating access request ${requestId} for file ${share.file_id}...`);
      db.prepare(`
        INSERT INTO access_requests (id, file_id, share_id, requester_email, browser_info, device_info, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(requestId, share.file_id, share.id, email, browser, device, now);
      
      console.log(`[RAKSHAK] DB: Locking share ${share.id} to request ${requestId}...`);
      db.prepare('UPDATE shares SET used_by_request_id = ? WHERE id = ?').run(requestId, share.id);
    });
    
    createRequest();
    res.json({ success: true, requestId });
  } catch (err: any) {
    console.error(`[RAKSHAK] SECURE HANDSHAKE FAILED:`, err);
    res.status(500).json({ error: `Failed to initialize secure handshake: ${err.message}` });
  }
});

app.get('/api/share/:shareId/status/:requestId', (req, res) => {
  const share: any = db.prepare('SELECT is_used, used_by_request_id FROM shares WHERE id = ?').get(req.params.shareId);
  const request: any = db.prepare('SELECT status, first_viewed_at FROM access_requests WHERE id = ? AND share_id = ?').get(req.params.requestId, req.params.shareId);
  
  if (!request) return res.status(404).json({ error: 'Request not found' });
  
  console.log(`[RAKSHAK SERVER] STATUS CHECK: Share ${req.params.shareId} | Req ${req.params.requestId} | Status ${request.status} | Used ${share?.is_used}`);

  // If approved and viewed (used), keep it approved if it's the same request within the active window
  if (share?.is_used === 1) {
    if (share.used_by_request_id === req.params.requestId) {
      if (request.first_viewed_at) {
        const elapsed = Date.now() - new Date(request.first_viewed_at).getTime();
        if (elapsed > 300000) {
          return res.json({ status: 'denied', reason: 'expired' });
        }
      }
      // Still approved for this specific session, even if first_viewed_at isn't set yet (viewing in progress)
      return res.json(request);
    }
    // Used by somebody else or already long expired
    return res.json({ status: 'denied', reason: 'expired' });
  }
  
  res.json(request);
});

app.get('/api/share/:shareId/view/:requestId', (req, res) => {
  const share: any = db.prepare('SELECT * FROM shares WHERE id = ?').get(req.params.shareId);
  
  if (!share) {
    return res.status(403).json({ error: 'Secure Link Not Found' });
  }

  const file: any = db.prepare('SELECT * FROM files WHERE id = ?').get(share.file_id);
  const request: any = db.prepare('SELECT status, first_viewed_at FROM access_requests WHERE id = ? AND share_id = ?').get(req.params.requestId, req.params.shareId);

  console.log(`[RAKSHAK SERVER] VIEW REQUEST: ${req.params.shareId} | REQ: ${req.params.requestId} | STATUS: ${request?.status}`);

  if (!request || request.status !== 'approved') {
    console.log(`[RAKSHAK SERVER] VIEW UNAUTHORIZED: Request ${req.params.requestId} is ${request?.status}`);
    return res.status(403).json({ error: 'Access Unauthorized: Wait for owner signoff' });
  }

  // Double check that this share belongs to this request
  if (share.used_by_request_id !== req.params.requestId) {
    console.log(`[RAKSHAK SERVER] VIEW UNAUTHORIZED: Share ID mismatch. Expected ${share.used_by_request_id}, got ${req.params.requestId}`);
    return res.status(403).json({ error: 'Unauthorized Session: Request mismatch' });
  }

  // Handle consumption logic
  if (share.is_used === 1) {
    if (request.first_viewed_at) {
      const elapsed = Date.now() - new Date(request.first_viewed_at).getTime();
      if (elapsed > 900000) { // 15 mins
        console.log(`[RAKSHAK SERVER] VIEW DENIED: Session expired for Request ${req.params.requestId}`);
        return res.status(410).json({ error: 'Secure Session Expired (900s limit)' });
      }
      console.log(`[RAKSHAK SERVER] RELOADING VIEW for active session: ${req.params.requestId}`);
    } else {
        // Already marked used but first_viewed_at was null (could happen if polling hit used=1 but view didn't finish)
        db.prepare('UPDATE access_requests SET first_viewed_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.requestId);
    }
  } else {
    // First time view: Mark as used
    const now = new Date().toISOString();
    console.log(`[RAKSHAK SERVER] CONSUMING SHARE for ${req.params.requestId} (FIRST VIEW).`);
    try {
      db.transaction(() => {
        db.prepare('UPDATE access_requests SET first_viewed_at = ? WHERE id = ?').run(now, req.params.requestId);
        db.prepare('UPDATE shares SET is_used = 1 WHERE id = ?').run(share.id);
      })();
    } catch (txErr) {
      console.error(`[RAKSHAK SERVER] CONSUMPTION TRANSACTION FAILED:`, txErr);
      // Continue anyway, it might have been set by a concurrent request
    }
  }

  try {
    const encryptedData = fs.readFileSync(path.join(uploadsDir, file.filename));
    const keyBuffer = Buffer.from(file.encryption_key, 'hex');
    const decryptedData = decryptFile(encryptedData, keyBuffer);
    
    console.log(`[RAKSHAK SERVER] SERVING DATA: ${file.original_name} (${file.mimetype}) - ${decryptedData.length} bytes`);

    // Use res.send for standard memory-buffered serving which handles headers better
    res.setHeader('Content-Type', file.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(decryptedData);
  } catch (err) {
    console.error(`[RAKSHAK SERVER] SERVE ERROR:`, err);
    res.status(500).json({ error: 'Decryption failed' });
  }
});


// --- OWNER DASHBOARD ROUTES ---
app.get('/api/requests', authenticateToken, (req: any, res) => {
  const requests = db.prepare(`
    SELECT r.*, f.original_name as file_name 
    FROM access_requests r
    JOIN files f ON r.file_id = f.id
    WHERE f.owner_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user.id);
  res.json(requests);
});

app.delete('/api/requests/:id', authenticateToken, (req: any, res) => {
    const request: any = db.prepare(`
      SELECT r.id FROM access_requests r
      JOIN files f ON r.file_id = f.id
      WHERE r.id = ? AND f.owner_id = ?
    `).get(req.params.id, req.user.id);
  
    if (!request) return res.status(404).json({ error: 'Request not found' });
  
    db.prepare('DELETE FROM access_requests WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.post('/api/requests/:requestId/respond', authenticateToken, (req: any, res) => {
  const { status } = req.body; // approved or denied
  console.log(`[RAKSHAK] RESPOND TO REQUEST: ${req.params.requestId} with ${status} by user ${req.user.id}`);
  
  try {
    const request: any = db.prepare(`
      SELECT r.* FROM access_requests r
      JOIN files f ON r.file_id = f.id
      WHERE r.id = ? AND f.owner_id = ?
    `).get(req.params.requestId, req.user.id);

    if (!request) {
      console.log(`[RAKSHAK] RESPOND FAILED: Request not found or not owned by user`);
      return res.status(404).json({ error: 'Request not found' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE access_requests SET status = ?, processed_at = ? WHERE id = ?')
      .run(status, now, req.params.requestId);

    console.log(`[RAKSHAK] RESPOND SUCCESS: Request ${req.params.requestId} set to ${status}`);
    res.json({ success: true });
  } catch (e: any) {
    console.error(`[RAKSHAK] RESPOND ERROR:`, e);
    res.status(500).json({ error: `Database error: ${e.message}` });
  }
});

// --- ASSET SERVING ---
async function startServer() {
  const PORT = 3000;

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'rakshak' });
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log('[RAKSHAK] Starting VITE development server...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const template = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        res.status(404).send('API route not found');
      } else {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RAKSHAK] SUCCESS: Server running at http://0.0.0.0:${PORT}`);
  });
}

console.log('[RAKSHAK] Invoking startServer()...');
startServer().catch(err => {
  console.error('[RAKSHAK] FATAL: startServer() failed during execution:', err);
  process.exit(1);
});
