# 📧 EmailJS Setup Guide - Send Reminder Emails

## ✅ What I've Implemented

Your "Send Reminder" button now:
- ✅ Finds all unpaid/overdue invoices for the member
- ✅ Calculates total amount due
- ✅ Sends professional email with invoice details
- ✅ Logs to communication history
- ✅ Shows toast notification on success/failure

---

## 🚀 Quick Setup (10 Minutes)

### **Step 1: Sign Up for EmailJS (FREE)**

1. Go to: **https://www.emailjs.com**
2. Click **"Sign Up"** (free account)
3. Verify your email address
4. Login to dashboard

---

### **Step 2: Add Email Service**

1. In EmailJS Dashboard, click **"Email Services"**
2. Click **"Add New Service"**
3. Choose your email provider:
   - **Gmail** (recommended for testing)
   - Outlook
   - Yahoo
   - Or use SMTP
4. Follow the connection wizard
5. **Copy the Service ID** (looks like: `service_xxxxxxx`)

---

### **Step 3: Create Email Template**

1. Click **"Email Templates"**
2. Click **"Create New Template"**
3. **Template Name:** "Payment Reminder"
4. **Copy and paste this template:**

#### **Subject:**
```
Payment Reminder - Outstanding Balance ${{total_due}}
```

#### **Content (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: 'Inter', Arial, sans-serif;
      line-height: 1.6;
      color: #000;
      margin: 0;
      padding: 0;
      background: #f9fafb;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #fff;
    }
    .header {
      background: #000;
      color: #fff;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .header p {
      margin: 5px 0 0 0;
      opacity: 0.9;
    }
    .content {
      padding: 30px;
      border: 1px solid #e5e7eb;
      border-top: none;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .info-box {
      background: #f9fafb;
      padding: 15px;
      border-left: 3px solid #000;
      margin: 20px 0;
    }
    .total {
      font-size: 24px;
      font-weight: bold;
      color: #000;
      margin: 20px 0;
      text-align: center;
      padding: 15px;
      background: #f9fafb;
      border: 2px solid #000;
    }
    .invoice-list {
      background: #f9fafb;
      padding: 20px;
      margin: 20px 0;
      border: 1px solid #e5e7eb;
    }
    .invoice-list h3 {
      margin-top: 0;
      font-size: 16px;
    }
    .invoice-list ul {
      padding-left: 0;
      list-style: none;
    }
    .payment-methods {
      background: #fff;
      padding: 20px;
      margin: 20px 0;
      border: 1px solid #e5e7eb;
    }
    .payment-methods h3 {
      margin-top: 0;
      font-size: 16px;
    }
    .payment-methods ul {
      padding-left: 20px;
    }
    .button {
      display: inline-block;
      background: #000;
      color: #fff;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .button:hover {
      background: #333;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .signature {
      margin-top: 30px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Subscription Manager HK</h1>
      <p>Payment Reminder Notification</p>
    </div>
    
    <div class="content">
      <p class="greeting">Dear <strong>{{to_name}}</strong>,</p>
      
      <p>السلام عليكم ورحمة الله وبركاته</p>
      
      <p>This is a friendly reminder about your outstanding subscription payments with Subscription Manager HK.</p>
      
      <div class="info-box">
        <p style="margin: 0;"><strong>Member ID:</strong> {{member_id}}</p>
        <p style="margin: 5px 0 0 0;"><strong>Contact:</strong> {{to_email}}</p>
        <p style="margin: 5px 0 0 0;"><strong>WhatsApp:</strong> {{member_phone}}</p>
      </div>
      
      <div class="total">
        Total Outstanding: ${{total_due}}
      </div>
      
      <div class="invoice-list">
        <h3>📋 Outstanding Invoices ({{invoice_count}}):</h3>
        <ul>{{{invoice_list_html}}}</ul>
      </div>
      
      <div class="payment-methods">
        <h3>💳 Payment Methods Available:</h3>
        <ul>
          <li><strong>FPS:</strong> ID 1234567</li>
          <li><strong>PayMe:</strong> Scan QR code in member portal</li>
          <li><strong>Bank Transfer:</strong> HSBC Hong Kong, Account 123-456789-001</li>
          <li><strong>Credit/Debit Card:</strong> Pay instantly through our secure portal</li>
        </ul>
      </div>
      
      <div style="text-align: center;">
        <a href="{{portal_link}}" class="button">
          🔗 Login to Member Portal
        </a>
      </div>
      
      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        Please settle your outstanding balance at your earliest convenience. 
        If you have already made the payment, please upload your payment proof through the member portal.
      </p>
      
      <div class="signature">
        <p>جزاك الله خيرا</p>
        <p>
          Best regards,<br>
          <strong>Finance Team</strong><br>
          Subscription Manager HK
        </p>
        <p style="color: #666; font-size: 13px;">
          Date: {{current_date}}
        </p>
      </div>
    </div>
    
    <div class="footer">
      <p>This is an automated reminder. Please do not reply to this email.</p>
      <p>For assistance, contact: <strong>support@subscriptionhk.org</strong> or call +852 2800 1122</p>
      <p style="margin-top: 10px; font-size: 12px;">© 2025 Subscription Manager HK. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

5. **Save the template**
6. **Copy the Template ID** (looks like: `template_xxxxxxx`)

---

### **Step 4: Get Your Public Key**

1. Click **"Account"** in EmailJS dashboard
2. Find **"Public Key"** section
3. **Copy the Public Key** (looks like: `xxxxxxxxxxxxxxxxxx`)

---

### **Step 5: Update Your Code**

Open `client/src/pages/AdminPage.jsx` and replace these placeholders:

#### **Line ~35 (useEffect):**
```javascript
emailjs.init("YOUR_PUBLIC_KEY");
```
Replace `YOUR_PUBLIC_KEY` with your actual public key from Step 4.

#### **Line ~271 (emailjs.send):**
```javascript
const result = await emailjs.send(
  "YOUR_SERVICE_ID",    // Replace with your Service ID from Step 2
  "YOUR_TEMPLATE_ID",   // Replace with your Template ID from Step 3
  emailParams
);
```

---

### **Step 6: Test It!**

1. **Commit and push:**
```bash
git add .
git commit -m "Add EmailJS email sending functionality"
git push
```

2. **Wait for Vercel to deploy** (1-2 minutes)

3. **Test the feature:**
   - Login to Admin portal
   - Go to Members → Click "View" on any member
   - In Member Detail page, click **"Send Reminder"**
   - ✅ Email should be sent!
   - Check the member's email inbox

---

## 📧 **What the Email Will Look Like**

The member will receive a professional email with:

✅ **Header:** Black header with "Subscription Manager HK"
✅ **Greeting:** Personalized with member name (with Arabic salutation)
✅ **Member Info:** ID, email, WhatsApp
✅ **Total Due:** Large, bold amount
✅ **Invoice List:** Each unpaid/overdue invoice with:
   - Period (e.g., "Nov 2025")
   - Amount (e.g., "$50")
   - Due date
   - Status (Unpaid/Overdue)
✅ **Payment Methods:** All available options with details
✅ **Portal Link:** Direct link to member portal
✅ **Professional Signature:** With Arabic closing phrase
✅ **Footer:** Support contact information

**All in black, white, and gray theme!**

---

## 🎯 **Email Template Variables Used**

These are automatically filled when sending:

| Variable | Example Value |
|----------|---------------|
| `{{to_name}}` | "Ahmed Al-Rashid" |
| `{{to_email}}` | "ahmed.rashid@hk.org" |
| `{{member_id}}` | "HK1021" |
| `{{member_phone}}` | "+852 9123 4567" |
| `{{total_due}}` | "150" |
| `{{invoice_count}}` | "2" |
| `{{invoice_list_html}}` | HTML list of invoices |
| `{{portal_link}}` | "https://your-domain.vercel.app/member" |
| `{{current_date}}` | "20 November 2025" |

---

## 🧪 **Testing Checklist**

After setup, test:

- [ ] Go to Admin → Members
- [ ] Click "View" on a member with unpaid invoices
- [ ] Click "Send Reminder" button
- [ ] See toast: "Sending reminder email..."
- [ ] See success toast: "✓ Reminder email sent..."
- [ ] Check Communication tab to see log entry
- [ ] **Check member's email inbox** for the email
- [ ] Email should have all invoice details

---

## 🔑 **Your Configuration Summary**

After completing setup, you'll have:

```javascript
// In AdminPage.jsx line ~35
emailjs.init("your_actual_public_key_here");

// In AdminPage.jsx line ~271
const result = await emailjs.send(
  "service_xxxxx",    // Your service ID
  "template_xxxxx",   // Your template ID
  emailParams
);
```

---

## 💡 **Pro Tips**

### **Test Email First:**
Use your own email address:
1. Edit a test member's email to be your email
2. Click "Send Reminder"
3. Check your inbox
4. Verify email looks good
5. Change member email back

### **Email Limits:**
- Free EmailJS: **200 emails/month**
- Paid plan: Unlimited from $7/month

### **Fallback:**
If email fails, the system will:
- Show error toast
- Log "Failed" in communication
- Still let you try again

---

## 🎨 **Email Preview**

The email will look like this:

```
┌─────────────────────────────────────┐
│  💰 Subscription Manager HK         │
│  Payment Reminder Notification      │
├─────────────────────────────────────┤
│                                     │
│  Dear Ahmed Al-Rashid,              │
│                                     │
│  السلام عليكم ورحمة الله وبركاته   │
│                                     │
│  This is a friendly reminder...     │
│                                     │
│  Member ID: HK1021                  │
│  Contact: ahmed.rashid@hk.org       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Total Outstanding: $150     │   │
│  └─────────────────────────────┘   │
│                                     │
│  Outstanding Invoices (2):          │
│  • Nov 2025: $50 (Due: 05 Nov)     │
│  • Sep 2025 Eid: $100 (Due: 30 Sep)│
│                                     │
│  Payment Methods:                   │
│  • FPS: ID 1234567                  │
│  • PayMe: QR code                   │
│  • Bank: HSBC 123-456789-001        │
│  • Card: Instant online             │
│                                     │
│      [Login to Member Portal]       │
│                                     │
│  جزاك الله خيرا                     │
│  Finance Team                       │
│  Subscription Manager HK            │
└─────────────────────────────────────┘
```

---

## 📝 **Configuration File Created**

I've updated these files:
1. ✅ **`client/src/pages/AdminPage.jsx`** - Added email sending logic
2. ✅ **`client/package.json`** - Added @emailjs/browser dependency
3. ✅ **`EMAILJS_SETUP_GUIDE.md`** - This guide

---

## 🔑 **What You Need to Do**

### **1. Get EmailJS Credentials (5 min)**
   - Sign up at emailjs.com
   - Add email service → Get **Service ID**
   - Create template → Get **Template ID**
   - Get **Public Key** from Account page

### **2. Update AdminPage.jsx (1 min)**
   - Open `client/src/pages/AdminPage.jsx`
   - Find line ~35: Replace `YOUR_PUBLIC_KEY`
   - Find line ~271: Replace `YOUR_SERVICE_ID` and `YOUR_TEMPLATE_ID`
   - Save file

### **3. Deploy (2 min)**
   ```bash
   git add .
   git commit -m "Configure EmailJS for sending reminders"
   git push
   ```

### **4. Test (1 min)**
   - Login to admin
   - View any member
   - Click "Send Reminder"
   - ✅ Email sent!

---

## ✅ **Features of the Reminder Email**

When admin clicks "Send Reminder", the email will include:

✅ **Professional Header:** Black header with logo/title
✅ **Personalization:** Member's name
✅ **Islamic Greeting:** السلام عليكم ورحمة الله وبركاته
✅ **Member Details:** ID, email, phone
✅ **Total Amount:** Bold, prominent display
✅ **Invoice Breakdown:** Each unpaid invoice with:
   - Period
   - Amount
   - Due date
   - Status (Unpaid/Overdue)
✅ **Payment Instructions:** All 4 payment methods with details
✅ **Portal Link:** One-click button to member portal
✅ **Islamic Closing:** جزاك الله خيرا
✅ **Professional Footer:** Support contact info
✅ **Monochrome Design:** Black, white, gray only

---

## 🧪 **Test Scenarios**

### **Scenario 1: Member with 1 Unpaid Invoice**
```
Email Subject: Payment Reminder - Outstanding Balance $50
Content: Shows 1 invoice (Nov 2025 Monthly: $50)
```

### **Scenario 2: Member with Multiple Invoices**
```
Email Subject: Payment Reminder - Outstanding Balance $150
Content: Shows 2 invoices (Nov Monthly + Sep Eid)
```

### **Scenario 3: Member with No Due**
```
Action: Button shows error toast
Message: "This member has no outstanding payments"
No email sent
```

---

## 📊 **What Happens When Button is Clicked**

1. **Validation:**
   - Checks if member selected
   - Finds unpaid/overdue invoices
   - Calculates total due

2. **Email Preparation:**
   - Formats invoice list
   - Prepares all variables
   - Creates email parameters

3. **Sending:**
   - Shows "Sending..." toast
   - Calls EmailJS API
   - Waits for response

4. **Success:**
   - Shows "✓ Email sent!" toast
   - Logs to Communication tab
   - Console logs confirmation

5. **Failure:**
   - Shows error toast
   - Logs failed attempt
   - User can retry

---

## 🎉 **Summary**

Your "Send Reminder" button is now fully functional and will:
- ✅ Calculate member's total outstanding amount
- ✅ List all unpaid/overdue invoices
- ✅ Send professional HTML email
- ✅ Include payment methods and portal link
- ✅ Use Islamic greetings (appropriate for Muslim names)
- ✅ Log communication history
- ✅ Show user feedback with toasts

**Just get your EmailJS credentials and update the 3 placeholders, then it's ready!** 🚀

---

## 📞 **EmailJS Support**

- **Dashboard:** https://dashboard.emailjs.com
- **Docs:** https://www.emailjs.com/docs
- **Pricing:** https://www.emailjs.com/pricing (Free: 200 emails/month)

**Ready to send professional reminder emails!** 📧✨

