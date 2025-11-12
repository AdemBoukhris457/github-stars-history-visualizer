const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const net = require('net');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

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

// Generate chart image from timeline data
async function generateChartImage(timelineData, width = 800, height = 400) {
  try {
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'white' });

    // Prepare data
    const allDates = new Set();
    timelineData.forEach(data => {
      if (data.timeline) {
        data.timeline.forEach(point => allDates.add(point.date));
      }
    });

    const sortedDates = Array.from(allDates).sort();
    const datasets = [];
    const colors = [
      '#2563eb', '#dc2626', '#16a34a', '#ca8a04',
      '#9333ea', '#ea580c', '#0891b2', '#be185d'
    ];

    timelineData.forEach((data, index) => {
      if (!data.timeline) return;

      const timelineMap = {};
      data.timeline.forEach(point => {
        timelineMap[point.date] = point.stars;
      });

      const starsData = sortedDates.map(date => {
        let lastCount = 0;
        for (let i = 0; i < sortedDates.length; i++) {
          if (sortedDates[i] > date) break;
          lastCount = timelineMap[sortedDates[i]] || lastCount;
        }
        return lastCount;
      });

      const color = colors[index % colors.length];
      datasets.push({
        label: `${data.owner}/${data.repo}`,
        data: starsData,
        borderColor: color,
        backgroundColor: color + '15',
        borderWidth: 2.5,
        fill: false,
        tension: 0.1,
        pointRadius: 3
      });
    });

    const configuration = {
      type: 'line',
      data: {
        labels: sortedDates,
        datasets: datasets
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'GitHub Stars Over Time',
            font: { size: 18, weight: '600' },
            color: '#1f2937'
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: { size: 12 },
              color: '#374151'
            }
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              font: { size: 10 },
              color: '#6b7280',
              maxRotation: 45
            },
            title: {
              display: true,
              text: 'Date',
              font: { size: 12, weight: '600' },
              color: '#374151'
            }
          },
          y: {
            display: true,
            grid: {
              display: true,
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              font: { size: 10 },
              color: '#6b7280',
              callback: function(value) {
                return value.toLocaleString();
              }
            },
            title: {
              display: true,
              text: 'Number of Stars',
              font: { size: 12, weight: '600' },
              color: '#374151'
            },
            beginAtZero: true
          }
        }
      }
    };

    const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    return imageBuffer;
  } catch (error) {
    console.error('Error generating chart image:', error);
    throw error;
  }
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

// API endpoint to serve chart image (for markdown - auto-updates)
app.get('/api/chart-image', async (req, res) => {
  try {
    const { repos } = req.query;
    if (!repos) {
      return res.status(400).json({ error: 'Repos parameter is required' });
    }

    // Parse repositories (can be single repo or comma-separated)
    const repoList = repos.split(',').map(repo => repo.trim());
    const repositories = repoList.map(repo => {
      const [owner, repoName] = repo.split('/');
      return { owner: owner.trim(), repo: repoName.trim() };
    });

    // Fetch or load data for all repositories
    const timelineData = [];
    for (const repo of repositories) {
      if (!repo.owner || !repo.repo) continue;

      try {
        // Try cache first (with 1 hour expiry for auto-updates)
        const cached = await loadCache(repo.owner, repo.repo);
        const cacheAge = cached ? (Date.now() - new Date(cached.lastUpdated).getTime()) : Infinity;
        const cacheExpiry = 60 * 60 * 1000; // 1 hour

        if (cached && cached.timeline && cached.timeline.length > 0 && cacheAge < cacheExpiry) {
          timelineData.push({
            owner: repo.owner,
            repo: repo.repo,
            timeline: cached.timeline
          });
        } else {
          // Fetch fresh data if cache is old or missing
          console.log(`Fetching fresh data for ${repo.owner}/${repo.repo}...`);
          const stargazers = await fetchStargazers(repo.owner, repo.repo);
          const timeline = buildStarsHistory(stargazers);

          const result = {
            owner: repo.owner,
            repo: repo.repo,
            timeline,
            totalStars: stargazers.length,
            lastUpdated: new Date().toISOString()
          };

          await saveCache(repo.owner, repo.repo, result);
          timelineData.push({
            owner: repo.owner,
            repo: repo.repo,
            timeline: timeline
          });

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error fetching ${repo.owner}/${repo.repo}:`, error.message);
        // Continue with other repos even if one fails
      }
    }

    if (timelineData.length === 0) {
      return res.status(404).json({ error: 'No valid repository data found' });
    }

    // Generate chart image
    const imageBuffer = await generateChartImage(timelineData);

    // Set headers for image
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(imageBuffer);
  } catch (error) {
    console.error('Error generating chart image:', error);
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

