# 🚀 Vercel Deployment Guide - Fix Routing Issues

## ✅ Files Updated

I've configured your project for proper Vercel deployment:

### 1. `vercel.json` (Root)
```json
{
  "buildCommand": "cd client && npm install && npm run build",
  "outputDirectory": "client/dist",
  "installCommand": "cd client && npm install",
  "devCommand": "cd client && npm run dev",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2. `package.json` (Root)
```json
{
  "name": "subscription-manager-hk",
  "version": "1.0.0",
  "description": "Subscription Manager HK - Fully Functional CRUD Application",
  "scripts": {
    "build": "cd client && npm run build",
    "dev": "cd client && npm run dev"
  }
}
```

---

## 🔧 Vercel Dashboard Settings

### Go to your Vercel project → Settings → General

Set these **EXACTLY** as shown:

#### **Build & Development Settings**
```
Framework Preset: Vite
Root Directory: . (leave empty or put a dot)
Build Command: npm run build
Output Directory: client/dist
Install Command: npm install
```

#### **Or use these if above doesn't work:**
```
Framework Preset: Other
Root Directory: client
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

---

## 📝 Deployment Steps

### **Method 1: Git Push (Recommended)**

1. **Commit the changes:**
```bash
git add .
git commit -m "Fix Vercel deployment configuration"
git push
```

2. **Vercel will auto-deploy** (check deployment in dashboard)

3. **Wait for build to complete** (usually 1-2 minutes)

4. **Test your routes:**
   - Visit `https://your-domain.vercel.app/`
   - Visit `https://your-domain.vercel.app/admin`
   - Visit `https://your-domain.vercel.app/member`
   - Refresh each page (should NOT show 404)

---

### **Method 2: Vercel CLI**

```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

When prompted:
- **Set up and deploy:** `Y`
- **Which scope:** Choose your account
- **Link to existing project:** `Y`
- **What's your project's name:** subscription-manager-hk
- **In which directory is your code located:** `./` (root)

---

### **Method 3: Redeploy from Dashboard**

1. Go to Vercel Dashboard
2. Click on your project
3. Click **"Deployments"** tab
4. Click the **three dots (...)** on the latest deployment
5. Click **"Redeploy"**
6. Click **"Redeploy"** again to confirm

---

## 🐛 Troubleshooting

### **Issue 1: Build Fails**

**Error:** "Command failed: npm run build"

**Solution:**
1. Check Vercel build logs
2. Make sure `client/package.json` has `"build": "vite build"`
3. Try these settings in Vercel:
   ```
   Root Directory: client
   Build Command: npm run build
   Output Directory: dist
   ```

---

### **Issue 2: Still Getting 404**

**Solution A: Clear Cache**
1. Vercel Dashboard → Your Project
2. Settings → General
3. Scroll down and click **"Clear Build Cache"**
4. Redeploy

**Solution B: Check Build Output**
1. Go to Vercel deployment logs
2. Look for "Build Completed"
3. Verify it says `client/dist` directory was created
4. Check that `index.html` is in the output

**Solution C: Environment Variables**
If you have any environment variables:
1. Settings → Environment Variables
2. Add them if missing
3. Redeploy

---

### **Issue 3: Only Login Page Shows**

This means routing is not working. Make sure:

1. ✅ `vercel.json` is at **project root** (not inside client)
2. ✅ `vercel.json` has the `rewrites` configuration
3. ✅ You've redeployed after adding `vercel.json`

---

### **Issue 4: Assets Not Loading**

If CSS/JS files show 404:

1. Check `client/vite.config.js`:
```javascript
export default defineConfig({
  plugins: [react()],
  base: '/', // Should be '/' not '/client/'
});
```

2. Redeploy

---

## ✅ Verification Checklist

After deployment, test these:

### **Direct URL Access:**
- [ ] `https://your-domain.vercel.app/` → Should redirect to login
- [ ] `https://your-domain.vercel.app/login` → Login page
- [ ] `https://your-domain.vercel.app/admin` → Admin page (after login)
- [ ] `https://your-domain.vercel.app/member` → Member page (after login)

### **Refresh Test:**
- [ ] Navigate to `/admin`
- [ ] Press F5 (refresh)
- [ ] Should stay on admin page, NOT show 404

### **Navigation Test:**
- [ ] Login as admin
- [ ] Navigate through all admin sections
- [ ] All routes work without page refresh
- [ ] Logout and login as member
- [ ] Navigate through all member sections

---

## 📁 Correct Project Structure

```
SAAS/                           ← Project root
├── vercel.json                 ← Deployment config (I created this)
├── package.json                ← Root package.json (I created this)
├── client/                     ← Frontend code
│   ├── dist/                   ← Build output (created on build)
│   │   ├── index.html
│   │   └── assets/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── pages/
│   │   ├── components/
│   │   └── context/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── server/                     ← Backend (not deployed to Vercel frontend)
    ├── server.js
    └── package.json
```

---

## 🎯 Expected Build Process

When Vercel builds your project:

1. **Install:** Runs `cd client && npm install`
2. **Build:** Runs `cd client && npm run build`
3. **Output:** Creates `client/dist/` folder with:
   - `index.html`
   - `assets/` folder with JS and CSS
4. **Deploy:** Serves files from `client/dist/`
5. **Routing:** All routes go to `index.html` (SPA mode)

---

## 💡 Alternative: Deploy Only Client Folder

If nothing works, try deploying ONLY the client folder:

1. Create a **new Vercel project**
2. Connect to your Git repo
3. Set **Root Directory** to `client`
4. Framework: `Vite`
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Deploy

This will deploy only the frontend from the `client` folder.

---

## 🚀 Quick Fix Commands

Run these in your project root:

```bash
# 1. Make sure files are correct
cat vercel.json
cat package.json

# 2. Test build locally
cd client
npm install
npm run build
# Should create client/dist folder

# 3. Commit and push
cd ..
git add .
git commit -m "Fix Vercel deployment"
git push

# 4. Or deploy with CLI
vercel --prod
```

---

## 📞 Still Not Working?

If you still have issues, check:

1. **Vercel Build Logs:**
   - Go to Vercel Dashboard
   - Click on latest deployment
   - Read the build logs carefully
   - Look for any errors

2. **Browser Console:**
   - Open deployed site
   - Press F12
   - Check Console tab for errors
   - Check Network tab for 404s

3. **File Paths:**
   - Make sure `vercel.json` is at **project root**
   - Not inside `client/` folder

---

## ✅ Summary

1. ✅ Created `vercel.json` at root with proper config
2. ✅ Created `package.json` at root with build scripts
3. ✅ Configuration handles SPA routing
4. 🔄 **Now:** Push to Git or redeploy
5. ⏱️ **Wait:** 1-2 minutes for build
6. 🧪 **Test:** All routes including refresh

**Your deployment should now work perfectly!** 🎉

---

## 🆘 Emergency Alternative

If NOTHING works, use this simple `vercel.json`:

```json
{
  "routes": [
    {
      "src": "/[^.]+",
      "dest": "/",
      "status": 200
    }
  ]
}
```

And deploy with Root Directory set to `client` in Vercel settings.

