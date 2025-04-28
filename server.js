const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');


const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb+srv://legacieweb:aPX4XHXm7Ye5aUro@iyonicweb.cgaik.mongodb.net/?retryWrites=true&w=majority&appName=iyonicweb')
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB error:", err));
// Schema and Models
const UserSchema = new mongoose.Schema({ email: String, password: String });
const AppointmentSchema = new mongoose.Schema({
  name: String,
  email: String,
  service: String,
  datetime: Date,
  phone: String,
  reminderSent: { type: Boolean, default: false },
  startSent: { type: Boolean, default: false },
  status: { type: String, default: "active" },
  thankYouSent: { type: Boolean, default: false } // ✨ new field
});



const User = mongoose.model('User', UserSchema);
const Appointment = mongoose.model('Appointment', AppointmentSchema);

// Email transport (Nodemailer)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'iyonicorp@gmail.com',     // ✅ Replace this
    pass: 'dikfirjarvijwskx'         // ✅ App password (not your Gmail password!)
  }
});

// Reset code map
const resetCodes = {};

app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) return res.json({ success: false });

  await User.create({ name, email, password }); // Save name too!

  // Send personalized welcome email
  try {
    await transporter.sendMail({
      from: 'iyonicorp@gmail.com',
      to: email,
      subject: 'Welcome to Tranquil Essence Spa!',
      html: `
        <h1>Welcome, ${name}! 🌸</h1>
        <p>Thank you for signing up with Tranquil Essence Spa.</p>
        <p>We are excited to help you relax, heal, and rejuvenate.</p>
        <p>Log in anytime to book your massage therapy sessions.</p>
      `
    });
  } catch (error) {
    console.error('Signup email failed:', error);
  }

  res.json({ success: true });
});


app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, password });
  if (!user) return res.json({ success: false });

  // Send login success email
  try {
    await transporter.sendMail({
      from: 'iyonicorp@gmail.com',
      to: email,
      subject: 'Login Successful - Tranquil Essence Spa',
      html: `
        <h1>Hello!</h1>
        <p>Your login to Tranquil Essence Spa was successful.</p>
        <p>If this was not you, please reset your password immediately.</p>
      `
    });
  } catch (error) {
    console.error('Login email failed:', error);
  }

  res.json({ success: true });
});

app.post('/api/send-reset-code', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.json({ success: false });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  resetCodes[email] = code;

  await transporter.sendMail({
    from: '"Tranquil Spa" <your-email@gmail.com>',
    to: email,
    subject: "Your Password Reset Code",
    text: `Your reset code is ${code}`
  });

  res.json({ success: true });
});

