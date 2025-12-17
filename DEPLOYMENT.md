# Deployment Guide

## Quick Push to Vercel

Your repository is configured to push to: `https://github.com/ShantanuGupta03/dust_vercel`

### Standard Workflow

1. **Make your changes** to the code

2. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Your commit message"
   ```

3. **Push to GitHub** (this will trigger Vercel deployment):
   ```bash
   git push origin main
   ```

### If Remote Has Changes

If you get a "rejected" error, pull first:
```bash
git pull origin main --rebase
git push origin main
```

### Verify Deployment

- Check Vercel dashboard: https://vercel.com/dashboard
- Your app will auto-deploy on every push to `main` branch
- Deployment URL: Check your Vercel project settings

### Environment Variables

Make sure these are set in Vercel Dashboard → Project Settings → Environment Variables:
- `VITE_0X_API_KEY` (optional)
- `VITE_BASESCAN_API_KEY` (optional)

### Build Status

- Build command: `npm run build`
- Output directory: `dist`
- Framework: Vite (auto-detected)

## Troubleshooting

### Build Fails on Vercel
- Check build logs in Vercel dashboard
- Ensure all TypeScript errors are fixed locally first
- Run `npm run build` locally to test

### Changes Not Deploying
- Verify you pushed to `main` branch
- Check Vercel project is connected to correct GitHub repo
- Check deployment logs in Vercel dashboard

