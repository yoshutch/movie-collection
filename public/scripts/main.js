'use strict';

MovieCollection.MOVIE_TEMPLATE =
	'<div class="movie thumbnail">' +
	'<div class="title"></div>' +
	'<img class="poster"/>' +
	'<ul class="copies"></ul> ' +
	'</div>';
MovieCollection.SEARCHED_MOVIE_TEMPLATE =
	'<div class="movie thumbnail">' +
	'<div class="title"></div>' +
	'<img class="poster"/>' +
	'<div class="btn-group">' +
		'<button class="btn btn-default dropdown-toggle" data-toggle="dropdown" ' +
			'aria-haspopup="true" aria-expanded="false">Add To Collection<span class="caret"></span></button>' +
		'<ul class="dropdown-menu">' +
			'<li><a class="add-btn" href="#">DVD</a></li>' +
			'<li><a class="add-btn" href="#">Blu-ray</a></li>' +
			'<li><a class="add-btn" href="#">Amazon Video</a></li>' +
			'<li><a class="add-btn" href="#">Ultra Violet</a></li>' +
			'<li><a class="add-btn" href="#">Google Play</a></li>' +
			'<li><a class="add-btn" href="#">iTunes</a></li>' +
			'<li role="separator" class="divider"></li>' +
			'<li><a class="add-btn" href="#">Other</a></li>' +
		'</ul>' +
	'</div>' +
	'</div>';
MovieCollection.POSTER_BASE_URL = "https://image.tmdb.org/t/p/";
MovieCollection.POSTER_SMALL = "w92";
MovieCollection.POSTER_MEDIUM = "w154";
MovieCollection.TMDB_BASE_URL = "https://api.themoviedb.org/3";

function MovieCollection(){
	this.userName = document.getElementById('user-name');
	this.userPic = document.getElementById('user-pic');
	this.searchTextField = document.getElementById('search');
	this.searchResults = document.getElementById('search-results');
	this.collection = document.getElementById('collection');

	this.signInButton = document.getElementById('sign-in');
	this.signOutButton = document.getElementById('sign-out');
	this.searchButton = document.getElementById('search-button');

	this.signOutButton.addEventListener('click', this.signOut.bind(this));
	this.signInButton.addEventListener('click', this.signIn.bind(this));
	this.searchButton.addEventListener('click', this.searchForMovies.bind(this));

	this.initFirebase();
}

// Sets up shortcuts to Firebase features and initiate firebase auth.
MovieCollection.prototype.initFirebase = function () {
	// Shortcuts to Firebase SDK features.
	this.auth = firebase.auth();
	this.database = firebase.database();
	this.storage = firebase.storage();
	// Initiates Firebase auth and listen to auth state changes.
	this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
};

MovieCollection.prototype.initSettings = function () {
	this.settingsRef = this.database.ref("settings");
	var self = this;
	this.settingsRef.once("value").then(function(snapshot){
		self.tmdbApiKey = snapshot.child("tmdb/apikey").val();
		self.copyTypes = snapshot.child("copy-types").val();
	});
};

// Signs-in.
MovieCollection.prototype.signIn = function () {
	// Sign in Firebase using popup auth and Google as the identity provider.
	var provider = new firebase.auth.GoogleAuthProvider();
	this.auth.signInWithPopup(provider);
};

// Signs-out.
MovieCollection.prototype.signOut = function () {
	// Sign out of Firebase.
	this.auth.signOut();
};

// Triggers when the auth state change for instance when the user signs-in or signs-out.
MovieCollection.prototype.onAuthStateChanged = function (user) {
	if (user) { // User is signed in!
		this.initSettings();
		// Get profile pic and user's name from the Firebase user object.
		var profilePicUrl = user.photoURL;
		var userName = user.displayName;

		// Set the user's profile pic and name.
		this.userPic.src = profilePicUrl;
		this.userName.textContent = userName;
		this.userUid = user.uid;

		// Show user's profile and sign-out button.
		this.userName.style.display = "block";
		this.userPic.style.display = "block";
		this.signOutButton.style.display = "block";

		// Hide sign-in button.
		this.signInButton.style.display = "none";

		this.loadCollection(this.userUid);

	} else { // User is signed out!
		// Hide user's profile and sign-out button.
		this.userName.style.display = "none";
		this.userPic.style.display = "none";
		this.signOutButton.style.display = "none";

		// Show sign-in button.
		this.signInButton.style.display = "block";
	}
};

MovieCollection.prototype.searchForMovies = function (){
	var path = "/search/movie?api_key=" + this.tmdbApiKey +"&query=" + this.searchTextField.value + "&page=1&include_adult=false&language=en-US";
	callTmdbApi(path, function(result){
		this.populateSearchResults(result);
	}.bind(this));
};