app.post('/api/reset-password', async (req, res) => {
  const { email, code, password } = req.body;

  if (resetCodes[email] !== code) return res.json({ success: false });

  const user = await User.findOne({ email });
  if (user) {
    user.password = password;
    await user.save();
    delete resetCodes[email];

    // Send password reset confirmation email
    try {
      await transporter.sendMail({
        from: 'iyonicorp@gmail.com',
        to: email,
        subject: 'Password Reset Successful - Tranquil Essence Spa',
        html: `
          <h1>Password Changed Successfully</h1>
          <p>Hi there,</p>
          <p>This is a confirmation that your password has been successfully reset.</p>
          <p>If you did not perform this action, please contact our support team immediately.</p>
          <p>Thank you for choosing Tranquil Essence Spa!</p>
        `
      });
    } catch (error) {
      console.error('Password reset email failed:', error);
    }

    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});


app.post('/api/book-appointment', async (req, res) => {
  const { service, datetime, phone, email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ success: false, message: "Missing email or name." });
  }

  await Appointment.create({ email, service, datetime, phone, name });

  try {
    // Send confirmation email to user
    await transporter.sendMail({
      from: 'iyonicorp@gmail.com',
      to: email,
      subject: 'Appointment Confirmation',
      html: `
        <h1>Thank you for booking, ${name}!</h1>
        <p>Service: ${service}</p>
        <p>Time: ${new Date(datetime).toLocaleString()}</p>
        <p>We can't wait to see you at Tranquil Essence Spa! 🌸</p>
      `
    });

    // Send notification email to Admin
    await transporter.sendMail({
      from: 'iyonicorp@gmail.com',
      to: 'iyonicorp@gmail.com', // Admin email
      subject: '📅 New Appointment Scheduled',
      html: `
        <h1>New Appointment Booked!</h1>
        <p><strong>Client Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Service:</strong> ${service}</p>
        <p><strong>Time:</strong> ${new Date(datetime).toLocaleString()}</p>
      `
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Email sending failed:', error);
    res.status(500).json({ success: false });
  }
});


app.post('/api/my-appointments', async (req, res) => {
  const { email } = req.body;  // <-- get email from request

  if (!email) {
    return res.status(400).json({ appointments: [], message: 'Missing email.' });
  }

  const appointments = await Appointment.find({ email }); // only user's appointments
  res.json({ appointments });
});
// Cron Job that runs every minute
// Cron Job that runs every minute
cron.schedule('* * * * *', async () => {
  const now = new Date();

  // 1 hour ahead from now
  const oneHourLater = new Date(now.getTime() + (60 * 60 * 1000));
  const fiveMinutesBeforeNow = new Date(now.getTime() - (5 * 60 * 1000));

  // Find appointments needing 1-hour reminder
  const reminderAppointments = await Appointment.find({
    datetime: { $gte: now, $lte: oneHourLater },
    reminderSent: false
  });

  for (let app of reminderAppointments) {
    try {
      await transporter.sendMail({
        from: 'iyonicorp@gmail.com',
        to: app.email,
        subject: '⏳ Reminder: Your Appointment is in 1 Hour!',
        html: `
          <h1>Hi!</h1>
          <p>This is a friendly reminder that your appointment for <strong>${app.service}</strong> is coming up in 1 hour!</p>
          <p><strong>Time:</strong> ${new Date(app.datetime).toLocaleString()}</p>
          <p>We look forward to seeing you soon at Tranquil Essence Spa! 🌸</p>
        `
      });

      app.reminderSent = true;
      await app.save();
      console.log(`✅ Reminder email sent to ${app.email}`);
    } catch (error) {
      console.error('❌ Error sending 1 hour reminder:', error);
    }
  }

  // Find appointments where it's time to start
  const startAppointments = await Appointment.find({
    datetime: { $lte: now, $gte: fiveMinutesBeforeNow },
    startSent: false
  });

  for (let app of startAppointments) {
    try {
      await transporter.sendMail({
        from: 'iyonicorp@gmail.com',
        to: app.email,
        subject: '🌟 Your Appointment Time Has Started!',
        html: `
          <h1>Your Appointment is Starting!</h1>
          <p>Your <strong>${app.service}</strong> session is now beginning at <strong>${new Date(app.datetime).toLocaleString()}</strong>.</p>
          <p>Please arrive promptly for your best spa experience. ✨</p>
        `
      });

      app.startSent = true;
      await app.save();
      console.log(`✅ Start email sent to ${app.email}`);
    } catch (error) {
      console.error('❌ Error sending appointment start email:', error);
    }
  }

  // Find appointments that ended 2 hours ago to send a thank you
  const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));
  const twoHoursAgoMinus5Min = new Date(now.getTime() - (2 * 60 * 60 * 1000) - (5 * 60 * 1000));

  const thankYouAppointments = await Appointment.find({
    datetime: { $gte: twoHoursAgoMinus5Min, $lte: twoHoursAgo },
    status: 'active',
    thankYouSent: false
  });

  for (let app of thankYouAppointments) {
    try {
      await transporter.sendMail({
        from: 'iyonicorp@gmail.com',
        to: app.email,
        subject: '🙏 Thank You for Visiting Tranquil Essence Spa',
        html: `
          <h1>Thank You, ${app.name}!</h1>
          <p>We hope you enjoyed your <strong>${app.service}</strong> session today.</p>
          <p>It was a pleasure having you at Tranquil Essence Spa. 🌿</p>
          <p>We look forward to welcoming you again for more relaxation and rejuvenation! 🌺</p>
          <br/>
          <p><em>Stay serene,</em><br><strong>Tranquil Essence Spa Team</strong></p>
        `
      });

      app.thankYouSent = true;
      await app.save();
      console.log(`✅ Thank you email sent to ${app.email}`);
    } catch (error) {
      console.error('❌ Error sending thank you email:', error);
    }
  }
});


