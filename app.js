const express = require('express');
const db = require('./db');
const crypto = require('crypto');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Helper
function generateSecretToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ========== ACCOUNTS CRUD ========== //
app.post('/accounts', (req, res) => {
  const { email, name, website } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'email & name required' });

  const account_id = crypto.randomUUID();
  const secret_token = generateSecretToken();

  try {
    db.prepare(`INSERT INTO accounts (email, account_id, name, website, secret_token) VALUES (?, ?, ?, ?, ?)`)
      .run(email, account_id, name, website || null, secret_token);

    res.json({ email, account_id, name, website, secret_token });
  } catch (err) {
    res.status(400).json({ error: 'Email or Account already exists' });
  }
});

app.get('/accounts/:account_id', (req, res) => {
  const account = db.prepare(`SELECT * FROM accounts WHERE account_id = ?`).get(req.params.account_id);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account);
});

app.put('/accounts/:account_id', (req, res) => {
  const { name, website } = req.body;
  db.prepare(`UPDATE accounts SET name = ?, website = ? WHERE account_id = ?`)
    .run(name, website, req.params.account_id);
  res.json({ message: 'Updated' });
});

app.delete('/accounts/:account_id', (req, res) => {
  db.prepare(`DELETE FROM accounts WHERE account_id = ?`).run(req.params.account_id);
  db.prepare(`DELETE FROM destinations WHERE account_id = ?`).run(req.params.account_id);
  res.json({ message: 'Deleted' });
});

app.post('/destinations', (req, res) => {
  const { account_id, url, method, headers } = req.body;
  if (!account_id || !url || !method || !headers) return res.status(400).json({ error: 'Missing fields' });

  try {
    const strHeaders = JSON.stringify(headers);
    db.prepare(`INSERT INTO destinations (account_id, url, method, headers) VALUES (?, ?, ?, ?)`)
      .run(account_id, url, method.toUpperCase(), strHeaders);
    res.json({ message: 'Destination added' });
  } catch (err) {
    res.status(400).json({ error: 'Invalid account or data' });
  }
});

app.get('/destinations/:account_id', (req, res) => {
  const destinations = db.prepare(`SELECT * FROM destinations WHERE account_id = ?`).all(req.params.account_id);
  res.json(destinations);
});

app.put('/destinations/:id', (req, res) => {
  const { url, method, headers } = req.body;
  const strHeaders = JSON.stringify(headers);
  db.prepare(`UPDATE destinations SET url = ?, method = ?, headers = ? WHERE id = ?`)
    .run(url, method.toUpperCase(), strHeaders, req.params.id);
  res.json({ message: 'Destination updated' });
});

app.delete('/destinations/:id', (req, res) => {
  db.prepare(`DELETE FROM destinations WHERE id = ?`).run(req.params.id);
  res.json({ message: 'Destination deleted' });
});

app.post('/server/incoming_data', async (req, res) => {
  const token = req.headers['cl-x-token'];
  if (!token) return res.status(401).json({ error: 'Un Authenticate' });

  const account = db.prepare(`SELECT * FROM accounts WHERE secret_token = ?`).get(token);
  if (!account) return res.status(401).json({ error: 'Un Authenticate' });

  const destinations = db.prepare(`SELECT * FROM destinations WHERE account_id = ?`).all(account.account_id);
  const data = req.body;

  for (let dest of destinations) {
    const headers = JSON.parse(dest.headers);
    try {
      if (dest.method === 'GET') {
        await axios.get(dest.url, {
          headers,
          params: data,
        });
      } else if (['POST', 'PUT'].includes(dest.method)) {
        await axios({
          method: dest.method.toLowerCase(),
          url: dest.url,
          headers,
          data,
        });
      }
    } catch (err) {
      console.log(`Error sending to destination ${dest.url}:`, err.message);
    }
  }

  res.json({ status: 'Data pushed to destinations' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