MovieCollection.prototype.populateSearchResults = function (result){
	this.searchResults.innerHTML = "";
	var results = result.results;
	for (var i = 0; i < results.length; i ++){

		var container = document.createElement('div');
		container.innerHTML = MovieCollection.SEARCHED_MOVIE_TEMPLATE;
		var div = container.firstChild;
		this.searchResults.appendChild(div);
		div.setAttribute('data-movie-id', results[i].id);
		div.setAttribute('data-movie-title', results[i].title);
		div.querySelector('.title').innerHTML = results[i].title;
		if (results[i].poster_path != undefined){
			div.querySelector('.poster').setAttribute("src", this.posterUrl(results[i].poster_path, MovieCollection.POSTER_MEDIUM));
		}
	}
	var self = this;
	$(".add-btn").on('click', function(event){
		var $button = $(this);
		$button.addClass("disabled");
		var $parent = $button.parent().parent().parent().parent();
		self.addMovieToCollection($parent.data("movie-id"), $parent.data("movie-title"), $button.html(), function(error){
			if (error) {
				console.error("Data could not be saved." + error);
			} else {
				console.log("Data saved successfully.");
			}
		});
	})
};

MovieCollection.prototype.addMovieToCollection = function (movieId, title, copyType, callback) {
	console.log("adding movie to collection: ", movieId, title, copyType);
	if (!this.moviesRef) {
		this.moviesRef = this.database.ref("collections/" + collectionId + "/movies");
	}
	this.moviesRef.child(movieId).once('value', function(snapshot){
		if (snapshot.val() !== null){
			// movie exists in your collection, adding copyType to copies
			this.moviesRef.child(movieId + "/copies").push().set(copyType, callback);
		} else {
			// movie doesn't already exist in your collection
			this.moviesRef.child(movieId).set({"title": title}, function(error){
				if (error){
					callback(error);
				} else {
					this.moviesRef.child(movieId + "/copies").push().set(copyType, callback);
				}
			}.bind(this));
		}
	}.bind(this));
};

MovieCollection.prototype.loadCollection = function (collectionId){
	console.log("loading collection");
	this.collectionRef = this.database.ref("collections/" + collectionId);
	if (!this.moviesRef) {
		this.moviesRef = this.database.ref("collections/" + collectionId + "/movies");
	}

	//make sure we remove all previous listeners.
	this.moviesRef.off();

	var setMovie = function(data) {
		var val = data.val();
		var movieId = data.key;
		this.displayMovieInCollection(movieId, val.title, val.copies);
	}.bind(this);
	this.moviesRef.on('child_added', setMovie);
	this.moviesRef.on('child_changed', setMovie);
	this.moviesRef.on('child_removed', function(childSnapshot, prevChildName){
		var removedMovie = document.getElementById(childSnapshot.key);
		removedMovie.parentNode.removeChild(removedMovie);
	})
};

MovieCollection.prototype.getMovieInfo = function (movieId, callback){
	callTmdbApi("/movie/" + movieId + "?api_key=" + this.tmdbApiKey + "&language=en-US",
		function(result){
			callback(result);
		}
	);
};

MovieCollection.prototype.displayMovieInCollection = function (movieId, title, copies){
	console.log("displayMovieInCollection: ", movieId, title, copies);
	var div = document.getElementById(movieId);
	if (!div) {
		var container = document.createElement('div');
		container.innerHTML = MovieCollection.MOVIE_TEMPLATE;
		div = container.firstChild;
		div.setAttribute('id', movieId);
		this.collection.appendChild(div);
	}
	this.getMovieInfo(movieId, function(movieInfo){
		console.log(movieInfo);
		div.querySelector('.poster').setAttribute('src', this.posterUrl(movieInfo.poster_path, MovieCollection.POSTER_MEDIUM));
	}.bind(this));

	div.querySelector('.title').innerHTML = title;
	div.querySelector('.copies').innerHTML = "";
	if (copies){
		var keys = Object.keys(copies);
		for (var i = 0; i < keys.length; i ++) {
			var key = keys[i];
			var li = document.createElement('li');
			li.appendChild(document.createTextNode(copies[key]));
			div.querySelector('.copies').appendChild(li);
		}
	}
};

MovieCollection.prototype.posterUrl = function (posterPath, size) {
	return MovieCollection.POSTER_BASE_URL + size + "/" + posterPath;
};

const callTmdbApi = function(path, successCallback, failCallback){
	var xmlhttp = new XMLHttpRequest();
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
			if (xmlhttp.status == 200) {
				successCallback(JSON.parse(xmlhttp.responseText));
			} else {
				console.error("error making call..", xmlhttp.responseText);
				failCallback(xmlhttp.responseText);
			}
		}
	};
	xmlhttp.open("GET", MovieCollection.TMDB_BASE_URL + path, true);
	xmlhttp.send();
};

window.onload = function () {
	window.movieCollection = new MovieCollection();
};