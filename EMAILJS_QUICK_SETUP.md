# ⚡ EmailJS Quick Setup - 5 Minutes

## 🎯 3 Simple Steps

### **STEP 1: Get EmailJS Account (2 min)**

1. Go to: https://www.emailjs.com
2. Sign up (free)
3. Verify email

---

### **STEP 2: Configure EmailJS (3 min)**

#### **A. Add Email Service**
1. Dashboard → "Email Services" → "Add New Service"
2. Choose "Gmail" (or your email provider)
3. Connect your email
4. **Copy Service ID** → Save it (looks like: `service_abc123`)

#### **B. Create Email Template**
1. Dashboard → "Email Templates" → "Create New Template"
2. Name: "Payment Reminder"
3. **Copy the HTML template from EMAILJS_SETUP_GUIDE.md**
4. Paste into template
5. **Copy Template ID** → Save it (looks like: `template_xyz789`)

#### **C. Get Public Key**
1. Dashboard → "Account" → "General"
2. Find "Public Key"
3. **Copy Public Key** → Save it (looks like: `AbCdEfGhIjKlMnOp`)

---

### **STEP 3: Update Your Code (30 sec)**

Open: `client/src/pages/AdminPage.jsx`

#### **Find line ~35:**
```javascript
emailjs.init("YOUR_PUBLIC_KEY");
```
**Replace with:**
```javascript
emailjs.init("AbCdEfGhIjKlMnOp");  // Your actual key
```

#### **Find line ~271:**
```javascript
const result = await emailjs.send(
  "YOUR_SERVICE_ID",
  "YOUR_TEMPLATE_ID",
  emailParams
);
```
**Replace with:**
```javascript
const result = await emailjs.send(
  "service_abc123",   // Your service ID
  "template_xyz789",  // Your template ID
  emailParams
);
```

#### **Save and Deploy:**
```bash
git add client/src/pages/AdminPage.jsx
git commit -m "Configure EmailJS credentials"
git push
```

---

## ✅ **Done! Test It:**

1. Open your deployed app
2. Login as Admin
3. Go to Members → View any member with unpaid invoices
4. Click **"Send Reminder"**
5. ✅ Email sent!
6. Check the member's email inbox

---

## 📧 **What the Member Receives**

```
Subject: Payment Reminder - Outstanding Balance $150

Dear Ahmed Al-Rashid,

السلام عليكم ورحمة الله وبركاته

Member ID: HK1021
Total Outstanding: $150

Outstanding Invoices (2):
• Nov 2025 Monthly: $50 (Due: 05 Nov)
• Sep 2025 Eid: $100 (Due: 30 Sep)

Payment Methods:
• FPS: ID 1234567
• PayMe, Bank Transfer, Credit Card

[Login to Member Portal] (Button)

جزاك الله خيرا
Finance Team
Subscription Manager HK
```

---

## 🎯 **3 IDs You Need**

Write them here after getting from EmailJS:

```
Public Key:    ____________________
Service ID:    ____________________  
Template ID:   ____________________
```

Then paste into AdminPage.jsx!

---

## 🎉 **That's It!**

**Total time:** 5 minutes
**Cost:** FREE (200 emails/month)
**Result:** Professional automated reminder emails! 📧✨

