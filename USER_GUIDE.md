# Subscription Manager HK - User Guide

## 🚀 Quick Start

### Starting the Application

```bash
cd client
npm install  # First time only
npm run dev
```

The application will open at: `http://localhost:5173`

## 🔑 Login Credentials

### Admin Login
- **Email**: admin@subscriptionhk.org
- **Password**: Admin#2025

### Member Login
- **Email**: member@subscriptionhk.org
- **Password**: Member#2025

---

## 👨‍💼 Admin Portal Features

### 1. Dashboard
View key metrics and recent activity:
- Total Members count
- Monthly/Yearly collection totals
- Outstanding balances
- Overdue members count
- 12-month collection chart
- Recent payments table

### 2. Members Management

#### Add New Member
1. Click **"+ Add Member"** button
2. Fill in required fields:
   - Name (required)
   - Email (required)
   - Phone
   - Status (Active/Inactive)
3. Click **"Add Member"**
4. ✅ Success toast appears

#### Edit Member
1. Click **"Edit"** button on any member row
2. Update the information
3. Click **"Update Member"**
4. ✅ Success toast appears

#### Delete Member
1. Click **"Delete"** button on any member row
2. Confirm deletion in dialog
3. ✅ Member and associated invoices removed

#### View Member Details
1. Click **"View"** button on any member row
2. See complete member profile with:
   - Personal information
   - Outstanding balance
   - Next due date
   - Last payment date
3. Switch between tabs:
   - **Invoices**: All member invoices
   - **Payment History**: Payment timeline
   - **Communication**: Email/WhatsApp logs

### 3. Invoice Management

#### Create Invoice
1. Navigate to **"Invoice Builder"** tab
2. Select member from dropdown
3. Choose invoice type:
   - **Monthly**: $50 (default)
   - **Eid**: $100
4. Enter period (e.g., "Nov 2025")
5. Set due date
6. Add notes (optional)
7. Click **"Create Invoice"** or **"Create & Send Reminder"**
8. ✅ Invoice created and appears in system

#### Mark Invoice as Paid
1. Go to Member Detail → Invoices tab
2. Click **"Mark Paid"** on any unpaid invoice
3. ✅ Status updates to "Paid"
4. ✅ Metrics automatically update

#### Delete Invoice
1. Go to Member Detail → Invoices tab
2. Click **"Delete"** on any invoice
3. Confirm deletion
4. ✅ Invoice removed

### 4. Reminders & Automation
1. Navigate to **"Reminders"** tab
2. Toggle reminder rules on/off
3. Configure timing (3 days before, on date, 5 days after)
4. Select channels (Email/WhatsApp)
5. Click **"Save Settings"**
6. ✅ Configuration saved

### 5. Payment Methods
1. Navigate to **"Payments"** tab
2. Toggle payment methods on/off:
   - Direct Bank Transfer
   - FPS
   - Alipay
   - PayMe
   - Credit/Debit Cards
3. ✅ Changes save automatically

### 6. Reports
1. Navigate to **"Reports"** tab
2. View collection statistics
3. See payment method breakdown
4. Click **"Export CSV"** or **"Export PDF"**
5. ✅ Export notification appears

### 7. Settings
1. Navigate to **"Settings"** tab
2. Update organization information
3. Click **"Save Changes"**
4. ✅ Settings saved

---

## 👤 Member Portal Features

### 1. Dashboard

#### View Statistics
- **Outstanding Balance**: Total amount owed
- **Next Due Date**: Upcoming payment date
- **Paid This Year**: Total paid in current year
- **Membership Plan**: Active subscription details

#### Alert Banner
- Shows when payments are overdue
- Click **"Pay Now"** to make payment

#### Upcoming Payments
- Lists all unpaid/overdue invoices
- Shows due dates and amounts
- Click **"View All Invoices"** for complete list

#### Recent Activity
- Timeline of recent payments
- Shows date, amount, and method
- Click **"View Payment History"** for full history

#### Quick Actions
- **Pay Now**: Navigate to payment page
- **View Invoices**: See all invoices
- **Payment History**: View past payments
- **Settings**: Update profile

### 2. Pay Now

#### Make a Payment
1. Click **"Pay Now"** from dashboard or header
2. **Select invoices to pay**:
   - Check boxes next to invoices
   - See total amount update automatically
