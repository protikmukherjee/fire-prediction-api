// server.js
const express    = require('express');
const bodyParser = require('body-parser');
const { spawn }  = require('child_process');

const app = express();
app.use(bodyParser.json());

// POST /predict → runs fire_api.py on stdin JSON, returns its JSON stdout
app.post('/predict', (req, res) => {
  let output = '';
  const py = spawn('python3', ['fire_api.py']);

  // send the incoming JSON into the Python script
  py.stdin.write(JSON.stringify(req.body));
  py.stdin.end();

  // collect stdout
  py.stdout.on('data', chunk => output += chunk);

  // in case of Python errors
  py.stderr.on('data', chunk => console.error('[fire_api.py stderr]', chunk.toString()));

  py.on('close', code => {
    if (code !== 0) {
      return res
        .status(500)
        .json({ error: `fire_api.py exited ${code}`, raw: output });
    }
    try {
      const parsed = JSON.parse(output);
      res.json(parsed);
    } catch (err) {
      res
        .status(500)
        .json({ error: `Invalid JSON from fire_api.py: ${err}`, raw: output });
    }
  });
});

// listen on $PORT (Render sets this) or 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
