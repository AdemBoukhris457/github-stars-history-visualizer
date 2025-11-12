# Deployment Guide

This guide covers multiple ways to deploy the GitHub Stars History Visualizer so it's accessible to all users.

## Quick Deploy Options

### 1. **Railway** (Recommended - Easiest)

Railway is one of the easiest platforms for deploying Node.js applications.

**Steps:**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will automatically detect it's a Node.js app and deploy it
6. Your app will be live with a public URL!

**No configuration needed** - Railway auto-detects everything!

---

### 2. **Render** (Free Tier Available)

Render offers free hosting with automatic deployments.

**Steps:**
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name**: github-stars-history-visualizer
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Click "Create Web Service"
7. Your app will be live at `https://your-app-name.onrender.com`

**Note**: Free tier spins down after 15 minutes of inactivity (first request may be slow).

---

### 3. **Vercel** (Serverless)

Vercel is great for serverless deployments.

**Steps:**
1. Install Vercel CLI: `npm i -g vercel`
2. In your project directory, run: `vercel`
3. Follow the prompts
4. Your app will be deployed!

**Or use the web interface:**
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Other
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)
   - **Install Command**: `npm install`
4. Deploy!

**Note**: You may need to create a `vercel.json` file (see below).

---

### 4. **Heroku** (Classic Platform)

Heroku is a well-established platform.

**Steps:**
1. Install Heroku CLI: [heroku.com/cli](https://devcenter.heroku.com/articles/heroku-cli)
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Deploy: `git push heroku main`
5. Your app will be live at `https://your-app-name.herokuapp.com`

**Note**: Heroku removed free tier, but offers paid plans.

---

### 5. **Fly.io** (Global Edge Network)

Fly.io offers global deployment with edge computing.

**Steps:**
1. Install Fly CLI: [fly.io/docs/getting-started/installing-flyctl](https://fly.io/docs/getting-started/installing-flyctl/)
2. Login: `fly auth login`
3. Launch: `fly launch`
4. Follow the prompts
5. Deploy: `fly deploy`

---

### 6. **DigitalOcean App Platform**

**Steps:**
1. Go to [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Create → Apps → GitHub
3. Select your repository
4. Configure:
   - **Type**: Web Service
   - **Run Command**: `npm start`
   - **Build Command**: `npm install`
5. Deploy!

---

## Configuration Files

### For Vercel

Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}
```

### For Railway/Render/Heroku

No additional config needed! These platforms auto-detect Node.js apps.

---

## Environment Variables

If you want to set a specific port (optional):
- **Railway/Render/Heroku**: Set `PORT` environment variable in dashboard
- The app will automatically use the provided port

---

## Post-Deployment

1. **Update README**: Add your deployment URL to the README
2. **Test**: Make sure the app works on the deployed URL
3. **Monitor**: Check logs for any errors

---

## Custom Domain (Optional)

Most platforms allow you to add a custom domain:

1. **Railway**: Settings → Domains → Add Custom Domain
2. **Render**: Settings → Custom Domain
3. **Vercel**: Project Settings → Domains

---

## Troubleshooting

### Port Issues
- The app automatically finds an available port
- If using a platform that requires a specific port, set `PORT` environment variable

### Build Errors
- Make sure `package.json` has all dependencies listed
- Check platform logs for specific error messages

### CORS Issues
- The app already has CORS enabled
- If issues persist, check your platform's documentation

---

## Recommended Platform

**For beginners**: **Railway** or **Render** - easiest setup, free tiers available
**For production**: **Railway**, **Render**, or **DigitalOcean** - reliable and scalable
**For global reach**: **Fly.io** - edge network deployment

---

## Quick Start (Railway - Recommended)

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Sign up with GitHub
4. Click "New Project" → "Deploy from GitHub repo"
5. Select your repository
6. Done! Your app is live! 🚀

