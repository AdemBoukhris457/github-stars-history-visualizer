# GitHub Stars History Visualizer

A web application to visualize the growth of GitHub stars over time for one or more repositories. This tool fetches stargazer data from the GitHub API and creates beautiful interactive charts showing the star history.

## Features

- 📊 **Interactive Charts**: Beautiful line charts showing stars growth over time
- 🎨 **Two Chart Styles**: Choose between Professional (clean, business-ready) or Aesthetic (beautiful gradients and animations)
- 📝 **Markdown Export**: Generate markdown code with embedded chart image for your README files
- 📥 **Chart Export**: Download charts as PNG images
- 🔄 **Data Caching**: Automatically caches data locally to avoid repeated API calls
- 📈 **Multiple Repositories**: Compare stars history across multiple repositories
- 🚀 **No Authentication Required**: Works without GitHub authentication (with rate limits)
- 💾 **Persistent Storage**: Data is saved locally in JSON files

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost
```

3. Enter a repository owner and name (e.g., `facebook` / `react`)

4. Click "Add Repository" to fetch and visualize the stars history

5. Add multiple repositories to compare their growth

6. Use the "Chart Style" dropdown to switch between:
   - **Professional**: Clean, business-ready charts with subtle colors and clear typography
   - **Aesthetic**: Beautiful charts with gradient fills, smooth animations, and vibrant colors

7. **Export Options**:
   - Click "📥 Download Chart as PNG" to save the chart as an image
   - Click "📝 Copy Markdown for README" to generate markdown code with the embedded chart image that you can paste directly into your README.md file

## How It Works

1. **Data Fetching**: The application uses the GitHub REST API to fetch all stargazers for a repository
2. **Timeline Building**: It processes the stargazer data to build a daily timeline of star counts
3. **Caching**: Data is cached in the `data/` directory to avoid repeated API calls
4. **Visualization**: Chart.js is used to render interactive line charts

## Rate Limits

**Important**: Without GitHub authentication, the API rate limit is **60 requests per hour**. 

- The application caches data locally to minimize API calls
- Use the "Force refresh" option sparingly
- For repositories with many stars, the initial fetch may take some time

## API Endpoints

### POST `/api/stars-history`
Fetch stars history for a single repository.

**Request Body:**
```json
{
  "owner": "facebook",
  "repo": "react",
  "forceRefresh": false
}
```

### POST `/api/multiple-stars-history`
Fetch stars history for multiple repositories.

**Request Body:**
```json
{
  "repositories": [
    { "owner": "facebook", "repo": "react" },
    { "owner": "vuejs", "repo": "vue" }
  ],
  "forceRefresh": false
}
```

## Project Structure

```
github-stars-history-visualizer/
├── server.js          # Express server and API endpoints
├── package.json       # Dependencies
├── public/
│   └── index.html     # Frontend interface
├── data/              # Cached repository data (created automatically)
└── README.md          # This file
```

## Technologies Used

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, Chart.js
- **API**: GitHub REST API v3

## License

MIT License - see LICENSE file for details

## Deployment

This application can be easily deployed to various platforms. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy Options:**
- **Railway**: Easiest - just connect your GitHub repo
- **Render**: Free tier available with automatic deployments
- **Vercel**: Great for serverless deployments
- **Heroku**: Classic platform (paid plans)
- **Fly.io**: Global edge network deployment

The app automatically handles port selection and works out of the box on most platforms.

## Notes

- Data is stored in the `data/` directory as JSON files
- Each repository's data is cached separately
- The cache persists between server restarts
- For best performance with large repositories, consider using GitHub authentication to increase rate limits