3. **Choose payment method**:
   
   **For Bank Transfer / FPS / PayMe / Alipay:**
   - View payment instructions
   - Enter transaction reference (required)
   - Upload payment proof (optional)
   - Click **"Submit Payment Details"**
   - ✅ Status: "Pending Verification"
   - ✅ Awaiting admin confirmation
   
   **For Credit/Debit Card:**
   - Enter card number (e.g., 4242 4242 4242 4242)
   - Enter name on card
   - Enter expiry (MM/YY)
   - Enter CVV (3 digits)
   - Click **"Pay $X"**
   - ✅ Status: "Paid" immediately
   - ✅ Payment processed instantly

4. **See confirmation screen**:
   - Success message
   - Payment reference number
   - Options to return to dashboard or view invoices

### 3. Invoices

#### View All Invoices
1. Navigate to **"Invoices"** tab
2. See complete list with:
   - Invoice number
   - Period
   - Amount
   - Status (Paid/Unpaid/Overdue/Pending Verification)
   - Due date
3. For unpaid invoices:
   - Click **"Pay Now"** button
   - Automatically selected in payment page

### 4. Payment History

#### View Past Payments
1. Navigate to **"Payment History"** tab
2. See chronological list of all payments:
   - Date
   - Amount
   - Payment method
   - Reference number
   - Status badge

### 5. Profile & Settings

#### Update Profile
1. Navigate to **"Profile"** tab
2. Update information:
   - Name
   - Email
   - Mobile (WhatsApp)
3. Configure notifications:
   - ☑️ Receive email reminders
   - ☑️ Receive WhatsApp reminders
4. Click **"Save Changes"**
5. ✅ Profile updated

---

## 📱 Mobile Usage

### Navigation
- On mobile/tablet, sidebar converts to horizontal tabs
- Swipe left/right to scroll through tabs
- Tap any tab to switch sections

### Tables
- Swipe horizontally to view all columns
- Buttons stack vertically for easy tapping

### Forms
- Fields stack vertically
- Larger touch targets (44px minimum)
- Optimized spacing for thumb typing

---

## 💡 Tips & Best Practices

### For Admins
1. **Regular Monitoring**: Check Dashboard daily for overdue members
2. **Prompt Invoicing**: Create invoices at the start of each period
3. **Follow-up**: Send reminders to members with outstanding balances
4. **Verification**: Promptly verify manual payments submitted by members
5. **Records**: Keep payment method details updated

### For Members
1. **Early Payment**: Pay before due date to avoid late fees
2. **Card Payment**: Use card for instant confirmation
3. **Manual Payment**: Provide clear reference numbers
4. **Proof Upload**: Upload payment screenshots for faster verification
5. **Profile Updated**: Keep contact information current

---

## 🔄 Data Persistence

All data is saved automatically in your browser:
- Members list
- Invoices
- Payments
- Settings

**Important**: 
- Data persists across page refreshes
- Clearing browser data will reset the application
- To start fresh, clear browser localStorage

---

## ✅ Success Indicators

Watch for green toast notifications:
- ✓ Member added successfully
- ✓ Invoice created successfully
- ✓ Payment submitted successfully
- ✓ Settings saved
- ✓ Profile updated

---

## ❌ Error Handling

Red toast notifications indicate issues:
- Missing required fields
- Invalid email format
- No invoices selected for payment
- Missing transaction reference

**Fix errors and try again!**

---

## 🎨 Status Colors

- 🟢 **Green (Paid)**: Payment received and confirmed
- 🟡 **Amber (Unpaid)**: Payment due but not yet received
- 🔴 **Red (Overdue)**: Payment past due date
- ⚪ **Gray (Inactive)**: Member account inactive
- 🟣 **Purple (Pending Verification)**: Manual payment awaiting admin confirmation

---

## 🛠️ Technical Details

### Built With
- React 18
- Vite
- React Router
- Context API for state management
- localStorage for data persistence

### Browser Support
- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

### System Requirements
- Modern browser with JavaScript enabled
- localStorage enabled
- Internet connection for initial load

---

## 📞 Support

For issues or questions:
- Check the Implementation Summary for technical details
- Review this guide for usage instructions
- Clear localStorage and refresh if experiencing issues

---

**Happy Managing! 🎉**

