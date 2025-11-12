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

// Generate SVG chart from timeline data (no native dependencies needed)
function generateChartSVG(timelineData, width = 800, height = 400) {
  // Prepare data
  const allDates = new Set();
  timelineData.forEach(data => {
    if (data.timeline) {
      data.timeline.forEach(point => allDates.add(point.date));
    }
  });

  const sortedDates = Array.from(allDates).sort();
  const colors = [
    '#2563eb', '#dc2626', '#16a34a', '#ca8a04',
    '#9333ea', '#ea580c', '#0891b2', '#be185d'
  ];

  // Calculate chart dimensions
  const padding = { top: 60, right: 40, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Process data for each repository
  const datasets = [];
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

    datasets.push({
      label: `${data.owner}/${data.repo}`,
      data: starsData,
      color: colors[index % colors.length]
    });
  });

  // Find min/max values for scaling
  const allValues = datasets.flatMap(d => d.data);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;

  // Generate SVG path for each dataset
  const paths = datasets.map((dataset, index) => {
    const points = dataset.data.map((value, i) => {
      const x = padding.left + (i / (sortedDates.length - 1 || 1)) * chartWidth;
      const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      return `${x},${y}`;
    }).join(' L');

    return `<polyline
      points="M ${points}"
      fill="none"
      stroke="${dataset.color}"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />`;
  }).join('\n    ');

  // Generate grid lines
  const gridLines = [];
  // Horizontal grid lines
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (i / 5) * chartHeight;
    const value = maxValue - (i / 5) * valueRange;
    gridLines.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e5e7eb" stroke-width="1"/>`);
    gridLines.push(`<text x="${padding.left - 10}" y="${y + 5}" text-anchor="end" font-size="12" fill="#6b7280">${Math.round(value).toLocaleString()}</text>`);
  }

  // Vertical grid lines (show fewer dates)
  const dateStep = Math.max(1, Math.floor(sortedDates.length / 8));
  for (let i = 0; i < sortedDates.length; i += dateStep) {
    const x = padding.left + (i / (sortedDates.length - 1 || 1)) * chartWidth;
    const date = sortedDates[i];
    const dateLabel = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    gridLines.push(`<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="#e5e7eb" stroke-width="1"/>`);
    gridLines.push(`<text x="${x}" y="${height - padding.bottom + 20}" text-anchor="middle" font-size="10" fill="#6b7280" transform="rotate(-45 ${x} ${height - padding.bottom + 20})">${dateLabel}</text>`);
  }

  // Generate legend
  const legendItems = datasets.map((dataset, index) => {
    const x = width - padding.right - 200 + (index % 2) * 100;
    const y = 30 + Math.floor(index / 2) * 25;
    return `<circle cx="${x}" cy="${y}" r="5" fill="${dataset.color}"/>
      <text x="${x + 15}" y="${y + 5}" font-size="12" fill="#374151">${dataset.label}</text>`;
  }).join('\n    ');

  // Build SVG
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="white"/>
  <text x="${width / 2}" y="30" text-anchor="middle" font-size="18" font-weight="600" fill="#1f2937">GitHub Stars Over Time</text>
  ${gridLines.join('\n    ')}
  ${paths}
  <g id="legend">
    ${legendItems}
  </g>
</svg>`;

  return svg;
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

    // Generate chart SVG (no native dependencies needed)
    const svg = generateChartSVG(timelineData);

    // Set headers for SVG image
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(svg);
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

