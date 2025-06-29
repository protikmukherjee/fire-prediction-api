// server.js
const express = require('express');
const { spawn } = require('child_process');

const app = express();
app.use(express.json());

// Use the PORT env var (Render) or 3000 locally
const PORT = process.env.PORT || 3000;

app.post('/predict', (req, res) => {
  console.log('→ [POST /predict] received, payload keys:', Object.keys(req.body));

  let output = '';
  const py = spawn('python3', ['fire_api.py']);

  // Write JSON payload to Python's stdin
  py.stdin.write(JSON.stringify(req.body));
  py.stdin.end();

  // Accumulate stdout
  py.stdout.on('data', chunk => {
    output += chunk.toString();
  });

  // Log any Python stderr
  py.stderr.on('data', chunk => {
    console.error('↳ [fire_api.py stderr]', chunk.toString());
  });

  py.on('close', code => {
    console.log(`← [fire_api.py] exited with code=${code}, stdout length=${output.length}`);
    if (code !== 0) {
      return res
        .status(500)
        .json({ error: `fire_api.py exited ${code}`, raw: output });
    }
    try {
      const json = JSON.parse(output);
      console.log('✔ [fire_api.py] returned valid JSON');
      return res.json(json);
    } catch (parseErr) {
      console.error('✖ JSON parse error from fire_api.py:', parseErr);
      return res
        .status(500)
        .json({ error: 'Invalid JSON from fire_api.py', details: parseErr.message, raw: output });
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
