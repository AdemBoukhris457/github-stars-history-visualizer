const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const net = require('net');

const app = express();

// Function to find an available port
function findAvailablePort(startPort = 3000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try next port
        findAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Data directory for caching
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// Get cache file path for a repository
function getCachePath(owner, repo) {
  const safeName = `${owner}_${repo}`.replace(/[^a-zA-Z0-9_]/g, '_');
  return path.join(DATA_DIR, `${safeName}.json`);
}

// Load cached data
async function loadCache(owner, repo) {
  try {
    const cachePath = getCachePath(owner, repo);
    const data = await fs.readFile(cachePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// Save data to cache
async function saveCache(owner, repo, data) {
  try {
    const cachePath = getCachePath(owner, repo);
    await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

// Fetch all stargazers from GitHub API
async function fetchStargazers(owner, repo) {
  const stargazers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/stargazers`,
        {
          params: {
            page: page,
            per_page: 100
          },
          headers: {
            'Accept': 'application/vnd.github.v3.star+json'
          }
        }
      );

      if (response.data.length === 0) {
        hasMore = false;
      } else {
        stargazers.push(...response.data);
        page++;
        
        // Rate limit protection: if we get close to limit, slow down
        if (page % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Repository not found');
      } else if (error.response?.status === 403) {
        throw new Error('Rate limit exceeded. Please wait before trying again.');
      } else {
        throw new Error(`Error fetching data: ${error.message}`);
      }
    }
  }

  return stargazers;
}

// Build stars history timeline
function buildStarsHistory(stargazers) {
  if (!stargazers || stargazers.length === 0) {
    return [];
  }

  // Sort by starred_at date
  const sorted = stargazers
    .map(s => ({
      date: new Date(s.starred_at).toISOString().split('T')[0],
      timestamp: new Date(s.starred_at).getTime()
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Group by date and count
  const dailyCounts = {};
  sorted.forEach(item => {
    dailyCounts[item.date] = (dailyCounts[item.date] || 0) + 1;
  });

  // Build cumulative timeline
  const timeline = [];
  let cumulative = 0;
  const dates = Object.keys(dailyCounts).sort();

  dates.forEach(date => {
    cumulative += dailyCounts[date];
    timeline.push({
      date: date,
      stars: cumulative,
      newStars: dailyCounts[date]
    });
  });

  return timeline;
}

// API endpoint to get stars history
app.post('/api/stars-history', async (req, res) => {
  try {
    const { owner, repo, forceRefresh } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({ error: 'Owner and repo are required' });
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await loadCache(owner, repo);
      if (cached && cached.timeline && cached.timeline.length > 0) {
        return res.json({
          owner,
          repo,
          timeline: cached.timeline,
          totalStars: cached.totalStars,
          cached: true,
          lastUpdated: cached.lastUpdated
        });
      }
    }

    // Fetch fresh data
    console.log(`Fetching stargazers for ${owner}/${repo}...`);
    const stargazers = await fetchStargazers(owner, repo);
    const timeline = buildStarsHistory(stargazers);

    const result = {
      owner,
      repo,
      timeline,
      totalStars: stargazers.length,
      cached: false,
      lastUpdated: new Date().toISOString()
    };

    // Save to cache
    await saveCache(owner, repo, result);

    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to serve chart image (for markdown badges)
app.get('/api/chart-image', async (req, res) => {
  try {
    const { repos } = req.query;
    if (!repos) {
      return res.status(400).json({ error: 'Repos parameter is required' });
    }

    // For now, return a simple redirect or placeholder
    // In the future, this could generate and return an actual chart image
    // For markdown compatibility, redirect to a badge or the app
    res.redirect(`https://img.shields.io/badge/Star_History-View_Chart-blue?style=flat-square`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get multiple repositories
app.post('/api/multiple-stars-history', async (req, res) => {
  try {
    const { repositories, forceRefresh } = req.body;

    if (!repositories || !Array.isArray(repositories)) {
      return res.status(400).json({ error: 'Repositories array is required' });
    }

    const results = [];

    for (const repo of repositories) {
      const { owner, repo: repoName } = repo;
      
      if (!owner || !repoName) {
        continue;
      }

      try {
        // Check cache first
        if (!forceRefresh) {
          const cached = await loadCache(owner, repoName);
          if (cached && cached.timeline && cached.timeline.length > 0) {
            results.push({
              owner,
              repo: repoName,
              timeline: cached.timeline,
              totalStars: cached.totalStars,
              cached: true,
              lastUpdated: cached.lastUpdated
            });
            continue;
          }
        }

        // Fetch fresh data
        console.log(`Fetching stargazers for ${owner}/${repoName}...`);
        const stargazers = await fetchStargazers(owner, repoName);
        const timeline = buildStarsHistory(stargazers);

        const result = {
          owner,
          repo: repoName,
          timeline,
          totalStars: stargazers.length,
          cached: false,
          lastUpdated: new Date().toISOString()
        };

        await saveCache(owner, repoName, result);
        results.push(result);

        // Small delay between requests to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching ${owner}/${repoName}:`, error.message);
        results.push({
          owner,
          repo: repoName,
          error: error.message
        });
      }
    }

    res.json({ repositories: results });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize data directory for Vercel (runs when module loads)
(async () => {
  try {
    await ensureDataDir();
  } catch (error) {
    console.error('Error initializing data directory:', error);
  }
})();

// Export for Vercel serverless functions
module.exports = app;

// Start server locally (only if not in Vercel environment)
if (require.main === module) {
  async function startServer() {
    await ensureDataDir();
    
    // Use environment variable if set, otherwise find available port
    const port = process.env.PORT ? parseInt(process.env.PORT) : await findAvailablePort(3000);
    
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      console.log('Note: Without authentication, rate limit is 60 requests/hour');
    });
  }
  
  startServer();
}

