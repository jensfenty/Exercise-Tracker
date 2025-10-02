const express = require('express');
const app = express();
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// Middlewares
app.use(cors());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// Define Schemas and Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
});

const exerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);

// Basic home page route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// POST /api/users - Create a New User (Tests 2, 3)
app.post('/api/users', async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.json({ error: 'Username is required' });
  }

  try {
    const newUser = new User({ username });
    const savedUser = await newUser.save();
    
    res.json({
      username: savedUser.username,
      _id: savedUser._id,
    });

  } catch (err) {
    if (err.code === 11000) {
      // Handle duplicate key error (username already taken)
      return res.json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users - Get list of all users (Tests 4, 5, 6)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('_id username');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch users' });
  }
});


// POST /api/users/:_id/exercises - Add exercises (Tests 7, 8)
app.post('/api/users/:_id/exercises', async (req, res) => {
  const userId = req.params._id;
  const { description, duration, date } = req.body;

  // Validation
  if (!description || !duration || isNaN(Number(duration))) {
    return res.json({ error: 'Description and valid duration are required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ error: 'User not found' });
    }

    const dateObj = date ? new Date(date) : new Date();
    // Check for "Invalid Date"
    if (date && dateObj.toString() === "Invalid Date") {
      return res.json({ error: 'Invalid date format' });
    }

    const newExercise = new Exercise({
      userId,
      description,
      duration: Number(duration),
      date: dateObj
    });

    const savedExercise = await newExercise.save();

    // The required response format for the test
    res.json({
      _id: user._id,
      username: user.username,
      date: savedExercise.date.toDateString(),
      duration: savedExercise.duration,
      description: savedExercise.description,
    });

  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


// GET /api/users/:_id/logs - Get user's exercise log (Tests 9-16)
app.get('/api/users/:_id/logs', async (req, res) => {
  const userId = req.params._id;
  const { from, to, limit } = req.query;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.json({ error: 'User not found' });
    }

    // Build the date filtering query
    let dateFilter = {};
    if (from) dateFilter['$gte'] = new Date(from);
    if (to) dateFilter['$lte'] = new Date(to);

    let query = { userId };
    if (from || to) {
      query.date = dateFilter;
    }

    // Find exercises, sort by date, and apply limit
    let exercisesQuery = Exercise.find(query).sort({ date: 'asc' });

    if (limit) {
      exercisesQuery = exercisesQuery.limit(parseInt(limit));
    }

    const exercises = await exercisesQuery.exec();

    // Format the log array for the response
    const log = exercises.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString(),
    }));

    // The required Log structure response
    res.json({
      _id: user._id,
      username: user.username,
      count: log.length,
      log: log,
    });

  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
});