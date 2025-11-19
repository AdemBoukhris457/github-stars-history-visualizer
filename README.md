# ⭐ GitHub Stars History Visualizer

> 📊 Beautiful, dynamic charts showing GitHub repository star growth over time. Perfect for README files and project documentation.

[![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=AdemBoukhris457%2FDoctra&style=professional)](https://github-stars-history-visualizer.vercel.app?repo=AdemBoukhris457%2FDoctra)

## 🚀 Quick Start

### Add to Your README

Copy and paste this into your README.md:

```markdown
[![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=YOUR_USERNAME%2FYOUR_REPO&style=professional)](https://github-stars-history-visualizer.vercel.app?repo=YOUR_USERNAME%2FYOUR_REPO)
```

**Replace:**
- `YOUR_USERNAME` with your GitHub username
- `YOUR_REPO` with your repository name

### Example

```markdown
[![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=facebook%2Freact&style=professional)](https://github-stars-history-visualizer.vercel.app?repo=facebook%2Freact)
```

## ✨ Features

- 🎨 **8 Beautiful Themes** - Choose from professional, aesthetic, dark, minimal, vibrant, pastel, neon, and corporate styles
- 📈 **Interactive Charts** - Hover to see detailed star counts at any point in time
- 🔄 **Auto-Updating** - Charts automatically update when embedded in markdown
- 📝 **Markdown Ready** - Generate markdown code with one click
- 📥 **Export Options** - Download charts as PNG images
- 🔀 **Multi-Repo Support** - Compare star growth across multiple repositories
- 💾 **Smart Caching** - Data is cached to minimize API calls
- 🎯 **Consistent Design** - Charts look identical in markdown and on the website

## 🎨 Themes

### Professional
Clean, business-ready charts perfect for documentation.

```markdown
![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username%2Frepo&style=professional)
```

### Aesthetic
Beautiful gradient charts with smooth animations.

```markdown
![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username%2Frepo&style=aesthetic)
```

### Dark
Perfect for dark-themed projects.

```markdown
![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username%2Frepo&style=dark)
```

### Minimal
Clean and simple, no distractions.

```markdown
![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username%2Frepo&style=minimal)
```

### Vibrant
Bold and colorful charts.

```markdown
![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username%2Frepo&style=vibrant)
```

### Pastel
Soft, gentle colors.

```markdown
![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username%2Frepo&style=pastel)
```

### Neon
Cyberpunk-inspired neon glow.

```markdown
![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username%2Frepo&style=neon)
```

### Corporate
Professional corporate style.

```markdown
![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username%2Frepo&style=corporate)
```

## 📖 Usage

### Single Repository

```markdown
[![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username%2Frepo&style=professional)](https://github-stars-history-visualizer.vercel.app?repo=username%2Frepo)
```

### Multiple Repositories

Compare multiple repositories:

```markdown
[![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username1%2Frepo1,username2%2Frepo2&style=professional)](https://github-stars-history-visualizer.vercel.app?repos=username1%2Frepo1,username2%2Frepo2)
```

### URL Parameters

- `repos` - Repository in format `username/repo` (use `%2F` for `/`). For multiple repos, separate with commas
- `style` - Chart theme: `professional`, `aesthetic`, `dark`, `minimal`, `vibrant`, `pastel`, `neon`, or `corporate`

## 🖥️ Local Development

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/github-stars-history-visualizer.git
cd github-stars-history-visualizer
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser:
```
http://localhost:3000
```

## 🔧 API Endpoints

### GET `/api/chart-image`
Generate a chart image for embedding in markdown.

**Query Parameters:**
- `repos` (required) - Repository in format `username/repo` or comma-separated list
- `style` (optional) - Chart theme (default: `professional`)

**Example:**
```
GET /api/chart-image?repos=facebook%2Freact&style=professional
```

### POST `/api/stars-history`
Fetch stars history for a single repository.

**Request Body:**
```json
{
  "owner": "facebook",
  "repo": "react",
  "forceRefresh": false,
  "accessToken": "optional_github_token"
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
  "forceRefresh": false,
  "accessToken": "optional_github_token"
}
```

## 📊 How It Works

1. **Data Fetching**: Uses GitHub REST API to fetch all stargazers for a repository
2. **Timeline Building**: Processes stargazer data to build a daily timeline of star counts
3. **Caching**: Data is cached locally in JSON files to minimize API calls
4. **Visualization**: Generates SVG charts for markdown and interactive Chart.js charts for the website
5. **Consistency**: Both SVG and Chart.js use the same style configuration for identical appearance

## ⚡ Rate Limits

**Without GitHub Authentication:**
- 60 requests per hour (GitHub API limit)
- Data is cached locally to minimize API calls

**With GitHub Authentication:**
- 5,000 requests per hour
- Add your GitHub Personal Access Token in the web interface

## 🚀 Deployment

This application can be deployed to various platforms:

- **Vercel** - [Deployment Guide](./VERCEL_DEPLOY.md)
- **Railway** - Connect your GitHub repo
- **Render** - Free tier available
- **Heroku** - Classic platform
- **Fly.io** - Global edge network

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 🛠️ Technologies

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, Chart.js
- **API**: GitHub REST API v3
- **Chart Generation**: SVG for markdown, Chart.js for interactive charts

## 📝 Examples

### Example 1: Single Repository with Professional Theme

```markdown
[![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=facebook%2Freact&style=professional)](https://github-stars-history-visualizer.vercel.app?repo=facebook%2Freact)
```

### Example 2: Multiple Repositories with Aesthetic Theme

```markdown
[![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=facebook%2Freact,vuejs%2Fvue&style=aesthetic)](https://github-stars-history-visualizer.vercel.app?repos=facebook%2Freact,vuejs%2Fvue)
```

### Example 3: Dark Theme for Dark Mode Projects

```markdown
[![Star History Chart](https://github-stars-history-visualizer.vercel.app/api/chart-image?repos=username%2Frepo&style=dark)](https://github-stars-history-visualizer.vercel.app?repo=username%2Frepo)
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [github-readme-stats](https://github.com/anuraghazra/github-readme-stats)
- Built with [Chart.js](https://www.chartjs.org/)
- Powered by [GitHub API](https://docs.github.com/en/rest)

---

**Made with ❤️ for the GitHub community**
