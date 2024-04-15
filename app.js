// Import the required modules
const express = require('express');
const mongoose = require('mongoose');
// import fs - file system module to read the JSON files
const fs = require('fs');

// Connect to MongoDB
mongoose.connect('mongodb://localhost/movie_recommendation', {
  useNewUrlParser: true, // Use the new URL parser which is more efficient compared to the legacy parser
  // url parser means that the connection string is parsed into a URL object
  useUnifiedTopology: true,
    // useUnifiedTopology is set to true to use the new Server Discover and Monitoring engine
    // which is more efficient and reliable compared to the legacy engine
});

// Define schemas

// User schema represents the structure of the user document in the database
const userSchema = new mongoose.Schema({
  user_id: String,
  name: String,
});

// Movie schema represents the structure of the movie document in the database
const movieSchema = new mongoose.Schema({
  movie_id: String,
  genres: [String], // An array of strings to store the genres of the movie
  release_date: Date,
});

// Preference schema represents the structure of the user preference document in the database
const preferenceSchema = new mongoose.Schema({
  user_id: String,
  genre: String,
  preference_score: Number,
});

// RelatedUser schema represents the structure of the related user document in the database
const relatedUserSchema = new mongoose.Schema({
  user_id: String,
  related_user_id: String,
});

// Define models based on the schemas
const User = mongoose.model('User', userSchema);
const Movie = mongoose.model('Movie', movieSchema);
const Preference = mongoose.model('Preference', preferenceSchema);
const RelatedUser = mongoose.model('RelatedUser', relatedUserSchema);

// Function to load sample data into the database
const loadSampleData = async () => {
  try {
    // Load users data from the JSON file
    const usersData = JSON.parse(fs.readFileSync('./data/user_data.json'));
    // Insert the users data into the database
    await User.insertMany(usersData);

    // Load movies data from the JSON file
    const moviesData = JSON.parse(fs.readFileSync('./data/movie_data.json'));
    // Insert the movies data into the database
    await Movie.insertMany(moviesData);

    // Load preferences data from the JSON file
    const preferencesData = JSON.parse(fs.readFileSync('./data/user_preference.json'));
    // Insert the preferences data into the database
    await Preference.insertMany(preferencesData);

    // Load related users data from the JSON file
    const relatedUsersData = JSON.parse(fs.readFileSync('./data/related_user.json'));
    // Insert the related users data into the database
    await RelatedUser.insertMany(relatedUsersData);

    console.log('Sample data loaded successfully');
  } catch (error) {
    console.error('Error loading sample data:', error);
  }
};

// Load sample data when the server starts
loadSampleData();

// Create an Express application
const app = express();

// Generate personalized feed for a user
app.get('/feed/:userId', async (req, res) => {
  const userId = req.params.userId;

  try {
    // Get user preferences from the database
    const userPreferences = await Preference.find({ user_id: userId });

    // Get related users from the database
    const relatedUsers = await RelatedUser.find({ user_id: userId });

    // Get all movies from the database
    const movies = await Movie.find();

    // Calculate relevance score for each movie
    const scoredMovies = movies.map((movie) => {
      let score = 0;

      // Time Delta score (Gaussian decay function)
      // Calculate the time difference between the movie's release date and the current date in years
      const timeDelta = (new Date() - movie.release_date) / (1000 * 60 * 60 * 24 * 365);
      // Apply a Gaussian decay function to give higher scores to newer movies
      const timeScore = Math.exp(-Math.pow(timeDelta, 2) / 2);
      score += timeScore;

      // User preference score
      // Check if the movie's genres match the user's preferences and add the corresponding preference score to the overall score
      userPreferences.forEach((preference) => {
        if (movie.genres.includes(preference.genre)) {
          score += preference.preference_score;
        }
      });

      // Related users' preference score
      // Iterate over the related users and their preferences
      // If the movie's genres match their preferences, add the corresponding preference score to the overall score
      relatedUsers.forEach(async (relatedUser) => {
        const relatedUserPreferences = await Preference.find({ user_id: relatedUser.related_user_id });
        relatedUserPreferences.forEach((preference) => {
          if (movie.genres.includes(preference.genre)) {
            score += preference.preference_score;
          }
        });
      });

      // Return an object containing the movie and its relevance score
      return { movie, score };
    });

    // Sort the movies based on their relevance scores in descending order
    const sortedMovies = scoredMovies.sort((a, b) => b.score - a.score);

    // Select the top 10 movies from the sorted list
    const topMovies = sortedMovies.slice(0, 10).map((movieData) => movieData.movie);

    // Send the top movies as the response
    res.json(topMovies);
  } catch (error) {
    console.error('Error generating personalized feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});