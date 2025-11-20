# 📧 EmailJS Template Configuration - Fix Blank Email

## 🎯 **The Issue**

Email is sending successfully ✅ but appears blank because the template variables aren't configured in your EmailJS dashboard.

---

## 🔧 **Fix It Now (5 Minutes)**

### **Step 1: Go to EmailJS Dashboard**

1. Open: **https://dashboard.emailjs.com**
2. Login with your account
3. Click **"Email Templates"** in the left menu
4. Find your template: **template_5uhd93r**
5. Click **"Edit"** on that template

---

### **Step 2: Configure Template Subject**

In the **"Subject"** field, paste this:

```
Payment Reminder - Outstanding Balance ${{total_due}}
```

---

### **Step 3: Configure Template Content**

**IMPORTANT:** EmailJS templates use **double curly braces** `{{variable}}` for variables.

In the **"Content"** field (HTML mode), **delete everything** and paste this complete template:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Inter', Arial, sans-serif;
      line-height: 1.6;
      color: #000;
      margin: 0;
      padding: 0;
      background: #f9fafb;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background: #fff;
      border: 1px solid #e5e7eb;
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
      font-weight: 700;
    }
    .header p {
      margin: 8px 0 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 30px 25px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
      color: #000;
    }
    .info-box {
      background: #f9fafb;
      padding: 15px 20px;
      border-left: 4px solid #000;
      margin: 20px 0;
    }
    .info-box p {
      margin: 5px 0;
      font-size: 14px;
    }
    .total-box {
      background: #000;
      color: #fff;
      padding: 20px;
      text-align: center;
      margin: 25px 0;
      border-radius: 8px;
    }
    .total-box h2 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .total-box p {
      margin: 5px 0 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .invoice-section {
      background: #f9fafb;
      padding: 20px;
      margin: 25px 0;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .invoice-section h3 {
      margin: 0 0 15px 0;
      font-size: 16px;
      color: #000;
    }
    .invoice-section ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .invoice-section li {
      padding: 12px 15px;
      margin-bottom: 8px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 14px;
    }
    .payment-methods {
      background: #fff;
      padding: 20px;
      margin: 25px 0;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .payment-methods h3 {
      margin: 0 0 15px 0;
      font-size: 16px;
    }
    .payment-methods ul {
      padding-left: 20px;
      margin: 10px 0;
    }
    .payment-methods li {
      margin-bottom: 8px;
      font-size: 14px;
    }
    .cta-button {
      text-align: center;
      margin: 30px 0;
    }
    .cta-button a {
      display: inline-block;
      background: #000;
      color: #fff;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
    }
    .cta-button a:hover {
      background: #333;
    }
    .note {
      background: #f9fafb;
      padding: 15px 20px;
      margin: 20px 0;
      border-left: 3px solid #666;
      font-size: 14px;
      color: #333;
    }
    .signature {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .signature p {
      margin: 8px 0;
      font-size: 14px;
    }
    .arabic {
      font-size: 16px;
      margin: 15px 0;
      color: #000;
    }
    .footer {
      background: #f9fafb;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 8px 0;
      font-size: 13px;
      color: #666;
    }
    .footer strong {
      color: #000;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <h1>💰 Subscription Manager HK</h1>
      <p>Payment Reminder Notification</p>
    </div>
    
    <!-- Content -->
    <div class="content">
      <!-- Greeting -->
      <p class="greeting">Dear <strong>{{to_name}}</strong>,</p>
      <p class="arabic">السلام عليكم ورحمة الله وبركاته</p>
      
      <p>This is a friendly reminder about your outstanding subscription payments with Subscription Manager HK.</p>
      
      <!-- Member Info -->
      <div class="info-box">
        <p><strong>Member ID:</strong> {{member_id}}</p>
        <p><strong>Email:</strong> {{to_email}}</p>
        <p><strong>WhatsApp:</strong> {{member_phone}}</p>
      </div>
      
      <!-- Total Outstanding -->
      <div class="total-box">
        <h2>${{total_due}}</h2>
        <p>Total Outstanding Balance</p>
      </div>
      
      <!-- Invoice List -->
      <div class="invoice-section">
        <h3>📋 Outstanding Invoices ({{invoice_count}})</h3>
        <ul>
          {{{invoice_list_html}}}
        </ul>
      </div>
      
      <!-- Payment Methods -->
      <div class="payment-methods">
        <h3>💳 Payment Methods Available</h3>
        <ul>
          <li><strong>FPS (Faster Payment System):</strong> ID 1234567</li>
          <li><strong>PayMe:</strong> Scan QR code available in member portal</li>
          <li><strong>Bank Transfer:</strong> HSBC Hong Kong, Account Number: 123-456789-001, Account Name: Subscription Manager HK</li>
          <li><strong>Credit/Debit Card:</strong> Pay instantly through our secure online portal</li>
        </ul>
      </div>
      
      <!-- Call to Action -->
      <div class="cta-button">
        <a href="{{portal_link}}">🔗 Login to Member Portal</a>
      </div>
      
      <!-- Note -->
      <div class="note">
        <p><strong>Note:</strong> Please settle your outstanding balance at your earliest convenience. If you have already made the payment, kindly upload your payment proof through the member portal for verification.</p>
      </div>
      
      <!-- Signature -->
      <div class="signature">
        <p class="arabic">جزاك الله خيرا</p>
        <p>Best regards,<br>
        <strong>Finance Team</strong><br>
        Subscription Manager HK</p>
        <p style="color: #666; font-size: 13px; margin-top: 15px;">
          Date: {{current_date}}
        </p>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p>This is an automated reminder. Please do not reply directly to this email.</p>
      <p>For assistance, contact: <strong>support@subscriptionhk.org</strong> or call <strong>+852 2800 1122</strong></p>
      <p style="margin-top: 15px; font-size: 12px;">© 2025 Subscription Manager HK. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
```

**IMPORTANT:** Make sure to use **triple braces** `{{{invoice_list_html}}}` for the invoice list HTML (not double braces).

---

### **Step 4: Save Template**

1. Click **"Save"** button in EmailJS dashboard
2. **Important:** Make sure template is **"Published"** (not Draft)
3. Close the template editor

---

## 🧪 **Test Again**

1. **Clear localStorage:**
   ```javascript
   // In browser console (F12):
   localStorage.clear(); location.reload();
   ```

2. **Login as Admin**

3. **Go to Members → View "Shan Yeager"**

4. **Click "Send Reminder"**

5. **Check your email** (0741sanjai@gmail.com)

6. ✅ **You should receive a fully formatted email with:**
   - Your name: Shan Yeager
   - Member ID: HK1001
   - Total: $250
   - 4 invoices listed with details
   - Payment methods
   - Portal link button

---

## 📋 **Template Variables We're Sending**

Make sure your EmailJS template has these variables:

| Variable | What It Shows |
|----------|---------------|
| `{{to_name}}` | Shan Yeager |
| `{{to_email}}` | 0741sanjai@gmail.com |
| `{{member_id}}` | HK1001 |
| `{{member_phone}}` | +852 9000 1234 |
| `{{total_due}}` | 250 |
| `{{invoice_count}}` | 4 |
| `{{{invoice_list_html}}}` | HTML list of 4 invoices |
| `{{portal_link}}` | http://localhost:5173/member |
| `{{current_date}}` | 20 November 2025 |

**Note:** Use **triple braces** `{{{ }}}` for HTML content, **double braces** `{{ }}` for text.

---

## ✅ **Checklist**

- [ ] Updated EmailJS template with HTML content above
- [ ] Subject line has `{{total_due}}` variable
- [ ] Content has all `{{variables}}` in correct places
- [ ] Used `{{{invoice_list_html}}}` with **triple braces**
- [ ] Template is **Published** (not Draft)
- [ ] Saved template
- [ ] Cleared localStorage in browser
- [ ] Tested send reminder again
- [ ] Check email inbox

---

## 🎯 **Summary**

The blank email means:
- ✅ EmailJS is working
- ✅ Your credentials are correct
- ❌ Template variables aren't configured

**Fix:** Update your EmailJS template with the HTML code above, save it, and test again!

Copy the template HTML to your EmailJS dashboard now! 📧
