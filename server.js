const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const net = require('net');
const sharp = require('sharp');

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
async function fetchStargazers(owner, repo, accessToken = null) {
  const stargazers = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const headers = {
        'Accept': 'application/vnd.github.v3.star+json'
      };
      
      // Add authorization header if access token is provided
      if (accessToken) {
        headers['Authorization'] = `token ${accessToken}`;
      }

      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/stargazers`,
        {
          params: {
            page: page,
            per_page: 100
          },
          headers: headers
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

// Generate error SVG image
function generateErrorSVG(message, width = 800, height = 400) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#fef2f2"/>
  <text x="${width / 2}" y="${height / 2 - 20}" text-anchor="middle" font-size="18" font-weight="600" fill="#dc2626">Error Loading Chart</text>
  <text x="${width / 2}" y="${height / 2 + 20}" text-anchor="middle" font-size="14" fill="#991b1b">${message}</text>
</svg>`;
  return svg;
}

// Helper function to create smooth bezier curve path (catmull-rom spline approximation)
function createSmoothPath(coordinates, tension = 0.1) {
  if (coordinates.length < 2) return '';
  if (coordinates.length === 2) {
    return `M ${coordinates[0].x} ${coordinates[0].y} L ${coordinates[1].x} ${coordinates[1].y}`;
  }

  let path = `M ${coordinates[0].x} ${coordinates[0].y}`;
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const p0 = coordinates[Math.max(0, i - 1)];
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];
    const p3 = coordinates[Math.min(coordinates.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6 * (1 - tension);
    const cp1y = p1.y + (p2.y - p0.y) / 6 * (1 - tension);
    const cp2x = p2.x - (p3.x - p1.x) / 6 * (1 - tension);
    const cp2y = p2.y - (p3.y - p1.y) / 6 * (1 - tension);

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

// Get style configuration
function getStyleConfig(style) {
  const styles = {
    professional: {
      colors: ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#ea580c', '#0891b2', '#be185d'],
      tension: 0.1,
      strokeWidth: 2.5,
      pointRadius: 3,
      pointStroke: 'white',
      pointStrokeWidth: 2,
      fill: false,
      bgGradient: ['#f7fafc', '#edf2f7'],
      bgStroke: 'rgba(226, 232, 240, 0.8)',
      gridColor: 'rgba(0, 0, 0, 0.05)',
      textColor: '#1f2937',
      legendTextColor: '#374151',
      tickColor: '#6b7280',
      title: 'GitHub Stars Over Time',
      titleSize: 20,
      titleWeight: 600,
      showEmoji: false
    },
    aesthetic: {
      colors: [
        { start: '#667eea', end: '#764ba2' },
        { start: '#f093fb', end: '#f5576c' },
        { start: '#4facfe', end: '#00f2fe' },
        { start: '#43e97b', end: '#38f9d7' },
        { start: '#fa709a', end: '#fee140' },
        { start: '#30cfd0', end: '#330867' },
        { start: '#a8edea', end: '#fed6e3' },
        { start: '#ff9a9e', end: '#fecfef' }
      ],
      tension: 0.5,
      strokeWidth: 3,
      pointRadius: 4,
      pointStroke: 'white',
      pointStrokeWidth: 2.5,
      fill: true,
      bgGradient: ['#0f4c75', '#3282b8', '#bbe1fa'],
      bgStroke: 'rgba(255,255,255,0.2)',
      gridColor: 'rgba(255, 255, 255, 0.2)',
      textColor: '#ffffff',
      legendTextColor: '#ffffff',
      tickColor: 'rgba(255, 255, 255, 0.9)',
      title: '⭐ GitHub Stars Over Time',
      titleSize: 24,
      titleWeight: 700,
      showEmoji: true
    },
    dark: {
      colors: ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6'],
      tension: 0.4,
      strokeWidth: 3,
      pointRadius: 4,
      pointStroke: '#1a1a2e',
      pointStrokeWidth: 2,
      fill: true,
      fillOpacity: '30',
      bgGradient: ['#1a1a2e', '#16213e', '#0f3460'],
      bgStroke: 'rgba(255,255,255,0.1)',
      gridColor: 'rgba(255, 255, 255, 0.1)',
      textColor: '#ffffff',
      legendTextColor: '#ffffff',
      tickColor: 'rgba(255, 255, 255, 0.9)',
      title: '⭐ GitHub Stars Over Time',
      titleSize: 22,
      titleWeight: 700,
      showEmoji: true
    },
    minimal: {
      colors: ['#64748b', '#475569', '#334155', '#1e293b', '#0f172a', '#94a3b8', '#cbd5e1', '#e2e8f0'],
      tension: 0,
      strokeWidth: 2,
      pointRadius: 0,
      pointStroke: '#fff',
      pointStrokeWidth: 2,
      fill: false,
      bgGradient: ['#ffffff', '#ffffff'],
      bgStroke: '#e5e7eb',
      gridColor: 'rgba(0, 0, 0, 0.05)',
      textColor: '#1f2937',
      legendTextColor: '#4a5568',
      tickColor: '#6b7280',
      title: 'GitHub Stars Over Time',
      titleSize: 18,
      titleWeight: 600,
      showEmoji: false
    },
    vibrant: {
      colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731', '#ee5a6f', '#00d2d3', '#ff9ff3', '#54a0ff'],
      tension: 0.6,
      strokeWidth: 4,
      pointRadius: 5,
      pointStroke: '#fff',
      pointStrokeWidth: 3,
      fill: true,
      fillOpacity: '40',
      bgGradient: ['#ff6b6b', '#4ecdc4', '#45b7d1'],
      bgStroke: 'rgba(255,255,255,0.3)',
      gridColor: 'rgba(255, 255, 255, 0.2)',
      textColor: '#ffffff',
      legendTextColor: '#ffffff',
      tickColor: 'rgba(255, 255, 255, 0.95)',
      title: '⭐ GitHub Stars Over Time',
      titleSize: 24,
      titleWeight: 800,
      showEmoji: true
    },
    pastel: {
      colors: ['#ffeaa7', '#fab1a0', '#fd79a8', '#fdcb6e', '#e17055', '#74b9ff', '#a29bfe', '#fd79a8'],
      tension: 0.5,
      strokeWidth: 3,
      pointRadius: 4,
      pointStroke: '#fff',
      pointStrokeWidth: 2.5,
      fill: true,
      fillOpacity: '60',
      bgGradient: ['#ffeaa7', '#fab1a0', '#fd79a8'],
      bgStroke: 'rgba(255,255,255,0.5)',
      gridColor: 'rgba(0, 0, 0, 0.05)',
      textColor: '#1f2937',
      legendTextColor: '#4a5568',
      tickColor: '#6b7280',
      title: '⭐ GitHub Stars Over Time',
      titleSize: 22,
      titleWeight: 700,
      showEmoji: true
    },
    neon: {
      colors: ['#8a2be2', '#00ffff', '#ff00ff', '#00ff00', '#ffff00', '#ff1493', '#00bfff', '#ff00ff'],
      tension: 0.5,
      strokeWidth: 4,
      pointRadius: 5,
      pointStroke: '#0a0a0a',
      pointStrokeWidth: 3,
      fill: true,
      fillOpacity: 'CC',
      bgGradient: ['#0a0a0a', '#1a0033', '#330066'],
      bgStroke: 'rgba(138, 43, 226, 0.5)',
      gridColor: 'rgba(138, 43, 226, 0.2)',
      textColor: '#ffffff',
      legendTextColor: '#ffffff',
      tickColor: 'rgba(255, 255, 255, 0.9)',
      title: '⭐ GitHub Stars Over Time',
      titleSize: 24,
      titleWeight: 800,
      showEmoji: true
    },
    corporate: {
      colors: ['#1e40af', '#059669', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#be185d', '#475569'],
      tension: 0.2,
      strokeWidth: 2,
      pointRadius: 3,
      pointStroke: '#fff',
      pointStrokeWidth: 2,
      fill: false,
      bgGradient: ['#f8f9fa', '#e9ecef'],
      bgStroke: '#dee2e6',
      gridColor: 'rgba(0, 0, 0, 0.06)',
      textColor: '#1f2937',
      legendTextColor: '#4a5568',
      tickColor: '#6b7280',
      title: 'GitHub Stars Over Time',
      titleSize: 20,
      titleWeight: 600,
      showEmoji: false
    }
  };
  
  return styles[style] || styles.professional;
}

// Generate SVG chart from timeline data (supports all chart styles)
function generateChartSVG(timelineData, width = 800, height = 400, style = 'professional') {
  // Prepare data
  const allDates = new Set();
  timelineData.forEach(data => {
    if (data.timeline) {
      data.timeline.forEach(point => allDates.add(point.date));
    }
  });

  const sortedDates = Array.from(allDates).sort();
  const styleConfig = getStyleConfig(style);
  
  // Calculate chart dimensions
  const padding = { top: 80, right: 60, bottom: 80, left: 90 };
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

    // Get color based on style
    let color;
    if (style === 'aesthetic' && Array.isArray(styleConfig.colors[0])) {
      // Aesthetic uses gradient, use start color
      color = styleConfig.colors[index % styleConfig.colors.length].start;
    } else {
      color = styleConfig.colors[index % styleConfig.colors.length];
    }

    datasets.push({
      label: `${data.owner}/${data.repo}`,
      data: starsData,
      color: color,
      gradient: style === 'aesthetic' && Array.isArray(styleConfig.colors[0]) 
        ? styleConfig.colors[index % styleConfig.colors.length] 
        : null
    });
  });

  // Find min/max values for scaling
  const allValues = datasets.flatMap(d => d.data);
  const minValue = 0;
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;

  // Generate gradients for aesthetic style
  let gradientDefs = '';
  if (style === 'aesthetic') {
    datasets.forEach((dataset, index) => {
      if (dataset.gradient) {
        const gradId = `gradient-${index}`;
        gradientDefs += `
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:${dataset.gradient.start};stop-opacity:0.5" />
      <stop offset="100%" style="stop-color:${dataset.gradient.end};stop-opacity:0.1" />
    </linearGradient>`;
      }
    });
  }

  // Generate smooth bezier curve paths and points for each dataset
  const chartElements = datasets.map((dataset, index) => {
    // Calculate coordinates for all points
    const coordinates = dataset.data.map((value, i) => {
      const x = padding.left + (i / Math.max(1, sortedDates.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
      return { x, y, value };
    });

    // Create smooth bezier curve path
    const pathData = createSmoothPath(coordinates, styleConfig.tension);

    // Generate fill area if needed
    let fillArea = '';
    if (styleConfig.fill) {
      const fillPath = pathData + ` L ${coordinates[coordinates.length - 1].x} ${padding.top + chartHeight} L ${coordinates[0].x} ${padding.top + chartHeight} Z`;
      if (style === 'aesthetic' && dataset.gradient) {
        fillArea = `<path d="${fillPath}" fill="url(#gradient-${index})" opacity="0.8"/>`;
      } else {
        const fillColor = typeof dataset.color === 'string' ? dataset.color : dataset.color.start;
        const opacity = styleConfig.fillOpacity || '30';
        fillArea = `<path d="${fillPath}" fill="${fillColor}${opacity}" opacity="0.6"/>`;
      }
    }

    // Generate path element with smooth curve
    // For aesthetic style, use gradient start color for stroke (SVG stroke gradients are complex)
    const strokeColor = style === 'aesthetic' && dataset.gradient 
      ? dataset.gradient.start 
      : (typeof dataset.color === 'string' ? dataset.color : dataset.color.start);
    
    const path = `<path
      d="${pathData}"
      fill="none"
      stroke="${strokeColor}"
      stroke-width="${styleConfig.strokeWidth}"
      stroke-linecap="round"
      stroke-linejoin="round"
    />`;

    // Generate data points
    let points = '';
    if (styleConfig.pointRadius > 0) {
    const pointStep = Math.max(1, Math.floor(coordinates.length / 20));
      const pointCoords = coordinates
        .filter((_, i) => i % pointStep === 0 || i === coordinates.length - 1);
      
      points = pointCoords.map(coord => {
        const pointColor = style === 'aesthetic' && dataset.gradient 
          ? dataset.gradient.start 
          : (typeof dataset.color === 'string' ? dataset.color : dataset.color.start);
        return `<circle cx="${coord.x}" cy="${coord.y}" r="${styleConfig.pointRadius}" fill="${pointColor}" stroke="${styleConfig.pointStroke}" stroke-width="${styleConfig.pointStrokeWidth}"/>`;
      }).join('\n      ');
    }

    return (fillArea ? fillArea + '\n      ' : '') + path + (points ? '\n      ' + points : '');
  }).join('\n    ');

  // Generate grid lines
  const gridLines = [];
  const numGridLines = 5;
  for (let i = 0; i <= numGridLines; i++) {
    const y = padding.top + chartHeight - (i / numGridLines) * chartHeight;
    const value = (i / numGridLines) * maxValue;
    gridLines.push(`<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${styleConfig.gridColor}" stroke-width="1"/>`);
    gridLines.push(`<text x="${padding.left - 15}" y="${y + 4}" text-anchor="end" font-size="11" font-family="Arial, Helvetica, sans-serif" fill="${styleConfig.tickColor}">${Math.round(value).toLocaleString()}</text>`);
  }

  // Vertical grid lines (X-axis dates)
  const dateStep = Math.max(1, Math.floor(sortedDates.length / 8));
  for (let i = 0; i < sortedDates.length; i += dateStep) {
    const x = padding.left + (i / (sortedDates.length - 1 || 1)) * chartWidth;
    const date = sortedDates[i];
    const dateLabel = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    gridLines.push(`<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" stroke="${styleConfig.gridColor}" stroke-width="1"/>`);
    gridLines.push(`<text x="${x}" y="${height - padding.bottom + 25}" text-anchor="middle" font-size="11" font-family="Arial, Helvetica, sans-serif" fill="${styleConfig.tickColor}" transform="rotate(-45 ${x} ${height - padding.bottom + 25})">${dateLabel}</text>`);
  }

  // Generate legend
  const legendItems = [];
  datasets.forEach((dataset, index) => {
    const itemsPerRow = Math.min(2, datasets.length);
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;
    const x = width - padding.right - 180 + col * 90;
    const y = 35 + row * 25;
    const legendColor = style === 'aesthetic' && dataset.gradient 
      ? dataset.gradient.start 
      : (typeof dataset.color === 'string' ? dataset.color : dataset.color.start);
    legendItems.push(`<circle cx="${x}" cy="${y}" r="5" fill="${legendColor}"/>
      <text x="${x + 15}" y="${y + 5}" font-size="13" font-weight="500" font-family="Arial, Helvetica, sans-serif" fill="${styleConfig.legendTextColor}">${dataset.label}</text>`);
  });

  // Background gradient
  const bgGradientId = `bgGradient-${style}`;
  const backgroundGradient = `<defs>
    <linearGradient id="${bgGradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${styleConfig.bgGradient[0]};stop-opacity:1" />
      <stop offset="${styleConfig.bgGradient.length === 3 ? '50%' : '100%'}" style="stop-color:${styleConfig.bgGradient[1]};stop-opacity:1" />
      ${styleConfig.bgGradient.length === 3 ? `<stop offset="100%" style="stop-color:${styleConfig.bgGradient[2]};stop-opacity:1" />` : ''}
    </linearGradient>${gradientDefs}
  </defs>`;

  // Build SVG
  const titleText = styleConfig.showEmoji ? styleConfig.title : styleConfig.title.replace('⭐ ', '');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${backgroundGradient}
  <rect width="${width}" height="${height}" fill="url(#${bgGradientId})"/>
  <rect width="${width}" height="${height}" fill="none" stroke="${styleConfig.bgStroke}" stroke-width="1"/>
  
  <!-- Title -->
  <text x="${width / 2}" y="35" text-anchor="middle" font-size="${styleConfig.titleSize}" font-weight="${styleConfig.titleWeight}" font-family="Arial, Helvetica, sans-serif" fill="${styleConfig.textColor}">${titleText}</text>
  
  <!-- Grid lines -->
  ${gridLines.join('\n  ')}
  
  <!-- Chart lines and points -->
  <g id="chart-lines">
    ${chartElements}
  </g>
  
  <!-- Legend -->
  <g id="legend">
    ${legendItems.join('\n    ')}
  </g>
  
  <!-- Axis labels -->
  <text x="${width / 2}" y="${height - 20}" text-anchor="middle" font-size="13" font-weight="600" font-family="Arial, Helvetica, sans-serif" fill="${styleConfig.textColor}">${styleConfig.showEmoji ? '📅 ' : ''}Date</text>
  <text x="20" y="${height / 2}" text-anchor="middle" font-size="13" font-weight="600" font-family="Arial, Helvetica, sans-serif" fill="${styleConfig.textColor}" transform="rotate(-90 20 ${height / 2})">${styleConfig.showEmoji ? '⭐ ' : ''}Number of Stars</text>
</svg>`;

  return svg;
}

// API endpoint to get stars history
app.post('/api/stars-history', async (req, res) => {
  try {
    const { owner, repo, forceRefresh, accessToken } = req.body;

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
    const stargazers = await fetchStargazers(owner, repo, accessToken);
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
    const { repos, style } = req.query;
    const chartStyle = style || 'professional'; // Default to professional if not specified
    if (!repos) {
      // Return error image instead of JSON
      const errorSvg = generateErrorSVG('Repos parameter is required');
      try {
        const pngBuffer = await sharp(Buffer.from(errorSvg))
          .resize(800, 400)
          .png()
          .toBuffer();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(pngBuffer);
      } catch (error) {
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(errorSvg);
      }
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
          // Note: chart-image endpoint doesn't support access tokens for security reasons
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
      // Return error image instead of JSON
      const errorSvg = generateErrorSVG('No valid repository data found');
      try {
        const pngBuffer = await sharp(Buffer.from(errorSvg))
          .resize(800, 400)
          .png()
          .toBuffer();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(pngBuffer);
      } catch (error) {
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.send(errorSvg);
      }
    }

    // Generate chart SVG with the specified style
    const svg = generateChartSVG(timelineData, 800, 400, chartStyle);

    // Convert SVG to PNG for better GitHub markdown compatibility
    // GitHub doesn't always render external SVG images for security reasons
    try {
      const pngBuffer = await sharp(Buffer.from(svg))
        .resize(800, 400)
        .png()
        .toBuffer();

      // Set headers for PNG image
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.setHeader('Access-Control-Allow-Origin', '*'); // Allow cross-origin requests
      res.send(pngBuffer);
    } catch (error) {
      console.error('Error converting SVG to PNG, falling back to SVG:', error);
      // Fallback to SVG if PNG conversion fails
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(svg);
    }
  } catch (error) {
    console.error('Error generating chart image:', error);
    // Return error image instead of JSON
    const errorSvg = generateErrorSVG(error.message || 'Unknown error occurred');
    try {
      const pngBuffer = await sharp(Buffer.from(errorSvg))
        .resize(800, 400)
        .png()
        .toBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(pngBuffer);
    } catch (pngError) {
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.send(errorSvg);
    }
  }
});

// API endpoint to get multiple repositories
app.post('/api/multiple-stars-history', async (req, res) => {
  try {
    const { repositories, forceRefresh, accessToken } = req.body;

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
        const stargazers = await fetchStargazers(owner, repoName, accessToken);
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

