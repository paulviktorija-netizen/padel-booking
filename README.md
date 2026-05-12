# 🎾 Padel Court Booking

Booking app for the residence padel court. Built with React + Vite.

---

## 🚀 Deploy on Vercel (5 minutes, free)

### Step 1 — Create a GitHub account (if you don't have one)
Go to https://github.com and sign up.

### Step 2 — Upload this project to GitHub
1. Go to https://github.com/new
2. Repository name: `padel-booking`
3. Keep it **Public**, click **Create repository**
4. On the next page, click **"uploading an existing file"**
5. Drag and drop **all the files from this folder** (keep the folder structure)
6. Click **Commit changes**

### Step 3 — Deploy on Vercel
1. Go to https://vercel.com and sign up with your GitHub account
2. Click **"Add New Project"**
3. Select your `padel-booking` repository
4. Leave all settings as default (Vercel detects Vite automatically)
5. Click **Deploy**
6. In ~1 minute you get a live URL like: `padel-booking.vercel.app`

### Step 4 — Share the URL with residents
Send the link to everyone in the residence. That's it! 🎉

---

## ⚠️ Important note about bookings storage

By default, bookings are saved in **localStorage** — meaning each device has its own data.

**To make bookings shared across all residents' phones**, you need to add Firebase (free):

### Add Firebase (real-time shared bookings)

1. Go to https://console.firebase.google.com
2. Create a project → Add a web app → Copy the config
3. In your project, run: `npm install firebase`
4. Create `src/firebase.js`:

```js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  // paste your config here
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
```

5. In Firebase Console → Realtime Database → Rules, set:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

6. Then in `App.jsx`, replace the `loadFromStorage` / `saveToStorage` / `persist` logic with Firebase reads/writes.

👉 **Ask Claude to do step 6 for you** — just paste your Firebase config and say "add Firebase to my padel app".

---

## 🛠 Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173
