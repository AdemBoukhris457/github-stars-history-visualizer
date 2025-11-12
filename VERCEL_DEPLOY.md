# Deploying to Vercel

This guide will walk you through deploying the GitHub Stars History Visualizer to Vercel.

## Prerequisites

- Your code pushed to a GitHub repository
- A Vercel account (free)

## Method 1: Deploy via Vercel Website (Easiest)

### Step 1: Sign up for Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up"
3. Choose "Continue with GitHub" (recommended)
4. Authorize Vercel to access your GitHub account

### Step 2: Import Your Repository
1. After signing in, click "Add New..." → "Project"
2. You'll see a list of your GitHub repositories
3. Find and click "Import" next to `github-stars-history-visualizer`
4. If you don't see it, click "Adjust GitHub App Permissions" and grant access

### Step 3: Configure Project
Vercel will auto-detect your project. Configure these settings:

**Project Settings:**
- **Framework Preset**: Other (or leave as default)
- **Root Directory**: `./` (default)
- **Build Command**: Leave empty (or `npm install` if needed)
- **Output Directory**: Leave empty
- **Install Command**: `npm install` (auto-filled)

**Environment Variables:**
- No environment variables needed for basic deployment
- The app will automatically use the PORT provided by Vercel

### Step 4: Deploy
1. Click "Deploy"
2. Wait for the build to complete (usually 1-2 minutes)
3. Your app will be live at: `https://your-project-name.vercel.app`

### Step 5: Access Your App
- Vercel will show you the deployment URL
- Click it to open your live application
- Share this URL with anyone!

---

## Method 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```
This will open your browser to authenticate.

### Step 3: Deploy
Navigate to your project directory and run:
```bash
vercel
```

**First time deployment:**
- Follow the prompts:
  - "Set up and deploy? Yes"
  - "Which scope?" (choose your account)
  - "Link to existing project? No"
  - "Project name?" (press Enter for default)
  - "Directory?" (press Enter for current directory)
  - "Override settings? No"

### Step 4: Production Deploy
After the first deployment, deploy to production:
```bash
vercel --prod
```

Your app will be live at: `https://your-project-name.vercel.app`

---

## Automatic Deployments

Once connected to GitHub, Vercel will automatically:
- ✅ Deploy every push to `main` branch (production)
- ✅ Create preview deployments for pull requests
- ✅ Rebuild on every commit

---

## Custom Domain (Optional)

1. Go to your project dashboard on Vercel
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

---

## Troubleshooting

### Build Fails
- Check the build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility

### App Not Working
- Check function logs in Vercel dashboard
- Verify the `vercel.json` configuration
- Make sure the server is listening on the correct port (Vercel provides PORT automatically)

### Port Issues
- The app automatically uses `process.env.PORT` which Vercel provides
- No manual configuration needed

### CORS Issues
- CORS is already enabled in the app
- If issues persist, check Vercel's documentation

---

## Project Structure for Vercel

Your project should have:
```
github-stars-history-visualizer/
├── vercel.json          # Vercel configuration (already created)
├── server.js            # Main server file
├── package.json         # Dependencies
├── public/             # Static files
│   └── index.html
└── data/               # Cached data (gitignored)
```

The `vercel.json` file is already configured correctly!

---

## Updating Your Deployment

### Via Website
- Just push to GitHub - Vercel auto-deploys!

### Via CLI
```bash
vercel --prod
```

---

## Vercel Features You Get

- ✅ **Free HTTPS** - Automatic SSL certificates
- ✅ **Global CDN** - Fast loading worldwide
- ✅ **Automatic Deployments** - Deploy on every push
- ✅ **Preview Deployments** - Test PRs before merging
- ✅ **Analytics** - View usage statistics
- ✅ **Custom Domains** - Add your own domain

---

## Quick Start Summary

1. **Push code to GitHub** ✅
2. **Go to vercel.com** → Sign up with GitHub
3. **Import repository** → Select your repo
4. **Click Deploy** → Wait 1-2 minutes
5. **Done!** Your app is live 🚀

---

## Need Help?

- Vercel Docs: [vercel.com/docs](https://vercel.com/docs)
- Vercel Support: [vercel.com/support](https://vercel.com/support)

