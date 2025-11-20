# 📦 Manual EmailJS Installation

## ⚠️ PowerShell Execution Policy Issue

Your PowerShell has restricted execution policies. Here's how to install:

---

## 🔧 **Method 1: Use Command Prompt (Easiest)**

1. Press **Windows + R**
2. Type: `cmd`
3. Press Enter
4. Run these commands:

```cmd
cd E:\SAAS\client
npm install
```

This will install all dependencies including EmailJS.

---

## 🔧 **Method 2: Use Git Bash**

If you have Git installed:

1. Right-click in the `E:\SAAS\client` folder
2. Select "Git Bash Here"
3. Run:

```bash
npm install
```

---

## 🔧 **Method 3: Fix PowerShell Execution Policy**

If you want to use PowerShell:

1. Open PowerShell **as Administrator**
2. Run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

3. Type `Y` and press Enter
4. Close and reopen PowerShell
5. Navigate to client folder and run:

```powershell
cd E:\SAAS\client
npm install
```

---

## ✅ **After Installation**

The dev server will reload automatically and:
- ✅ No more "@emailjs/browser" import error
- ✅ Admin page loads correctly
- ✅ Send Reminder button works

---

## 🧪 **Test the Feature**

1. Open app: `http://localhost:5173`
2. Login as Admin
3. Go to Members
4. Find **"Shan Yeager"** (that's you!)
5. Click "View" button
6. You'll see:
   - Outstanding Balance: $250
   - 4 unpaid invoices
7. Click **"Send Reminder"** button
8. Check browser console (F12) - you'll see email preview
9. When you configure EmailJS, it will send to: `0741sanjai@gmail.com`

---

## 📧 **Your Test Member Data**

I've added you to the system:

```
Name: Shan Yeager
Email: 0741sanjai@gmail.com
Member ID: HK1001
Phone: +852 9000 1234
Status: Active
Outstanding Balance: $250

Unpaid Invoices (4):
1. Nov 2025 Monthly: $50 (Due: 20 Nov) - Unpaid
2. Oct 2025 Monthly: $50 (Due: 20 Oct) - Overdue
3. Sep 2025 Eid 2: $100 (Due: 30 Sep) - Overdue
4. Sep 2025 Monthly: $50 (Due: 20 Sep) - Overdue

Total Outstanding: $250
```

When you click "Send Reminder", the email will include all 4 invoices!

---

## 🎯 **Quick Commands**

Choose one method and run:

### **Command Prompt:**
```cmd
cd E:\SAAS\client
npm install
```

### **Git Bash:**
```bash
cd /e/SAAS/client
npm install
```

### **PowerShell (after fixing policy):**
```powershell
cd E:\SAAS\client
npm install
```

---

**Run one of these commands now to install EmailJS!** 🚀