app.post('/api/cancel-appointment', async (req, res) => {
  const { id } = req.body;

  const appointment = await Appointment.findById(id);
  if (!appointment) return res.json({ success: false });

  try {
    appointment.status = 'canceled';
    await appointment.save();

    // Send cancellation email to user
    await transporter.sendMail({
      from: 'iyonicorp@gmail.com',
      to: appointment.email,
      subject: 'Appointment Canceled - Tranquil Essence Spa',
      html: `
        <h1>Appointment Canceled</h1>
        <p>Your appointment for <strong>${appointment.service}</strong> scheduled at <strong>${new Date(appointment.datetime).toLocaleString()}</strong> has been canceled.</p>
        <p>We hope to see you again soon!</p>
      `
    });

    // Send notification email to Admin
    await transporter.sendMail({
      from: 'iyonicorp@gmail.com',
      to: 'iyonicorp@gmail.com',
      subject: '🚫 Appointment Canceled',
      html: `
        <h1>Appointment Canceled by User</h1>
        <p><strong>Client Name:</strong> ${appointment.name}</p>
        <p><strong>Email:</strong> ${appointment.email}</p>
        <p><strong>Phone:</strong> ${appointment.phone}</p>
        <p><strong>Service:</strong> ${appointment.service}</p>
        <p><strong>Original Time:</strong> ${new Date(appointment.datetime).toLocaleString()}</p>
      `
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.json({ success: false });
  }
});


app.post('/api/reschedule-appointment', async (req, res) => {
  const { id, newDatetime } = req.body;

  const appointment = await Appointment.findById(id);
  if (!appointment) return res.json({ success: false });

  try {
    const oldDatetime = appointment.datetime; // Save old date first

    appointment.datetime = new Date(newDatetime);
    appointment.reminderSent = false;
    appointment.startSent = false;
    appointment.status = 'active';
    await appointment.save();

    // Send reschedule confirmation to user
    await transporter.sendMail({
      from: 'iyonicorp@gmail.com',
      to: appointment.email,
      subject: 'Appointment Rescheduled - Tranquil Essence Spa',
      html: `
        <h1>Appointment Rescheduled!</h1>
        <p>Your appointment for <strong>${appointment.service}</strong> has been successfully rescheduled.</p>
        <p><strong>New Time:</strong> ${new Date(newDatetime).toLocaleString()}</p>
      `
    });

    // Send notification to Admin
    await transporter.sendMail({
      from: 'iyonicorp@gmail.com',
      to: 'iyonicorp@gmail.com',
      subject: '🔄 Appointment Rescheduled',
      html: `
        <h1>Appointment Rescheduled by User</h1>
        <p><strong>Client Name:</strong> ${appointment.name}</p>
        <p><strong>Email:</strong> ${appointment.email}</p>
        <p><strong>Phone:</strong> ${appointment.phone}</p>
        <p><strong>Service:</strong> ${appointment.service}</p>
        <p><strong>Old Time:</strong> ${new Date(oldDatetime).toLocaleString()}</p>
        <p><strong>New Time:</strong> ${new Date(newDatetime).toLocaleString()}</p>
      `
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Reschedule appointment error:', error);
    res.json({ success: false });
  }
});


app.get('/api/all-appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ datetime: -1 });
    res.json({ appointments });
  } catch (error) {
    console.error('Failed to fetch all appointments:', error);
    res.status(500).json({ appointments: [] });
  }
});



const AdminSchema = new mongoose.Schema({
  password: String
});

const Admin = mongoose.model('Admin', AdminSchema);
module.exports = Admin;


// Check if admin exists
app.get('/api/admin-exists', async (req, res) => {
  const admin = await Admin.findOne();
  res.json({ exists: !!admin });
});

// First time signup
app.post('/api/admin-signup', async (req, res) => {
  const { password } = req.body;
  const existing = await Admin.findOne();
  if (existing) return res.json({ success: false });

  await Admin.create({ password });
  res.json({ success: true });
});

// Login
app.post('/api/admin-login', async (req, res) => {
  const { password } = req.body;
  const admin = await Admin.findOne();
  if (!admin) return res.json({ success: false });

  if (admin.password === password) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// New Contact Message Route
app.post('/api/contact-message', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.json({ success: false });
  }

  try {
    await transporter.sendMail({
      from: 'iyonicorp@gmail.com',
      to: 'iyonicorp@gmail.com',  // Admin email to receive messages
      subject: '💌 New Contact Message - Tranquil Essence Spa',
      html: `
        <h1>New Contact Form Submission</h1>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Contact form email failed:', error);
    res.json({ success: false });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
